const express = require('express');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const { authenticateToken, authorizePermission } = require('../../middleware/auth');
const { query: dbQuery } = require('../../config/database');
const { checkProjectAvailable } = require('../../utils/pmProjectCheck');
const { logActivity } = require('../../utils/activityLogger');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Encryption key for API tokens (should be in .env)
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';

// Helper function to encrypt API token
const encryptToken = (text) => {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Error encrypting token:', error);
    throw new Error('Failed to encrypt token');
  }
};

// Helper function to decrypt API token
const decryptToken = (encryptedText) => {
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Error decrypting token:', error);
    throw new Error('Failed to decrypt token');
  }
};

// Get all CI/CD integrations for a workspace
router.get('/workspace/:workspaceId', authorizePermission('projects', 'view'), async (req, res) => {
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

    // Get integrations (don't return decrypted tokens)
    const integrations = await dbQuery(
      `SELECT 
        id,
        workspace_id,
        provider,
        name,
        api_url,
        webhook_url,
        is_active,
        created_by,
        created_at,
        updated_at
       FROM pm_ci_cd_integrations
       WHERE workspace_id = ?
       ORDER BY created_at DESC`,
      [workspaceId]
    );

    res.json({
      success: true,
      data: integrations
    });
  } catch (error) {
    console.error('Error fetching CI/CD integrations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CI/CD integrations'
    });
  }
});

// Get CI/CD integration by ID
router.get('/:id', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const integrationId = req.params.id;
    const userId = req.user.id;

    // Get integration
    const [integration] = await dbQuery(
      `SELECT 
        id,
        workspace_id,
        provider,
        name,
        api_url,
        webhook_url,
        is_active,
        created_by,
        created_at,
        updated_at
       FROM pm_ci_cd_integrations
       WHERE id = ?`,
      [integrationId]
    );

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'CI/CD integration not found'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [integration.workspace_id, userId, integration.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this integration.'
      });
    }

    res.json({
      success: true,
      data: integration
    });
  } catch (error) {
    console.error('Error fetching CI/CD integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CI/CD integration'
    });
  }
});

