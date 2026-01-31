const express = require('express');
const { body, validationResult, query } = require('express-validator');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { checkProjectAvailable } = require('../../utils/pmProjectCheck');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Get or create chat room for a workspace
router.get('/workspace/:workspaceId/room', authorizePermission('pm_chat', 'view'), async (req, res) => {
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

    const projectCheck = await checkProjectAvailable(workspaceId);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Get or create chat room
    let [chatRoom] = await dbQuery(
      'SELECT * FROM pm_chat_rooms WHERE workspace_id = ?',
      [workspaceId]
    );

    if (!chatRoom) {
      // Get workspace info
      const [workspace] = await dbQuery(
        'SELECT * FROM pm_workspaces WHERE id = ?',
        [workspaceId]
      );

      // Create chat room
      const result = await dbQuery(
        `INSERT INTO pm_chat_rooms (workspace_id, project_id, name, created_by)
         VALUES (?, ?, ?, ?)`,
        [
          workspaceId,
          workspace.project_id || null,
          workspace.name ? `${workspace.name} Chat` : 'Project Chat',
          userId
        ]
      );

      const roomId = result.insertId;

      // Add all workspace members as participants
      await dbQuery(
        `INSERT INTO pm_chat_participants (chat_room_id, user_id)
         SELECT ?, wm.user_id
         FROM pm_workspace_members wm
         WHERE wm.workspace_id = ?
         UNION
         SELECT ?, w.created_by
         FROM pm_workspaces w
         WHERE w.id = ? AND w.created_by NOT IN (
           SELECT user_id FROM pm_workspace_members WHERE workspace_id = ?
         )`,
        [roomId, workspaceId, roomId, workspaceId, workspaceId]
      );

      [chatRoom] = await dbQuery(
        'SELECT * FROM pm_chat_rooms WHERE id = ?',
        [roomId]
      );
    }

    res.json({
      success: true,
      data: chatRoom
    });
  } catch (error) {
    console.error('Error getting chat room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get chat room'
    });
  }
});

