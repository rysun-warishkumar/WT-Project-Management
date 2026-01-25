-- =====================================================
-- COMPLETE DATABASE SCHEMA
-- Client & Project Management System
-- =====================================================
-- This file contains the complete database schema including:
-- 1. Core Client Management tables
-- 2. Role-Based Access Control tables
-- 3. Project Management System tables
-- 4. Chat System tables
-- 5. All migrations and updates
-- =====================================================

-- Create database
CREATE DATABASE IF NOT EXISTS client_management;
USE client_management;

-- =====================================================
-- SECTION 1: CORE CLIENT MANAGEMENT TABLES
-- =====================================================

-- Users table (Admin users)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    role ENUM('admin', 'po', 'manager', 'accountant', 'client', 'viewer') DEFAULT 'viewer',
    client_id INT NULL,
    avatar VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
    INDEX idx_users_client_id (client_id),
    INDEX idx_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_name VARCHAR(100),
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    whatsapp VARCHAR(20),
    business_type VARCHAR(50),
    gst_number VARCHAR(20),
    tax_id VARCHAR(50),
    address TEXT,
    city VARCHAR(50),
    state VARCHAR(50),
    country VARCHAR(50),
    postal_code VARCHAR(20),
    tags JSON,
    onboarding_date DATE,
    status ENUM('active', 'inactive', 'prospect') DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clients_email (email),
    INDEX idx_clients_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    client_id INT NOT NULL,
    status ENUM('planning', 'in_progress', 'review', 'completed', 'on_hold', 'cancelled') DEFAULT 'planning',
    type ENUM('website', 'ecommerce', 'mobile_app', 'web_app', 'design', 'consulting', 'maintenance', 'other') NOT NULL,
    technology_stack JSON,
    description TEXT,
    business_nature TEXT,
    start_date DATE,
    end_date DATE,
    admin_url VARCHAR(255),
    delivery_link VARCHAR(255),
    budget DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    INDEX idx_projects_client_id (client_id),
    INDEX idx_projects_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quotations table
CREATE TABLE IF NOT EXISTS quotations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quote_number VARCHAR(50) UNIQUE NOT NULL,
    client_id INT NOT NULL,
    project_id INT,
    quote_date DATE NOT NULL,
    valid_till_date DATE,
    status ENUM('draft', 'sent', 'accepted', 'declined', 'expired') DEFAULT 'draft',
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    notes TEXT,
    terms_conditions TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_quotations_client_id (client_id),
    INDEX idx_quotations_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quotation items table