// Create CI/CD integration
router.post('/', authorizePermission('projects', 'create'), [
  body('workspace_id').isInt().withMessage('Workspace ID is required'),
  body('provider').isIn(['jenkins', 'github_actions', 'gitlab_ci', 'azure_devops']).withMessage('Invalid provider'),
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('api_url').optional().isURL().withMessage('API URL must be a valid URL'),
  body('api_token').optional().isString().withMessage('API token must be a string'),
  body('webhook_url').optional().isURL().withMessage('Webhook URL must be a valid URL'),
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

    const {
      workspace_id,
      provider,
      name,
      api_url,
      api_token,
      webhook_url,
      is_active = true
    } = req.body;
    const userId = req.user.id;

    // Check workspace access (only admin/owner can create integrations)
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin')
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [workspace_id, userId, workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can create CI/CD integrations.'
      });
    }

    // Encrypt API token if provided
    let encryptedToken = null;
    if (api_token) {
      encryptedToken = encryptToken(api_token);
    }

    // Create integration
    const result = await dbQuery(
      `INSERT INTO pm_ci_cd_integrations 
       (workspace_id, provider, name, api_url, api_token, webhook_url, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        workspace_id,
        provider,
        name,
        api_url || null,
        encryptedToken,
        webhook_url || null,
        is_active,
        userId
      ]
    );

    const integrationId = result.insertId;

    // Get created integration
    const [integration] = await dbQuery(
      `SELECT 
        id,
        workspace_id,
        provider,
        name,
        api_url,
        webhook_url,
        is_active,
        created_by,
        created_at,
        updated_at
       FROM pm_ci_cd_integrations
       WHERE id = ?`,
      [integrationId]
    );

    // Log activity
    await logActivity({
      workspace_id: workspace_id,
      entity_type: 'sprint', // Using sprint as entity type for workspace-level activities
      entity_id: workspace_id,
      action: 'ci_cd_integration_created',
      new_value: JSON.stringify({ provider, name }),
      performed_by: userId
    });

    res.status(201).json({
      success: true,
      message: 'CI/CD integration created successfully',
      data: integration
    });
  } catch (error) {
    console.error('Error creating CI/CD integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create CI/CD integration'
    });
  }
});

// Update CI/CD integration
router.put('/:id', authorizePermission('projects', 'edit'), [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('provider').optional().isIn(['jenkins', 'github_actions', 'gitlab_ci', 'azure_devops']).withMessage('Invalid provider'),
  body('api_url').optional().isURL().withMessage('API URL must be a valid URL'),
  body('api_token').optional().isString().withMessage('API token must be a string'),
  body('webhook_url').optional().isURL().withMessage('Webhook URL must be a valid URL'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
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

    const integrationId = req.params.id;
    const userId = req.user.id;
    const {
      name,
      provider,
      api_url,
      api_token,
      webhook_url,
      is_active
    } = req.body;

    // Get existing integration
    const [existingIntegration] = await dbQuery(
      'SELECT * FROM pm_ci_cd_integrations WHERE id = ?',
      [integrationId]
    );

    if (!existingIntegration) {
      return res.status(404).json({
        success: false,
        message: 'CI/CD integration not found'
      });
    }

    // Check workspace access (only admin/owner can update)
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role IN ('owner', 'admin')
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [existingIntegration.workspace_id, userId, existingIntegration.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners and admins can update CI/CD integrations.'
      });
    }

    const projectCheck = await checkProjectAvailable(existingIntegration.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(name);
    }
    if (provider !== undefined) {
      updateFields.push('provider = ?');
      updateValues.push(provider);
    }
    if (api_url !== undefined) {
      updateFields.push('api_url = ?');
      updateValues.push(api_url || null);
    }
    if (api_token !== undefined) {
      // Encrypt new token if provided
      const encryptedToken = api_token ? encryptToken(api_token) : null;
      updateFields.push('api_token = ?');
      updateValues.push(encryptedToken);
    }
    if (webhook_url !== undefined) {
      updateFields.push('webhook_url = ?');
      updateValues.push(webhook_url || null);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(integrationId);
    await dbQuery(
      `UPDATE pm_ci_cd_integrations 
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateValues
    );

    // Get updated integration
    const [integration] = await dbQuery(
      `SELECT 
        id,
        workspace_id,
        provider,
        name,
        api_url,
        webhook_url,
        is_active,
        created_by,
        created_at,
        updated_at
       FROM pm_ci_cd_integrations
       WHERE id = ?`,
      [integrationId]
    );

    // Log activity
    await logActivity({
      workspace_id: existingIntegration.workspace_id,
      entity_type: 'sprint',
      entity_id: existingIntegration.workspace_id,
      action: 'ci_cd_integration_updated',
      new_value: JSON.stringify({ name: name || existingIntegration.name }),
      performed_by: userId
    });

    res.json({
      success: true,
      message: 'CI/CD integration updated successfully',
      data: integration
    });
  } catch (error) {
    console.error('Error updating CI/CD integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update CI/CD integration'
    });
  }
});

// Delete CI/CD integration
router.delete('/:id', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const integrationId = req.params.id;
    const userId = req.user.id;

    // Get existing integration
    const [existingIntegration] = await dbQuery(
      'SELECT * FROM pm_ci_cd_integrations WHERE id = ?',
      [integrationId]
    );

    if (!existingIntegration) {
      return res.status(404).json({
        success: false,
        message: 'CI/CD integration not found'
      });
    }

    // Check workspace access (only owner can delete)
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ? AND wm.role = 'owner'
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [existingIntegration.workspace_id, userId, existingIntegration.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only workspace owners can delete CI/CD integrations.'
      });
    }

    const projectCheck = await checkProjectAvailable(existingIntegration.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Log activity before deletion
    await logActivity({
      workspace_id: existingIntegration.workspace_id,
      entity_type: 'sprint',
      entity_id: existingIntegration.workspace_id,
      action: 'ci_cd_integration_deleted',
      old_value: JSON.stringify({ name: existingIntegration.name }),
      performed_by: userId
    });

    // Delete integration (cascade will delete task links)
    await dbQuery('DELETE FROM pm_ci_cd_integrations WHERE id = ?', [integrationId]);

    res.json({
      success: true,
      message: 'CI/CD integration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting CI/CD integration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete CI/CD integration'
    });
  }
});