// Get chat messages
router.get('/room/:roomId/messages', authorizePermission('pm_chat', 'view'), [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('before').optional().isInt().withMessage('Before must be a valid message ID'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const roomId = req.params.roomId;
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before ? parseInt(req.query.before) : null;

    // Check if user is a participant
    const [participant] = await dbQuery(
      `SELECT cp.* 
       FROM pm_chat_participants cp
       INNER JOIN pm_chat_rooms cr ON cp.chat_room_id = cr.id
       WHERE cp.chat_room_id = ? AND cp.user_id = ?
       UNION
       SELECT cp.*
       FROM pm_chat_participants cp
       INNER JOIN pm_chat_rooms cr ON cp.chat_room_id = cr.id
       INNER JOIN pm_workspaces w ON cr.workspace_id = w.id
       WHERE cp.chat_room_id = ? AND w.created_by = ?`,
      [roomId, userId, roomId, userId]
    );

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this chat room.'
      });
    }

    // Build query
    let query = `
      SELECT 
        m.*,
        u.id as user_id,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar as user_avatar,
        COUNT(DISTINCT mr.id) as read_count,
        MAX(CASE WHEN mr.user_id = ? THEN 1 ELSE 0 END) as is_read_by_me
      FROM pm_chat_messages m
      INNER JOIN users u ON m.user_id = u.id
      LEFT JOIN pm_chat_message_reads mr ON m.id = mr.message_id
      WHERE m.chat_room_id = ?
    `;
    const params = [userId, roomId];

    if (before) {
      query += ' AND m.id < ?';
      params.push(before);
    }

    query += ' GROUP BY m.id ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    const messages = await dbQuery(query, params);

    // Reverse to get chronological order
    messages.reverse();

    res.json({
      success: true,
      data: messages.map(msg => ({
        id: msg.id,
        chat_room_id: msg.chat_room_id,
        user_id: msg.user_id,
        user_name: msg.user_name,
        user_email: msg.user_email,
        user_avatar: msg.user_avatar,
        message: msg.message,
        mentions: msg.mentions ? JSON.parse(msg.mentions) : [],
        is_system_message: Boolean(msg.is_system_message),
        parent_message_id: msg.parent_message_id,
        created_at: msg.created_at,
        updated_at: msg.updated_at,
        read_count: parseInt(msg.read_count),
        is_read_by_me: Boolean(msg.is_read_by_me)
      }))
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

// Send message
router.post('/room/:roomId/messages', authorizePermission('pm_chat', 'create'), [
  body('message').trim().notEmpty().withMessage('Message is required'),
  body('message').isLength({ max: 5000 }).withMessage('Message must not exceed 5000 characters'),
  body('mentions').optional().isArray().withMessage('Mentions must be an array'),
  body('mentions.*').optional().isInt().withMessage('Each mention must be a valid user ID'),
  body('parent_message_id').optional().isInt().withMessage('Parent message ID must be a valid integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const roomId = req.params.roomId;
    const userId = req.user.id;
    const { message, mentions = [], parent_message_id } = req.body;

    // Check if user is a participant
    const [participant] = await dbQuery(
      `SELECT cp.* 
       FROM pm_chat_participants cp
       WHERE cp.chat_room_id = ? AND cp.user_id = ?
       UNION
       SELECT cp.*
       FROM pm_chat_participants cp
       INNER JOIN pm_chat_rooms cr ON cp.chat_room_id = cr.id
       INNER JOIN pm_workspaces w ON cr.workspace_id = w.id
       WHERE cp.chat_room_id = ? AND w.created_by = ?`,
      [roomId, userId, roomId, userId]
    );

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this chat room.'
      });
    }

    const [chatRoomForCheck] = await dbQuery(
      'SELECT workspace_id FROM pm_chat_rooms WHERE id = ?',
      [roomId]
    );
    if (chatRoomForCheck) {
      const projectCheck = await checkProjectAvailable(chatRoomForCheck.workspace_id);
      if (projectCheck) {
        return res.status(projectCheck.status).json({
          success: false,
          message: projectCheck.message
        });
      }
    }

    // Validate mentions - ensure all mentioned users are workspace members
    if (mentions && mentions.length > 0) {
      const [chatRoom] = await dbQuery(
        'SELECT workspace_id FROM pm_chat_rooms WHERE id = ?',
        [roomId]
      );

      // Build query for valid mentions
      const mentionPlaceholders = mentions.map(() => '?').join(',');
      const mentionParams = [chatRoom.workspace_id, ...mentions, chatRoom.workspace_id, ...mentions, chatRoom.workspace_id];
      
      const validMentionsResult = await dbQuery(
        `SELECT DISTINCT user_id
         FROM pm_workspace_members
         WHERE workspace_id = ? AND user_id IN (${mentionPlaceholders})
         UNION
         SELECT created_by as user_id
         FROM pm_workspaces
         WHERE id = ? AND created_by IN (${mentionPlaceholders})
         AND created_by NOT IN (
           SELECT user_id FROM pm_workspace_members WHERE workspace_id = ?
         )`,
        mentionParams
      );

      // Ensure validMentions is always an array
      const validMentions = Array.isArray(validMentionsResult) ? validMentionsResult : [];
      const validMentionIds = validMentions.map(m => m.user_id);
      const invalidMentions = mentions.filter(id => !validMentionIds.includes(id));

      if (invalidMentions.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Some mentioned users are not workspace members',
          invalid_mentions: invalidMentions
        });
      }
    }

    // Validate parent message if provided
    if (parent_message_id) {
      const [parentMessage] = await dbQuery(
        'SELECT id FROM pm_chat_messages WHERE id = ? AND chat_room_id = ?',
        [parent_message_id, roomId]
      );

      if (!parentMessage) {
        return res.status(404).json({
          success: false,
          message: 'Parent message not found'
        });
      }
    }

    // Insert message
    const result = await dbQuery(
      `INSERT INTO pm_chat_messages (chat_room_id, user_id, message, mentions, parent_message_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        roomId,
        userId,
        message,
        mentions && mentions.length > 0 ? JSON.stringify(mentions) : null,
        parent_message_id || null
      ]
    );

    const messageId = result.insertId;

    // Mark as read by sender
    await dbQuery(
      'INSERT IGNORE INTO pm_chat_message_reads (message_id, user_id) VALUES (?, ?)',
      [messageId, userId]
    );

    // Get created message with user info
    const [createdMessage] = await dbQuery(
      `SELECT 
        m.*,
        u.id as user_id,
        u.full_name as user_name,
        u.email as user_email,
        u.avatar as user_avatar
       FROM pm_chat_messages m
       INNER JOIN users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: {
        id: createdMessage.id,
        chat_room_id: createdMessage.chat_room_id,
        user_id: createdMessage.user_id,
        user_name: createdMessage.user_name,
        user_email: createdMessage.user_email,
        user_avatar: createdMessage.user_avatar,
        message: createdMessage.message,
        mentions: createdMessage.mentions ? JSON.parse(createdMessage.mentions) : [],
        is_system_message: Boolean(createdMessage.is_system_message),
        parent_message_id: createdMessage.parent_message_id,
        created_at: createdMessage.created_at,
        updated_at: createdMessage.updated_at,
        read_count: 1,
        is_read_by_me: true
      }
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

// Mark messages as read
router.post('/room/:roomId/messages/read', authorizePermission('pm_chat', 'view'), [
  body('message_ids').isArray().withMessage('Message IDs must be an array'),
  body('message_ids.*').isInt().withMessage('Each message ID must be a valid integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }

    const roomId = req.params.roomId;
    const userId = req.user.id;
    const { message_ids } = req.body;

    // Check if user is a participant
    const [participant] = await dbQuery(
      `SELECT cp.* 
       FROM pm_chat_participants cp
       WHERE cp.chat_room_id = ? AND cp.user_id = ?
       UNION
       SELECT cp.*
       FROM pm_chat_participants cp
       INNER JOIN pm_chat_rooms cr ON cp.chat_room_id = cr.id
       INNER JOIN pm_workspaces w ON cr.workspace_id = w.id
       WHERE cp.chat_room_id = ? AND w.created_by = ?`,
      [roomId, userId, roomId, userId]
    );

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this chat room.'
      });
    }

    let filteredMessageIds = Array.isArray(message_ids) ? message_ids : [];
    let invalidIds = [];

    // Validate message IDs belong to this room (filter invalid IDs instead of failing)
    if (filteredMessageIds.length > 0) {
      const placeholders = filteredMessageIds.map(() => '?').join(',');
      const validMessages = await dbQuery(
        `SELECT id FROM pm_chat_messages 
         WHERE id IN (${placeholders}) AND chat_room_id = ?`,
        [...filteredMessageIds, roomId]
      );

      const validIds = validMessages.map((m) => m.id);
      invalidIds = filteredMessageIds.filter((id) => !validIds.includes(id));
      filteredMessageIds = filteredMessageIds.filter((id) => validIds.includes(id));
    }

    // Mark as read (ignore invalid IDs but always update last_read_at)
    if (filteredMessageIds.length > 0) {
      const placeholders = filteredMessageIds.map(() => '(?, ?)').join(',');
      const values = filteredMessageIds.flatMap(id => [id, userId]);
      
      await dbQuery(
        `INSERT IGNORE INTO pm_chat_message_reads (message_id, user_id) 
         VALUES ${placeholders}`,
        values
      );
    }

    // Update participant's last_read_at (always)
    await dbQuery(
      'UPDATE pm_chat_participants SET last_read_at = NOW() WHERE chat_room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    res.json({
      success: true,
      message: 'Messages marked as read',
      ignored_message_ids: invalidIds
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark messages as read'
    });
  }
});