CREATE TABLE IF NOT EXISTS quotation_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    quotation_id INT NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    quotation_id INT,
    client_id INT NOT NULL,
    project_id INT,
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled') DEFAULT 'draft',
    subtotal DECIMAL(10,2) DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) DEFAULT 0,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    payment_date DATETIME,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_invoices_client_id (client_id),
    INDEX idx_invoices_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    item_name VARCHAR(200) NOT NULL,
    description TEXT,
    quantity INT DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    invoice_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    payment_date DATE NOT NULL,
    reference_number VARCHAR(100),
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_payments_invoice_id (invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Files table
CREATE TABLE IF NOT EXISTS files (
    id INT PRIMARY KEY AUTO_INCREMENT,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100),
    file_type ENUM('document', 'image', 'archive', 'other') DEFAULT 'other',
    client_id INT,
    project_id INT,
    uploaded_by INT NOT NULL,
    description TEXT,
    tags JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_files_client_id (client_id),
    INDEX idx_files_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Credentials table
CREATE TABLE IF NOT EXISTS credentials (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    client_id INT,
    project_id INT,
    credential_type ENUM('admin_panel', 'hosting', 'domain', 'ftp', 'database', 'api', 'other') NOT NULL,
    url VARCHAR(500),
    ip_address VARCHAR(45),
    username VARCHAR(100),
    email VARCHAR(100),
    password VARCHAR(255) NOT NULL,
    notes TEXT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    client_id INT NOT NULL,
    project_id INT,
    conversation_type ENUM('email', 'call', 'meeting', 'chat', 'note') DEFAULT 'note',
    subject VARCHAR(200),
    message TEXT NOT NULL,
    direction ENUM('inbound', 'outbound', 'internal') DEFAULT 'internal',
    is_important BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conversations_client_id (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error', 'reminder') DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    related_type ENUM('client', 'project', 'invoice', 'quotation', 'general') DEFAULT 'general',
    related_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_id (user_id),
    INDEX idx_notifications_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_values JSON,
    new_values JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SECTION 2: ROLE-BASED ACCESS CONTROL TABLES
-- =====================================================

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    module VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_module_action (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE KEY unique_role_permission (role_id, permission_id),
    INDEX idx_role_permissions_role_id (role_id),
    INDEX idx_role_permissions_permission_id (permission_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User roles junction table (for users with multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_role (user_id, role_id),
    INDEX idx_user_roles_user_id (user_id),
    INDEX idx_user_roles_role_id (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User projects junction table (for assigning projects to users)
CREATE TABLE IF NOT EXISTS user_projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    project_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_project (user_id, project_id),
    INDEX idx_user_projects_user_id (user_id),
    INDEX idx_user_projects_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SECTION 3: PROJECT MANAGEMENT SYSTEM TABLES
-- =====================================================

-- PM Workspaces
CREATE TABLE IF NOT EXISTS pm_workspaces (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  project_id INT,
  client_id INT,
  workspace_type ENUM('scrum', 'kanban', 'hybrid') DEFAULT 'scrum',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_project (project_id),
  INDEX idx_client (client_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Workspace Members
CREATE TABLE IF NOT EXISTS pm_workspace_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workspace_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member', 'viewer') DEFAULT 'member',
  capacity_hours_per_sprint INT DEFAULT 0,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES pm_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_member (workspace_id, user_id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Epics
CREATE TABLE IF NOT EXISTS pm_epics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reference_number VARCHAR(50) NOT NULL UNIQUE,
  workspace_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#3B82F6',
  status ENUM('active', 'completed', 'archived') DEFAULT 'active',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES pm_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status),
  INDEX idx_epic_reference (reference_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Sprints
CREATE TABLE IF NOT EXISTS pm_sprints (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workspace_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  status ENUM('planning', 'active', 'completed', 'cancelled') DEFAULT 'planning',
  capacity DECIMAL(10,2) DEFAULT 0,
  velocity DECIMAL(10,2) DEFAULT 0,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES pm_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_status (status),
  INDEX idx_dates (start_date, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM User Stories
CREATE TABLE IF NOT EXISTS pm_user_stories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reference_number VARCHAR(50) NOT NULL UNIQUE,
  workspace_id INT NOT NULL,
  epic_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  acceptance_criteria TEXT,
  story_points DECIMAL(5,2),
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  status ENUM('backlog', 'sprint', 'in_progress', 'testing', 'done', 'cancelled') DEFAULT 'backlog',
  sprint_id INT,
  assignee_id INT,
  labels JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES pm_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (epic_id) REFERENCES pm_epics(id) ON DELETE SET NULL,
  FOREIGN KEY (sprint_id) REFERENCES pm_sprints(id) ON DELETE SET NULL,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_epic (epic_id),
  INDEX idx_sprint (sprint_id),
  INDEX idx_status (status),
  INDEX idx_assignee (assignee_id),
  INDEX idx_user_story_reference (reference_number),
  FULLTEXT idx_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Tasks
CREATE TABLE IF NOT EXISTS pm_tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  reference_number VARCHAR(50) NOT NULL UNIQUE,
  user_story_id INT,
  parent_task_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('todo', 'in_progress', 'review', 'testing', 'done', 'blocked') DEFAULT 'todo',
  priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  estimated_hours DECIMAL(10,2),
  logged_hours DECIMAL(10,2) DEFAULT 0,
  assignee_id INT,
  due_date DATE,
  labels JSON,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_story_id) REFERENCES pm_user_stories(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_user_story (user_story_id),
  INDEX idx_parent_task (parent_task_id),
  INDEX idx_status (status),
  INDEX idx_assignee (assignee_id),
  INDEX idx_due_date (due_date),
  INDEX idx_task_reference (reference_number),
  FULLTEXT idx_search (title, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Task Links (Dependencies)
CREATE TABLE IF NOT EXISTS pm_task_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  source_task_id INT NOT NULL,
  target_task_id INT NOT NULL,
  link_type ENUM('blocks', 'blocked_by', 'relates_to', 'duplicates', 'clones') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (target_task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE,
  UNIQUE KEY unique_link (source_task_id, target_task_id, link_type),
  INDEX idx_source (source_task_id),
  INDEX idx_target (target_task_id),
  INDEX idx_type (link_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Comments
CREATE TABLE IF NOT EXISTS pm_comments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entity_type ENUM('user_story', 'task', 'epic') NOT NULL,
  entity_id INT NOT NULL,
  comment TEXT NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_by (created_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Attachments
CREATE TABLE IF NOT EXISTS pm_attachments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  comment_id INT,
  entity_type ENUM('user_story', 'task', 'epic') NOT NULL,
  entity_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT,
  mime_type VARCHAR(100),
  uploaded_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES pm_comments(id) ON DELETE CASCADE,
  FOREIGN KEY (uploaded_by) REFERENCES users(id),
  INDEX idx_comment (comment_id),
  INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Time Logs
CREATE TABLE IF NOT EXISTS pm_time_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  hours DECIMAL(10,2) NOT NULL,
  description TEXT,
  logged_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_task (task_id),
  INDEX idx_user (user_id),
  INDEX idx_date (logged_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Activities (Audit Log)
CREATE TABLE IF NOT EXISTS pm_activities (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workspace_id INT,
  entity_type ENUM('user_story', 'task', 'epic', 'sprint') NOT NULL,
  entity_id INT NOT NULL,
  action VARCHAR(100) NOT NULL,
  old_value TEXT,
  new_value TEXT,
  performed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES pm_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_performed_by (performed_by),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM CI/CD Integrations
CREATE TABLE IF NOT EXISTS pm_ci_cd_integrations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workspace_id INT NOT NULL,
  provider ENUM('jenkins', 'github_actions', 'gitlab_ci', 'azure_devops') NOT NULL,
  name VARCHAR(255) NOT NULL,
  api_url VARCHAR(500),
  api_token VARCHAR(500),
  webhook_url VARCHAR(500),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES pm_workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_workspace (workspace_id),
  INDEX idx_provider (provider)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Task CI/CD Links
CREATE TABLE IF NOT EXISTS pm_task_ci_cd_links (
  id INT PRIMARY KEY AUTO_INCREMENT,
  task_id INT NOT NULL,
  integration_id INT NOT NULL,
  build_id VARCHAR(255),
  build_url VARCHAR(500),
  build_status ENUM('pending', 'running', 'success', 'failed', 'cancelled') DEFAULT 'pending',
  deployment_status ENUM('not_deployed', 'deploying', 'deployed', 'failed') DEFAULT 'not_deployed',
  environment VARCHAR(100),
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES pm_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (integration_id) REFERENCES pm_ci_cd_integrations(id) ON DELETE CASCADE,
  INDEX idx_task (task_id),
  INDEX idx_integration (integration_id),
  INDEX idx_build_status (build_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Assignment History
CREATE TABLE IF NOT EXISTS pm_assignment_history (
  id INT PRIMARY KEY AUTO_INCREMENT,
  entity_type ENUM('user_story', 'task') NOT NULL,
  entity_id INT NOT NULL,
  assigned_to INT,
  assigned_by INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_by) REFERENCES users(id),
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_assigned_at (assigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SECTION 4: CHAT SYSTEM TABLES
-- =====================================================

-- PM Chat Rooms
CREATE TABLE IF NOT EXISTS pm_chat_rooms (
  id INT PRIMARY KEY AUTO_INCREMENT,
  workspace_id INT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES pm_workspaces(id) ON DELETE CASCADE,
  INDEX idx_workspace (workspace_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Chat Messages
CREATE TABLE IF NOT EXISTS pm_chat_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  chat_room_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  mentions JSON,
  parent_message_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_room_id) REFERENCES pm_chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_message_id) REFERENCES pm_chat_messages(id) ON DELETE SET NULL,
  INDEX idx_room (chat_room_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Chat Message Reads
CREATE TABLE IF NOT EXISTS pm_chat_message_reads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES pm_chat_messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_read (message_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PM Chat Participants
CREATE TABLE IF NOT EXISTS pm_chat_participants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  chat_room_id INT NOT NULL,
  user_id INT NOT NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_room_id) REFERENCES pm_chat_rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_participant (chat_room_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- SECTION 5: TRIGGERS
-- =====================================================

-- Auto-create chat room when workspace is created
DELIMITER //
CREATE TRIGGER IF NOT EXISTS after_pm_workspaces_insert
AFTER INSERT ON pm_workspaces
FOR EACH ROW
BEGIN
    INSERT INTO pm_chat_rooms (workspace_id) VALUES (NEW.id);
    INSERT INTO pm_chat_participants (chat_room_id, user_id)
    SELECT pcr.id, NEW.created_by
    FROM pm_chat_rooms pcr
    WHERE pcr.workspace_id = NEW.id
    ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at);
END//
DELIMITER ;

-- Auto-add chat participant when workspace member is added
DELIMITER //
CREATE TRIGGER IF NOT EXISTS after_pm_workspace_members_insert
AFTER INSERT ON pm_workspace_members
FOR EACH ROW
BEGIN
    INSERT INTO pm_chat_participants (chat_room_id, user_id)
    SELECT pcr.id, NEW.user_id
    FROM pm_chat_rooms pcr
    WHERE pcr.workspace_id = NEW.workspace_id
    ON DUPLICATE KEY UPDATE joined_at = VALUES(joined_at);
END//
DELIMITER ;

-- Auto-remove chat participant when workspace member is removed
DELIMITER //
CREATE TRIGGER IF NOT EXISTS after_pm_workspace_members_delete
AFTER DELETE ON pm_workspace_members
FOR EACH ROW
BEGIN
    DELETE FROM pm_chat_participants
    WHERE user_id = OLD.user_id AND chat_room_id IN (
        SELECT id FROM pm_chat_rooms WHERE workspace_id = OLD.workspace_id
    );
END//
DELIMITER ;

-- Update task logged_hours when time log is added
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_task_logged_hours_insert
AFTER INSERT ON pm_time_logs
FOR EACH ROW
BEGIN
  UPDATE pm_tasks 
  SET logged_hours = (
    SELECT COALESCE(SUM(hours), 0)
    FROM pm_time_logs
    WHERE task_id = NEW.task_id
  )
  WHERE id = NEW.task_id;
END//
DELIMITER ;

-- Update task logged_hours when time log is deleted
DELIMITER //
CREATE TRIGGER IF NOT EXISTS update_task_logged_hours_delete
AFTER DELETE ON pm_time_logs
FOR EACH ROW
BEGIN
  UPDATE pm_tasks 
  SET logged_hours = (
    SELECT COALESCE(SUM(hours), 0)
    FROM pm_time_logs
    WHERE task_id = OLD.task_id
  )
  WHERE id = OLD.task_id;
END//
DELIMITER ;

-- =====================================================
-- SECTION 6: DEFAULT DATA
-- =====================================================

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password, full_name, role) VALUES 
('admin', 'admin@example.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin')
ON DUPLICATE KEY UPDATE username = username;

-- Insert default roles
INSERT INTO roles (name, display_name, description, is_system_role) VALUES
('admin', 'Administrator', 'Full system access with all permissions', TRUE),
('po', 'Project Owner', 'Can manage projects, clients, and related resources', TRUE),
('manager', 'Manager', 'Can manage teams, projects, and view reports', TRUE),
('accountant', 'Accountant', 'Can manage invoices, payments, and financial data', TRUE),
('client', 'Client', 'Can view their own projects, invoices, and files', TRUE),
('viewer', 'Viewer', 'Read-only access to view data', TRUE)
ON DUPLICATE KEY UPDATE display_name = VALUES(display_name);

-- Insert default permissions for Client Management modules
INSERT INTO permissions (module, action, description) VALUES
-- Clients module
('clients', 'view', 'View clients'),
('clients', 'create', 'Create new clients'),
('clients', 'edit', 'Edit existing clients'),
('clients', 'delete', 'Delete clients'),
-- Projects module
('projects', 'view', 'View projects'),
('projects', 'create', 'Create new projects'),
('projects', 'edit', 'Edit existing projects'),
('projects', 'delete', 'Delete projects'),
-- Quotations module
('quotations', 'view', 'View quotations'),
('quotations', 'create', 'Create new quotations'),
('quotations', 'edit', 'Edit existing quotations'),
('quotations', 'delete', 'Delete quotations'),
-- Invoices module
('invoices', 'view', 'View invoices'),
('invoices', 'create', 'Create new invoices'),
('invoices', 'edit', 'Edit existing invoices'),
('invoices', 'delete', 'Delete invoices'),
('invoices', 'record_payment', 'Record payments against invoices'),
-- Files module
('files', 'view', 'View files'),
('files', 'upload', 'Upload files'),
('files', 'edit', 'Edit file metadata'),
('files', 'delete', 'Delete files'),
('files', 'download', 'Download files'),
-- Credentials module
('credentials', 'view', 'View credentials'),
('credentials', 'create', 'Create new credentials'),
('credentials', 'edit', 'Edit existing credentials'),
('credentials', 'delete', 'Delete credentials'),
-- Conversations module
('conversations', 'view', 'View conversations'),
('conversations', 'create', 'Create new conversations'),
('conversations', 'edit', 'Edit existing conversations'),
('conversations', 'delete', 'Delete conversations'),
-- Users module
('users', 'view', 'View users'),
('users', 'create', 'Create new users'),
('users', 'edit', 'Edit existing users'),
('users', 'delete', 'Delete users'),
-- Roles module
('roles', 'view', 'View roles and permissions'),
('roles', 'edit', 'Edit roles and permissions'),
-- Dashboard
('dashboard', 'view', 'View dashboard'),
-- Reports
('reports', 'view', 'View reports'),
-- PM Workspaces
('pm_workspaces', 'view', 'View workspaces'),
('pm_workspaces', 'create', 'Create workspaces'),
('pm_workspaces', 'edit', 'Edit workspace settings'),
('pm_workspaces', 'delete', 'Delete workspaces'),
-- PM User Stories
('pm_user_stories', 'view', 'View user stories'),
('pm_user_stories', 'create', 'Create user stories'),
('pm_user_stories', 'edit', 'Edit user stories'),
('pm_user_stories', 'delete', 'Delete user stories'),
-- PM Tasks
('pm_tasks', 'view', 'View tasks'),
('pm_tasks', 'create', 'Create tasks'),
('pm_tasks', 'edit', 'Edit tasks'),
('pm_tasks', 'delete', 'Delete tasks'),
-- PM Sprints
('pm_sprints', 'view', 'View sprints'),
('pm_sprints', 'create', 'Create sprints'),
('pm_sprints', 'edit', 'Edit sprints'),
('pm_sprints', 'delete', 'Delete sprints'),
-- PM Epics
('pm_epics', 'view', 'View epics'),
('pm_epics', 'create', 'Create epics'),
('pm_epics', 'edit', 'Edit epics'),
('pm_epics', 'delete', 'Delete epics'),
-- PM Comments
('pm_comments', 'view', 'View comments'),
('pm_comments', 'create', 'Create comments'),
('pm_comments', 'edit', 'Edit own comments'),
('pm_comments', 'delete', 'Delete own comments'),
-- PM Time Logs
('pm_time_logs', 'view', 'View time logs'),
('pm_time_logs', 'create', 'Log time'),
('pm_time_logs', 'edit', 'Edit time logs'),
('pm_time_logs', 'delete', 'Delete time logs'),
-- PM Attachments
('pm_attachments', 'view', 'View attachments'),
('pm_attachments', 'create', 'Upload attachments'),
('pm_attachments', 'delete', 'Delete attachments'),
-- PM Reports
('pm_reports', 'view', 'View PM reports'),
-- PM Settings
('pm_settings', 'view', 'View workspace settings'),
('pm_settings', 'edit', 'Edit workspace settings'),
-- PM Activity
('pm_activity', 'view', 'View activity feed'),
-- PM Chat
('pm_chat', 'view', 'View chat messages'),
('pm_chat', 'create', 'Send messages'),
('pm_chat', 'edit', 'Edit own messages'),
('pm_chat', 'delete', 'Delete own messages')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- Assign all permissions to Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'admin'
ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);

-- Assign permissions to other roles (see roles_permissions_schema.sql for details)
-- This is handled in the application logic based on role requirements

-- =====================================================
-- END OF SCHEMA
-- =====================================================