// Get CI/CD links for a task
router.get('/task/:taskId/links', authorizePermission('projects', 'view'), async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const userId = req.user.id;

    // Get task and workspace
    const [task] = await dbQuery(
      `SELECT t.*, us.workspace_id
       FROM pm_tasks t
       LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [task.workspace_id, userId, task.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this task.'
      });
    }

    // Get CI/CD links for this task
    const links = await dbQuery(
      `SELECT 
        l.*,
        i.provider,
        i.name as integration_name
       FROM pm_task_ci_cd_links l
       LEFT JOIN pm_ci_cd_integrations i ON l.integration_id = i.id
       WHERE l.task_id = ?
       ORDER BY l.last_updated DESC`,
      [taskId]
    );

    res.json({
      success: true,
      data: links
    });
  } catch (error) {
    console.error('Error fetching CI/CD links:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch CI/CD links'
    });
  }
});

// Create CI/CD link for a task
router.post('/task/:taskId/links', authorizePermission('projects', 'create'), [
  body('integration_id').isInt().withMessage('Integration ID is required'),
  body('build_id').optional().isString().withMessage('Build ID must be a string'),
  body('build_url').optional().isURL().withMessage('Build URL must be a valid URL'),
  body('build_status').optional().isIn(['pending', 'running', 'success', 'failed', 'cancelled']).withMessage('Invalid build status'),
  body('deployment_status').optional().isIn(['not_deployed', 'deploying', 'deployed', 'failed']).withMessage('Invalid deployment status'),
  body('environment').optional().isString().withMessage('Environment must be a string'),
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

    const taskId = req.params.taskId;
    const userId = req.user.id;
    const {
      integration_id,
      build_id,
      build_url,
      build_status = 'pending',
      deployment_status = 'not_deployed',
      environment
    } = req.body;

    // Get task and workspace
    const [task] = await dbQuery(
      `SELECT t.*, us.workspace_id
       FROM pm_tasks t
       LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
       WHERE t.id = ?`,
      [taskId]
    );

    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }

    // Verify integration belongs to same workspace
    const [integration] = await dbQuery(
      'SELECT workspace_id FROM pm_ci_cd_integrations WHERE id = ?',
      [integration_id]
    );

    if (!integration || integration.workspace_id !== task.workspace_id) {
      return res.status(400).json({
        success: false,
        message: 'Integration does not belong to the same workspace as the task'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [task.workspace_id, userId, task.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this workspace.'
      });
    }

    const projectCheck = await checkProjectAvailable(task.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Create link
    const result = await dbQuery(
      `INSERT INTO pm_task_ci_cd_links 
       (task_id, integration_id, build_id, build_url, build_status, deployment_status, environment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        integration_id,
        build_id || null,
        build_url || null,
        build_status,
        deployment_status,
        environment || null
      ]
    );

    const linkId = result.insertId;

    // Get created link
    const [link] = await dbQuery(
      `SELECT 
        l.*,
        i.provider,
        i.name as integration_name
       FROM pm_task_ci_cd_links l
       LEFT JOIN pm_ci_cd_integrations i ON l.integration_id = i.id
       WHERE l.id = ?`,
      [linkId]
    );

    // Log activity
    await logActivity({
      workspace_id: task.workspace_id,
      entity_type: 'task',
      entity_id: taskId,
      action: 'ci_cd_link_created',
      new_value: JSON.stringify({ build_id, build_status }),
      performed_by: userId
    });

    res.status(201).json({
      success: true,
      message: 'CI/CD link created successfully',
      data: link
    });
  } catch (error) {
    console.error('Error creating CI/CD link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create CI/CD link'
    });
  }
});

