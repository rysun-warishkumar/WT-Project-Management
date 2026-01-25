const express = require('express');
const { query: validatorQuery } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get velocity report (story points completed per sprint)
router.get('/workspace/:workspaceId/velocity', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get completed sprints with velocity
    const sprints = await dbQuery(
      `SELECT 
        s.id,
        s.name,
        s.start_date,
        s.end_date,
        s.status,
        COALESCE(SUM(CASE WHEN us.status = 'done' THEN us.story_points ELSE 0 END), 0) as completed_points,
        COALESCE(SUM(us.story_points), 0) as committed_points
       FROM pm_sprints s
       LEFT JOIN pm_user_stories us ON us.sprint_id = s.id
       WHERE s.workspace_id = ? AND s.status = 'completed'
       GROUP BY s.id, s.name, s.start_date, s.end_date, s.status
       ORDER BY s.end_date DESC
       LIMIT 10`,
      [workspaceId]
    );

    // Calculate average velocity
    const completedSprints = sprints.filter(s => s.completed_points > 0);
    const avgVelocity = completedSprints.length > 0
      ? completedSprints.reduce((sum, s) => sum + parseFloat(s.completed_points), 0) / completedSprints.length
      : 0;

    res.json({
      success: true,
      data: {
        sprints: sprints.map(s => ({
          id: s.id,
          name: s.name,
          start_date: s.start_date,
          end_date: s.end_date,
          completed_points: parseFloat(s.completed_points),
          committed_points: parseFloat(s.committed_points),
          velocity: parseFloat(s.completed_points)
        })),
        average_velocity: parseFloat(avgVelocity.toFixed(2))
      }
    });
  } catch (error) {
    console.error('Error fetching velocity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch velocity data'
    });
  }
});

// Get cycle time report (average time from "In Progress" to "Done")
router.get('/workspace/:workspaceId/cycle-time', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get tasks that moved from "in_progress" to "done"
    const tasks = await dbQuery(
      `SELECT 
        t.id,
        t.title,
        t.status,
        t.created_at,
        t.updated_at,
        us.title as story_title,
        us.id as story_id
       FROM pm_tasks t
       LEFT JOIN pm_user_stories us ON us.id = t.user_story_id
       WHERE us.workspace_id = ? AND t.status = 'done'
       ORDER BY t.updated_at DESC
       LIMIT 100`,
      [workspaceId]
    );

    // Calculate cycle times (simplified: using updated_at - created_at for done tasks)
    // In a real system, you'd track status change timestamps
    const cycleTimes = tasks.map(task => {
      const created = new Date(task.created_at);
      const completed = new Date(task.updated_at);
      const days = (completed - created) / (1000 * 60 * 60 * 24);
      return {
        task_id: task.id,
        task_title: task.title,
        story_id: task.story_id,
        story_title: task.story_title,
        cycle_time_days: parseFloat(days.toFixed(2))
      };
    });

    const avgCycleTime = cycleTimes.length > 0
      ? cycleTimes.reduce((sum, ct) => sum + ct.cycle_time_days, 0) / cycleTimes.length
      : 0;

    res.json({
      success: true,
      data: {
        tasks: cycleTimes,
        average_cycle_time_days: parseFloat(avgCycleTime.toFixed(2)),
        median_cycle_time_days: cycleTimes.length > 0
          ? parseFloat(cycleTimes.sort((a, b) => a.cycle_time_days - b.cycle_time_days)[Math.floor(cycleTimes.length / 2)].cycle_time_days.toFixed(2))
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching cycle time:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cycle time data'
    });
  }
});

