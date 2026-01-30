/**
 * Subscriptions / Tenant Workspaces (super admin only)
 * List all workspaces with trial/subscription info and user count.
 * Update trial end date for a workspace.
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const { query: dbQuery } = require('../config/database');

const router = express.Router();

const superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (!req.isSuperAdmin && !req.user.is_super_admin && !req.user.isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required',
    });
  }
  next();
};

router.use(authenticateToken);
router.use(superAdminOnly);

// GET /api/subscriptions - list all workspaces with trial/subscription and user count
router.get('/', async (req, res) => {
  try {
    const rows = await dbQuery(
      `SELECT 
        w.id,
        w.name,
        w.slug,
        w.owner_id,
        w.plan_type,
        w.status,
        w.trial_ends_at,
        w.subscription_id,
        w.created_at,
        u.full_name as owner_name,
        u.email as owner_email,
        (SELECT COUNT(*) FROM workspace_members wm WHERE wm.workspace_id = w.id AND wm.status = 'active') as user_count
       FROM workspaces w
       LEFT JOIN users u ON w.owner_id = u.id
       ORDER BY w.created_at DESC`
    );

    res.json({
      success: true,
      data: {
        subscriptions: rows,
      },
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch subscriptions',
    });
  }
});

// PATCH /api/subscriptions/:id/trial - update trial end date (super admin only)
router.patch(
  '/:id/trial',
  body('trial_ends_at')
    .optional({ nullable: true })
    .custom((val) => val === null || val === '' || !isNaN(Date.parse(val)))
    .withMessage('trial_ends_at must be a valid date or null'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array(),
        });
      }

      const workspaceId = parseInt(req.params.id, 10);
      if (isNaN(workspaceId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid workspace ID',
        });
      }

      const { trial_ends_at } = req.body;

      const existing = await dbQuery(
        'SELECT id, name, trial_ends_at FROM workspaces WHERE id = ?',
        [workspaceId]
      );
      if (existing.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found',
        });
      }

      if (trial_ends_at !== undefined && trial_ends_at !== null) {
        await dbQuery(
          'UPDATE workspaces SET trial_ends_at = ? WHERE id = ?',
          [trial_ends_at, workspaceId]
        );
      } else {
        await dbQuery(
          'UPDATE workspaces SET trial_ends_at = NULL WHERE id = ?',
          [workspaceId]
        );
      }

      const [updated] = await dbQuery(
        'SELECT id, name, slug, trial_ends_at, subscription_id, status FROM workspaces WHERE id = ?',
        [workspaceId]
      );

      res.json({
        success: true,
        message: 'Trial end date updated',
        data: updated,
      });
    } catch (error) {
      console.error('Error updating trial:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update trial end date',
      });
    }
  }
);

module.exports = router;