// Update CI/CD link
router.put('/links/:linkId', authorizePermission('projects', 'edit'), [
  body('build_id').optional().isString().withMessage('Build ID must be a string'),
  body('build_url').optional().isURL().withMessage('Build URL must be a valid URL'),
  body('build_status').optional().isIn(['pending', 'running', 'success', 'failed', 'cancelled']).withMessage('Invalid build status'),
  body('deployment_status').optional().isIn(['not_deployed', 'deploying', 'deployed', 'failed']).withMessage('Invalid deployment status'),
  body('environment').optional().isString().withMessage('Environment must be a string'),
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

    const linkId = req.params.linkId;
    const userId = req.user.id;
    const {
      build_id,
      build_url,
      build_status,
      deployment_status,
      environment
    } = req.body;

    // Get existing link
    const [existingLink] = await dbQuery(
      `SELECT l.*, us.workspace_id
       FROM pm_task_ci_cd_links l
       LEFT JOIN pm_tasks t ON l.task_id = t.id
       LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
       WHERE l.id = ?`,
      [linkId]
    );

    if (!existingLink) {
      return res.status(404).json({
        success: false,
        message: 'CI/CD link not found'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [existingLink.workspace_id, userId, existingLink.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this link.'
      });
    }

    // Build update query
    const updateFields = [];
    const updateValues = [];

    if (build_id !== undefined) {
      updateFields.push('build_id = ?');
      updateValues.push(build_id || null);
    }
    if (build_url !== undefined) {
      updateFields.push('build_url = ?');
      updateValues.push(build_url || null);
    }
    if (build_status !== undefined) {
      updateFields.push('build_status = ?');
      updateValues.push(build_status);
    }
    if (deployment_status !== undefined) {
      updateFields.push('deployment_status = ?');
      updateValues.push(deployment_status);
    }
    if (environment !== undefined) {
      updateFields.push('environment = ?');
      updateValues.push(environment || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(linkId);
    await dbQuery(
      `UPDATE pm_task_ci_cd_links 
       SET ${updateFields.join(', ')}
       WHERE id = ?`,
      updateValues
    );

    // Get updated link
    const [link] = await dbQuery(
      `SELECT 
        l.*,
        i.provider,
        i.name as integration_name
       FROM pm_task_ci_cd_links l
       LEFT JOIN pm_ci_cd_integrations i ON l.integration_id = i.id
       WHERE l.id = ?`,
      [linkId]
    );

    // Log activity if status changed
    if (build_status !== undefined && build_status !== existingLink.build_status) {
      await logActivity({
        workspace_id: existingLink.workspace_id,
        entity_type: 'task',
        entity_id: existingLink.task_id,
        action: 'ci_cd_status_changed',
        old_value: existingLink.build_status,
        new_value: build_status,
        performed_by: userId
      });
    }

    res.json({
      success: true,
      message: 'CI/CD link updated successfully',
      data: link
    });
  } catch (error) {
    console.error('Error updating CI/CD link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update CI/CD link'
    });
  }
});

// Delete CI/CD link
router.delete('/links/:linkId', authorizePermission('projects', 'delete'), async (req, res) => {
  try {
    const linkId = req.params.linkId;
    const userId = req.user.id;

    // Get existing link
    const [existingLink] = await dbQuery(
      `SELECT l.*, us.workspace_id
       FROM pm_task_ci_cd_links l
       LEFT JOIN pm_tasks t ON l.task_id = t.id
       LEFT JOIN pm_user_stories us ON t.user_story_id = us.id
       WHERE l.id = ?`,
      [linkId]
    );

    if (!existingLink) {
      return res.status(404).json({
        success: false,
        message: 'CI/CD link not found'
      });
    }

    // Check workspace access
    const [workspaceAccess] = await dbQuery(
      `SELECT wm.role 
       FROM pm_workspace_members wm
       WHERE wm.workspace_id = ? AND wm.user_id = ?
       UNION
       SELECT 'owner' as role
       FROM pm_workspaces w
       WHERE w.id = ? AND w.created_by = ?`,
      [existingLink.workspace_id, userId, existingLink.workspace_id, userId]
    );

    if (!workspaceAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. You do not have access to this link.'
      });
    }

    const projectCheck = await checkProjectAvailable(existingLink.workspace_id);
    if (projectCheck) {
      return res.status(projectCheck.status).json({
        success: false,
        message: projectCheck.message
      });
    }

    // Delete link
    await dbQuery('DELETE FROM pm_task_ci_cd_links WHERE id = ?', [linkId]);

    res.json({
      success: true,
      message: 'CI/CD link deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting CI/CD link:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete CI/CD link'
    });
  }
});