// Get throughput report (items completed per sprint)
router.get('/workspace/:workspaceId/throughput', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get throughput per sprint
    const throughput = await dbQuery(
      `SELECT 
        s.id,
        s.name,
        s.start_date,
        s.end_date,
        COUNT(DISTINCT CASE WHEN us.status = 'done' THEN us.id END) as stories_completed,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as tasks_completed,
        COALESCE(SUM(CASE WHEN us.status = 'done' THEN us.story_points ELSE 0 END), 0) as story_points_completed
       FROM pm_sprints s
       LEFT JOIN pm_user_stories us ON us.sprint_id = s.id
       LEFT JOIN pm_tasks t ON t.user_story_id = us.id
       WHERE s.workspace_id = ? AND s.status = 'completed'
       GROUP BY s.id, s.name, s.start_date, s.end_date
       ORDER BY s.end_date DESC
       LIMIT 10`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: {
        sprints: throughput.map(t => ({
          id: t.id,
          name: t.name,
          start_date: t.start_date,
          end_date: t.end_date,
          stories_completed: parseInt(t.stories_completed),
          tasks_completed: parseInt(t.tasks_completed),
          story_points_completed: parseFloat(t.story_points_completed)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching throughput:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch throughput data'
    });
  }
});

// Get cumulative flow diagram data
router.get('/workspace/:workspaceId/cumulative-flow', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { days = 30 } = req.query;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get daily status counts for the last N days
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    const startDateStr = startDate.toISOString().split('T')[0];

    const flowData = await dbQuery(
      `SELECT 
        DATE(us.updated_at) as date,
        us.status,
        COUNT(*) as count
       FROM pm_user_stories us
       WHERE us.workspace_id = ? 
       AND DATE(us.updated_at) >= ?
       GROUP BY DATE(us.updated_at), us.status
       ORDER BY date ASC, us.status ASC`,
      [workspaceId, startDateStr]
    );

    // Group by date and status
    const grouped = {};
    flowData.forEach(item => {
      const date = item.date.toISOString().split('T')[0];
      if (!grouped[date]) {
        grouped[date] = {
          date,
          backlog: 0,
          sprint: 0,
          in_progress: 0,
          testing: 0,
          done: 0
        };
      }
      grouped[date][item.status] = parseInt(item.count);
    });

    res.json({
      success: true,
      data: {
        flow: Object.values(grouped)
      }
    });
  } catch (error) {
    console.error('Error fetching cumulative flow:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch cumulative flow data'
    });
  }
});

// Get team workload distribution
router.get('/workspace/:workspaceId/workload', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get workload per team member
    const workload = await dbQuery(
      `SELECT 
        u.id,
        u.full_name,
        u.email,
        COUNT(DISTINCT us.id) as stories_assigned,
        COUNT(DISTINCT t.id) as tasks_assigned,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as tasks_completed,
        COALESCE(SUM(CASE WHEN us.status != 'done' THEN us.story_points ELSE 0 END), 0) as remaining_story_points,
        COALESCE(SUM(CASE WHEN us.status = 'done' THEN us.story_points ELSE 0 END), 0) as completed_story_points
       FROM pm_workspace_members wm
       JOIN users u ON u.id = wm.user_id
       LEFT JOIN pm_user_stories us ON us.assignee_id = u.id AND us.workspace_id = wm.workspace_id
       LEFT JOIN pm_tasks t ON t.assignee_id = u.id AND t.user_story_id = us.id
       WHERE wm.workspace_id = ?
       GROUP BY u.id, u.full_name, u.email
       ORDER BY remaining_story_points DESC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: {
        members: workload.map(w => ({
          user_id: w.id,
          name: w.full_name,
          email: w.email,
          stories_assigned: parseInt(w.stories_assigned),
          tasks_assigned: parseInt(w.tasks_assigned),
          tasks_completed: parseInt(w.tasks_completed),
          remaining_story_points: parseFloat(w.remaining_story_points),
          completed_story_points: parseFloat(w.completed_story_points)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching workload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workload data'
    });
  }
});

// Get overall workspace statistics
router.get('/workspace/:workspaceId/summary', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspaceId, userId, workspaceId, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    // Get overall statistics
    const [stats] = await dbQuery(
      `SELECT 
        COUNT(DISTINCT us.id) as total_stories,
        COUNT(DISTINCT CASE WHEN us.status = 'done' THEN us.id END) as completed_stories,
        COUNT(DISTINCT t.id) as total_tasks,
        COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks,
        COUNT(DISTINCT s.id) as total_sprints,
        COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) as completed_sprints,
        COALESCE(SUM(us.story_points), 0) as total_story_points,
        COALESCE(SUM(CASE WHEN us.status = 'done' THEN us.story_points ELSE 0 END), 0) as completed_story_points,
        COUNT(DISTINCT wm.user_id) as team_members
       FROM pm_workspaces w
       LEFT JOIN pm_user_stories us ON us.workspace_id = w.id
       LEFT JOIN pm_tasks t ON t.user_story_id = us.id
       LEFT JOIN pm_sprints s ON s.workspace_id = w.id
       LEFT JOIN pm_workspace_members wm ON wm.workspace_id = w.id
       WHERE w.id = ?
       GROUP BY w.id`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: {
        total_stories: parseInt(stats.total_stories),
        completed_stories: parseInt(stats.completed_stories),
        total_tasks: parseInt(stats.total_tasks),
        completed_tasks: parseInt(stats.completed_tasks),
        total_sprints: parseInt(stats.total_sprints),
        completed_sprints: parseInt(stats.completed_sprints),
        total_story_points: parseFloat(stats.total_story_points),
        completed_story_points: parseFloat(stats.completed_story_points),
        team_members: parseInt(stats.team_members),
        completion_rate: stats.total_stories > 0
          ? parseFloat(((stats.completed_stories / stats.total_stories) * 100).toFixed(2))
          : 0
      }
    });
  } catch (error) {
    console.error('Error fetching summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch summary data'
    });
  }
});

module.exports = router;