// Get workspace members for mentions
router.get('/workspace/:workspaceId/members', authorizePermission('pm_chat', 'view'), async (req, res) => {
  try {
    const workspaceId = req.params.workspaceId;
    const userId = req.user.id;
    const { search = '' } = req.query;

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

    // Get workspace members
    let searchTerm = search ? `%${search}%` : null;
    const params = [workspaceId];

    let memberQuery = `
      SELECT DISTINCT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.avatar,
        wm.role as workspace_role
       FROM pm_workspace_members wm
       INNER JOIN users u ON wm.user_id = u.id
       WHERE wm.workspace_id = ?
    `;

    if (searchTerm) {
      memberQuery += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    memberQuery += `
       UNION
       SELECT DISTINCT
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.avatar,
        'owner' as workspace_role
       FROM pm_workspaces w
       INNER JOIN users u ON w.created_by = u.id
       WHERE w.id = ? AND w.created_by NOT IN (
         SELECT user_id FROM pm_workspace_members WHERE workspace_id = ?
       )
    `;

    params.push(workspaceId, workspaceId);

    if (searchTerm) {
      memberQuery += ` AND (u.full_name LIKE ? OR u.email LIKE ? OR u.username LIKE ?)`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    memberQuery += ` ORDER BY full_name ASC LIMIT 50`;

    const members = await dbQuery(memberQuery, params);

    res.json({
      success: true,
      data: members
    });
  } catch (error) {
    console.error('Error fetching workspace members:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch workspace members'
    });
  }
});

// Get unread message count
router.get('/room/:roomId/unread-count', authorizePermission('pm_chat', 'view'), async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const userId = req.user.id;

    // Check if user is a participant
    const [participant] = await dbQuery(
      `SELECT cp.*, cp.last_read_at
       FROM pm_chat_participants cp
       WHERE cp.chat_room_id = ? AND cp.user_id = ?
       UNION
       SELECT cp.*, cp.last_read_at
       FROM pm_chat_participants cp
       INNER JOIN pm_chat_rooms cr ON cp.chat_room_id = cr.id
       INNER JOIN pm_workspaces w ON cr.workspace_id = w.id
       WHERE cp.chat_room_id = ? AND w.created_by = ?`,
      [roomId, userId, roomId, userId]
    );

    if (!participant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You are not a participant in this chat room.'
      });
    }

    // Count unread messages
    const [result] = await dbQuery(
      `SELECT COUNT(*) as unread_count
       FROM pm_chat_messages m
       WHERE m.chat_room_id = ?
       AND m.user_id != ?
       AND NOT EXISTS (
         SELECT 1 FROM pm_chat_message_reads mr
         WHERE mr.message_id = m.id AND mr.user_id = ?
       )
       ${participant.last_read_at ? 'AND m.created_at > ?' : ''}`,
      participant.last_read_at
        ? [roomId, userId, userId, participant.last_read_at]
        : [roomId, userId, userId]
    );

    res.json({
      success: true,
      data: {
        unread_count: parseInt(result.unread_count) || 0
      }
    });
  } catch (error) {
    console.error('Error getting unread count:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count'
    });
  }
});

module.exports = router;