// Webhook endpoint for CI/CD status updates
router.post('/webhook/:integrationId', async (req, res) => {
  try {
    const integrationId = req.params.integrationId;
    const webhookData = req.body;

    // Get integration
    const [integration] = await dbQuery(
      'SELECT * FROM pm_ci_cd_integrations WHERE id = ? AND is_active = 1',
      [integrationId]
    );

    if (!integration) {
      return res.status(404).json({
        success: false,
        message: 'Integration not found or inactive'
      });
    }

    // Parse webhook data based on provider
    let buildId, buildUrl, buildStatus, deploymentStatus, environment, taskId;

    switch (integration.provider) {
      case 'github_actions':
        // GitHub Actions webhook format
        buildId = webhookData.workflow_run?.id || webhookData.run_id;
        buildUrl = webhookData.workflow_run?.html_url || webhookData.html_url;
        buildStatus = mapGitHubStatus(webhookData.workflow_run?.status, webhookData.workflow_run?.conclusion);
        taskId = extractTaskIdFromWebhook(webhookData);
        break;

      case 'gitlab_ci':
        // GitLab CI webhook format
        buildId = webhookData.build_id || webhookData.object_attributes?.id;
        buildUrl = webhookData.build_url || webhookData.object_attributes?.url;
        buildStatus = mapGitLabStatus(webhookData.build_status || webhookData.object_attributes?.status);
        taskId = extractTaskIdFromWebhook(webhookData);
        break;

      case 'jenkins':
        // Jenkins webhook format
        buildId = webhookData.build?.number || webhookData.number;
        buildUrl = webhookData.build?.url || webhookData.url;
        buildStatus = mapJenkinsStatus(webhookData.build?.status || webhookData.status);
        taskId = extractTaskIdFromWebhook(webhookData);
        break;

      case 'azure_devops':
        // Azure DevOps webhook format
        buildId = webhookData.resource?.id || webhookData.id;
        buildUrl = webhookData.resource?.url || webhookData.url;
        buildStatus = mapAzureStatus(webhookData.resource?.status || webhookData.status);
        taskId = extractTaskIdFromWebhook(webhookData);
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Unsupported provider'
        });
    }

    if (!buildId || !taskId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required webhook data (build_id or task_id)'
      });
    }

    // Find or create CI/CD link
    const [existingLink] = await dbQuery(
      'SELECT * FROM pm_task_ci_cd_links WHERE task_id = ? AND integration_id = ? AND build_id = ?',
      [taskId, integrationId, String(buildId)]
    );

    if (existingLink) {
      // Update existing link
      await dbQuery(
        `UPDATE pm_task_ci_cd_links 
         SET build_url = ?, build_status = ?, deployment_status = ?, last_updated = NOW()
         WHERE id = ?`,
        [
          buildUrl || existingLink.build_url,
          buildStatus || existingLink.build_status,
          deploymentStatus || existingLink.deployment_status,
          existingLink.id
        ]
      );
    } else {
      // Create new link
      await dbQuery(
        `INSERT INTO pm_task_ci_cd_links 
         (task_id, integration_id, build_id, build_url, build_status, deployment_status, environment)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          taskId,
          integrationId,
          String(buildId),
          buildUrl,
          buildStatus || 'pending',
          deploymentStatus || 'not_deployed',
          environment || null
        ]
      );
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook'
    });
  }
});

// Helper functions for webhook parsing
function mapGitHubStatus(status, conclusion) {
  if (status === 'queued' || status === 'in_progress') return 'running';
  if (conclusion === 'success') return 'success';
  if (conclusion === 'failure' || conclusion === 'cancelled') return 'failed';
  return 'pending';
}

function mapGitLabStatus(status) {
  const statusMap = {
    'pending': 'pending',
    'running': 'running',
    'success': 'success',
    'failed': 'failed',
    'canceled': 'cancelled'
  };
  return statusMap[status?.toLowerCase()] || 'pending';
}

function mapJenkinsStatus(status) {
  const statusMap = {
    'success': 'success',
    'failure': 'failed',
    'unstable': 'failed',
    'aborted': 'cancelled',
    'in_progress': 'running'
  };
  return statusMap[status?.toLowerCase()] || 'pending';
}

function mapAzureStatus(status) {
  const statusMap = {
    'completed': 'success',
    'failed': 'failed',
    'canceled': 'cancelled',
    'inProgress': 'running'
  };
  return statusMap[status] || 'pending';
}

function extractTaskIdFromWebhook(webhookData) {
  // Try to extract task ID from commit message, branch name, or PR title
  // Format: "TASK-123" or "#123" or "task:123"
  const sources = [
    webhookData.head_commit?.message,
    webhookData.commit?.message,
    webhookData.pull_request?.title,
    webhookData.merge_request?.title,
    webhookData.ref,
    webhookData.branch
  ].filter(Boolean).join(' ');

  const taskIdMatch = sources.match(/(?:TASK-|#|task:)(\d+)/i);
  return taskIdMatch ? parseInt(taskIdMatch[1]) : null;
}

module.exports = router;
