# Client & Project Management System - Complete Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Installation & Setup](#installation--setup)
3. [Project Management System](#project-management-system)
4. [Role-Based Access Control](#role-based-access-control)
5. [Permissions Management](#permissions-management)
6. [Database Schema](#database-schema)
7. [API Documentation](#api-documentation)
8. [Development Guidelines](#development-guidelines)

---

## System Overview

A comprehensive admin dashboard for managing clients, projects, quotations, invoices, and business operations with integrated Agile Project Management capabilities.

### Core Modules
- **Dashboard**: Overview with key metrics and quick actions
- **Client Management**: Complete client information and communication history
- **Project Management**: Project tracking with status and deliverables
- **Quotations & Proposals**: Generate and manage client quotes
- **Invoices & Billing**: Complete billing cycle management
- **Files & Documents**: Secure file storage and management
- **Credentials**: Secure access credential storage
- **Conversations & Notes**: Client communication tracking
- **Users & Roles**: User management and role-based access control
- **Reports & Analytics**: Business insights and performance metrics
- **Project Management System**: Agile project management with user stories, tasks, sprints, and boards

### Technical Stack
- **Frontend**: React.js with Tailwind CSS
- **Backend**: Node.js/Express.js
- **Database**: MySQL (XAMPP)
- **Authentication**: JWT
- **File Storage**: Local filesystem
- **Email**: Nodemailer (SMTP)

---

## Installation & Setup

### Prerequisites
- Node.js (v16 or higher)
- XAMPP with MySQL
- Git

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd client-project-management
   ```

2. **Install dependencies**
   ```bash
   npm run install-all
   ```

3. **Database Setup**
   - Start XAMPP and ensure MySQL is running
   - Create a database named `client_management`
   - Import the complete schema from `database/complete_schema.sql`

4. **Environment Configuration**
   Create a `.env` file in the root directory:
   ```env
   # Database
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=
   DB_NAME=client_management
   DB_PORT=3306

   # JWT
   JWT_SECRET=your-super-secret-jwt-key
   JWT_EXPIRES_IN=7d

   # Server
   PORT=5000
   NODE_ENV=development

   # Email (optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   SMTP_FROM=noreply@yourdomain.com
   APP_NAME=Client Management System
   CLIENT_URL=http://localhost:3000
   CORS_ORIGIN=http://localhost:3000

   # File Upload
   MAX_FILE_SIZE=10485760
   UPLOAD_PATH=./uploads

   # Credential Encryption
   CREDENTIAL_ENCRYPTION_KEY=your-64-character-hex-encryption-key
   ```

5. **Start the application**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Creating Users for Existing Clients

If you have existing clients without user accounts, run:
```bash
node database/create_users_for_existing_clients.js
```

This script will:
- Find all clients without user accounts
- Generate unique usernames from email addresses
- Create secure random passwords
- Link users to their respective clients
- Display credentials for each created user

**IMPORTANT**: Save the displayed passwords securely and send them to clients.

---

## Project Management System

### Overview
The Project Management System is an integrated Agile project management tool that opens in a new tab when clicking "Manage Project" from the Client Management portal. It supports Scrum/Kanban methodologies with user stories, tasks, sprints, backlogs, and visual boards.

### Key Features
- **Workspace Management**: Each project can have a dedicated PM workspace
- **Backlog Management**: Centralized backlog for user stories and bugs
- **Sprint Planning**: Time-boxed sprints with capacity planning
- **Visual Boards**: Kanban/Scrum boards with drag-and-drop
- **Epic Management**: Organize user stories into epics
- **Task Management**: Tasks with subtasks, dependencies, and time tracking
- **Comments & Collaboration**: Comments on all entities with @mentions
- **Time Logging**: Track time spent on tasks
- **File Attachments**: Attach files to user stories, tasks, and epics
- **Task Linking**: Link tasks with dependencies (blocks, relates to, etc.)
- **CI/CD Integration**: Link tasks to CI/CD pipeline builds
- **Reports & Analytics**: Velocity, burndown, cycle time, throughput
- **Activity Feed**: Real-time activity tracking
- **Chat**: Project-based chat with @mentions

### Accessing Project Management
1. Navigate to **Projects** in the Client Management portal
2. Click the **"Manage Project"** button (external link icon) for any project
3. A new tab opens with the Project Management workspace
4. If no workspace exists, one is automatically created

### Core Concepts

#### Workspace
- A workspace is a project management environment linked to a Client Management project
- Each workspace can have multiple sprints, epics, user stories, and tasks
- Workspace members have roles: Owner, Admin, Member, Viewer

#### User Story
- Represents a feature or requirement from the user's perspective
- Has: Title, Description, Acceptance Criteria, Story Points, Priority, Status
- Can be linked to Epics and Sprints
- Can have multiple Tasks
- Has unique reference number (e.g., `US-1-001`)

#### Task
- Actionable work item within a User Story
- Has: Title, Description, Status, Priority, Estimated Hours, Logged Hours
- Can have Subtasks
- Can be linked to other Tasks (dependencies)
- Can have Comments and Time Logs
- Has unique reference number (e.g., `TASK-1-001`)

#### Sprint
- Time-boxed iteration (typically 1-4 weeks)
- Contains User Stories committed for that period
- Tracks: Capacity, Velocity, Burndown

#### Epic
- Large feature that spans multiple sprints
- Groups related User Stories
- Tracks overall progress
- Has unique reference number (e.g., `EPIC-1-001`)

### Reference Numbers
All epics, user stories, tasks, and subtasks have unique reference numbers:
- **Epic**: `EPIC-{workspace_id}-{number}` (e.g., `EPIC-1-001`)
- **User Story**: `US-{workspace_id}-{number}` (e.g., `US-1-001`)
- **Task**: `TASK-{workspace_id}-{number}` (e.g., `TASK-1-001`)
- **Subtask**: `TASK-{workspace_id}-{parent_number}-{subtask_number}` (e.g., `TASK-1-001-1`)

Reference numbers are clickable and can be copied to clipboard for easy sharing.

### Assignment
- User stories, tasks, and subtasks can be assigned to workspace members
- Assignment is visible in cards, lists, and modals
- Assignment history is tracked for audit purposes
- Filters allow viewing items by assignee

### Database Schema
See `database/complete_schema.sql` for the complete PM database schema including:
- `pm_workspaces` - Workspace definitions
- `pm_workspace_members` - Workspace membership
- `pm_epics` - Epic definitions
- `pm_user_stories` - User story definitions
- `pm_tasks` - Task definitions (includes subtasks)
- `pm_sprints` - Sprint definitions
- `pm_comments` - Comments on entities
- `pm_time_logs` - Time tracking
- `pm_attachments` - File attachments
- `pm_task_links` - Task dependencies
- `pm_activities` - Activity feed
- `pm_ci_cd_integrations` - CI/CD integrations
- `pm_task_ci_cd_links` - Task-to-build links
- `pm_chat_rooms` - Chat rooms
- `pm_chat_messages` - Chat messages
- `pm_chat_message_reads` - Read status
- `pm_chat_participants` - Chat participants

---

## Role-Based Access Control

### Overview
The system uses a comprehensive Role-Based Access Control (RBAC) system that controls access to modules and features based on user roles and permissions.

### Features
1. **Auto-Create Client Users**: When a new client is created, a user account is automatically created with credentials sent via email
2. **Users Module**: Manage all users with filtering, search, and role assignment
3. **Roles & Permissions Module**: Manage roles and their permissions
4. **Data Isolation**: Client users can only see data associated with their account

### Default Roles

#### Administrator (Super User)
- **All permissions** for all modules
- Cannot be modified
- Full system access

#### Project Owner (PO)
- All `projects.*` permissions
- All `pm_*` permissions (Project Management)
- `clients.view`
- `quotations.*`
- `invoices.*`
- `files.*`
- `conversations.*`
- `reports.*`
- `pm_chat.*`

#### Manager
- `dashboard.view`
- `clients.*`
- `projects.*`
- `quotations.*`
- `invoices.*`
- `files.*`
- `credentials.*`
- `conversations.*`
- `reports.*`
- All `pm_*` permissions
- `pm_chat.*`

#### Accountant
- `dashboard.view`
- `clients.view`
- `projects.view`
- `quotations.*`
- `invoices.*`
- `files.view`
- `reports.*`
- `pm_workspaces.view`
- `pm_chat.view`

#### Client
- `dashboard.view` (own data only)
- `clients.view` (own data only)
- `projects.view` (assigned projects only)
- `quotations.view` (own quotations only)
- `invoices.view` (own invoices only)
- `files.view` (own files only)
- `conversations.*` (own conversations only)
- `pm_workspaces.view` (assigned workspaces only)
- `pm_user_stories.view` (assigned workspaces only)
- `pm_tasks.view` (assigned workspaces only)
- `pm_sprints.view` (assigned workspaces only)
- `pm_epics.view` (assigned workspaces only)
- `pm_comments.*` (assigned workspaces only)
- `pm_chat.*` (assigned workspaces only)

#### Viewer (Read-Only)
- `dashboard.view`
- `clients.view`
- `projects.view`
- `quotations.view`
- `invoices.view`
- `files.view`
- `pm_workspaces.view`
- `pm_user_stories.view`
- `pm_tasks.view`
- `pm_sprints.view`
- `pm_epics.view`
- `pm_comments.view`
- `pm_reports.view`
- `pm_chat.view`
- **No create/edit/delete permissions**

### Permission Structure
Each permission follows the pattern: `{module}.{action}`
- **Module**: The feature area (e.g., `clients`, `projects`, `pm_chat`)
- **Action**: The operation (e.g., `view`, `create`, `edit`, `delete`)

### Module Permissions

#### Client Management Modules
- `dashboard.*` - Dashboard access
- `clients.*` - Client management
- `projects.*` - Project management
- `quotations.*` - Quotation management
- `invoices.*` - Invoice management (includes `record_payment`)
- `files.*` - File management (includes `upload`, `download`)
- `credentials.*` - Credential management
- `conversations.*` - Conversation management
- `users.*` - User management
- `roles.*` - Role and permission management
- `reports.*` - Report viewing and export
- `settings.*` - Settings access

#### Project Management Modules
- `pm_workspaces.*` - Workspace management
- `pm_user_stories.*` - User story management
- `pm_tasks.*` - Task management
- `pm_sprints.*` - Sprint management
- `pm_epics.*` - Epic management
- `pm_comments.*` - Comment management
- `pm_time_logs.*` - Time logging
- `pm_attachments.*` - Attachment management
- `pm_reports.*` - PM report viewing
- `pm_settings.*` - Workspace settings
- `pm_activity.*` - Activity feed viewing
- `pm_chat.*` - Chat functionality

### Setting Up Roles & Permissions

1. **Run Database Schema**
   ```bash
   # Import the complete schema which includes roles and permissions
   mysql -u root -p client_management < database/complete_schema.sql
   ```

2. **Configure Email (Optional)**
   Add SMTP settings to `.env` for automatic credential emails when creating clients.

3. **Manage Roles**
   - Navigate to **Roles & Permissions**
   - Select a role from the left panel
   - View and modify permissions in the right panel
   - System roles (admin) cannot have their permissions modified

4. **Assign Roles to Users**
   - Navigate to **Users**
   - Edit a user
   - Assign roles from the available roles list

### Role Mapping (Project Management)
When adding members to PM workspaces, CMS roles automatically map to workspace roles:
- `admin` → `admin` (workspace)
- `po` → `admin` (workspace)
- `manager` → `admin` (workspace)
- `accountant` → `member` (workspace)
- `client` → `member` (workspace)
- `viewer` → `viewer` (workspace)

---

## Permissions Management

### Implementation Status

#### ✅ Completed
- Chat permissions updated to use `pm_chat` module
- Role mapping system created
- Workspace member management respects CMS roles
- All Client Management modules have permission checks
- Data isolation for client users

#### ⚠️ Pending
- Add permission checks to all PM routes (currently only chat has proper checks)
- Add frontend permission checks for PM modules
- Implement edit/delete for chat messages

### Permission Checklist

#### Client Management Modules (All have permissions ✅)
- Dashboard
- Clients
- Projects
- Quotations
- Invoices
- Files
- Credentials
- Conversations
- Users
- Roles & Permissions
- Reports
- Settings

#### Project Management Modules
- PM Workspaces - ⚠️ Currently uses `projects.view`
- PM User Stories - ⚠️ No permission checks
- PM Tasks - ⚠️ No permission checks
- PM Sprints - ⚠️ No permission checks
- PM Epics - ⚠️ No permission checks
- PM Comments - ⚠️ No permission checks
- PM Time Logs - ⚠️ No permission checks
- PM Attachments - ⚠️ No permission checks
- PM Reports - ⚠️ No permission checks
- PM Settings - ⚠️ Currently uses `projects.view`
- PM Activity - ⚠️ No permission checks
- PM Chat - ✅ **COMPLETED** - Uses `pm_chat` permissions

### Important Notes
- Admin users bypass all permission checks
- Client users have data-level filtering (only see their own data)
- Workspace member roles should respect Client Management role assignments
- All permission checks should be consistent across frontend and backend

---

## Database Schema

The complete database schema is available in `database/complete_schema.sql`. This file includes:

1. **Core Client Management Tables**
   - `users` - User accounts
   - `clients` - Client information
   - `projects` - Project definitions
   - `quotations` - Quotation management
   - `invoices` - Invoice management
   - `invoice_items` - Invoice line items
   - `payments` - Payment records
   - `files` - File metadata
   - `credentials` - Encrypted credentials
   - `conversations` - Conversation threads
   - `notifications` - System notifications
   - `activity_logs` - Activity tracking

2. **Role-Based Access Control Tables**
   - `roles` - Role definitions
   - `permissions` - Permission definitions
   - `role_permissions` - Role-permission mapping
   - `user_roles` - User-role assignments
   - `user_projects` - User-project assignments

3. **Project Management Tables**
   - `pm_workspaces` - PM workspaces
   - `pm_workspace_members` - Workspace membership
   - `pm_epics` - Epic definitions
   - `pm_user_stories` - User story definitions
   - `pm_tasks` - Task definitions (includes subtasks)
   - `pm_sprints` - Sprint definitions
   - `pm_comments` - Comments
   - `pm_time_logs` - Time tracking
   - `pm_attachments` - File attachments
   - `pm_task_links` - Task dependencies
   - `pm_activities` - Activity feed
   - `pm_ci_cd_integrations` - CI/CD integrations
   - `pm_task_ci_cd_links` - Task-to-build links
   - `pm_assignment_history` - Assignment tracking

4. **Chat System Tables**
   - `pm_chat_rooms` - Chat rooms
   - `pm_chat_messages` - Chat messages
   - `pm_chat_message_reads` - Read status
   - `pm_chat_participants` - Chat participants

### Running Migrations
The complete schema file includes all migrations. For existing databases, you can run individual migration scripts if needed:
- `migration_add_project_type_maintenance.sql` - Adds 'maintenance' project type
- `pm_migration_story_points_decimal.sql` - Changes story points to decimal
- `pm_migration_add_reference_numbers.sql` - Adds reference numbers
- `migration_add_pm_chat_permissions.sql` - Adds PM permissions

---

## API Documentation

### Authentication
All API endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <token>
```

### Client Management Endpoints

#### Clients
- `GET /api/clients` - List clients (with filters)
- `GET /api/clients/:id` - Get client details
- `POST /api/clients` - Create client (auto-creates user)
- `PUT /api/clients/:id` - Update client
- `DELETE /api/clients/:id` - Delete client

#### Projects
- `GET /api/projects` - List projects (with filters)
- `GET /api/projects/:id` - Get project details
- `GET /api/projects/stats/overview` - Get project statistics
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

#### Invoices
- `GET /api/invoices` - List invoices (with filters)
- `GET /api/invoices/:id` - Get invoice details
- `GET /api/invoices/:id/download` - Download invoice PDF
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices/:id` - Update invoice
- `POST /api/invoices/:id/payment` - Record payment
- `DELETE /api/invoices/:id` - Delete invoice

### Project Management Endpoints

#### Workspaces
- `GET /api/pm/workspaces` - List workspaces
- `GET /api/pm/workspaces/:id` - Get workspace details
- `GET /api/pm/workspaces/project/:projectId` - Get workspace by project
- `POST /api/pm/workspaces` - Create workspace
- `PUT /api/pm/workspaces/:id` - Update workspace

#### User Stories
- `GET /api/pm/workspaces/:workspaceId/user-stories` - List user stories
- `GET /api/pm/user-stories/:id` - Get user story details
- `POST /api/pm/workspaces/:workspaceId/user-stories` - Create user story
- `PUT /api/pm/user-stories/:id` - Update user story
- `DELETE /api/pm/user-stories/:id` - Delete user story

#### Tasks
- `GET /api/pm/user-stories/:storyId/tasks` - List tasks for user story
- `GET /api/pm/tasks/:id` - Get task details
- `POST /api/pm/user-stories/:storyId/tasks` - Create task
- `PUT /api/pm/tasks/:id` - Update task
- `DELETE /api/pm/tasks/:id` - Delete task

#### Sprints
- `GET /api/pm/workspaces/:workspaceId/sprints` - List sprints
- `GET /api/pm/sprints/:id` - Get sprint details
- `GET /api/pm/sprints/:id/burndown` - Get burndown data
- `POST /api/pm/workspaces/:workspaceId/sprints` - Create sprint
- `PUT /api/pm/sprints/:id` - Update sprint
- `POST /api/pm/sprints/:id/start` - Start sprint
- `POST /api/pm/sprints/:id/complete` - Complete sprint

#### Chat
- `GET /api/pm/chat/workspace/:workspaceId/room` - Get chat room
- `GET /api/pm/chat/room/:roomId/messages` - Get messages
- `POST /api/pm/chat/room/:roomId/messages` - Send message
- `POST /api/pm/chat/room/:roomId/messages/read` - Mark as read
- `GET /api/pm/chat/workspace/:workspaceId/members` - Get members for mentions
- `GET /api/pm/chat/room/:roomId/unread-count` - Get unread count

---

## Development Guidelines

### Project Structure
```
client-project-management/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   ├── utils/         # Utility functions
│   │   └── contexts/      # React contexts
├── server/                # Node.js backend
│   ├── config/           # Database and app config
│   ├── middleware/       # Custom middleware
│   ├── routes/           # API routes
│   └── utils/            # Utility functions
├── database/             # Database schema and migrations
├── uploads/             # File upload directory
└── docs/               # Documentation
```

### Code Standards
- Use ES6+ JavaScript features
- Follow React best practices (hooks, functional components)
- Use async/await for asynchronous operations
- Implement proper error handling
- Add input validation on both frontend and backend
- Use consistent naming conventions (camelCase for variables, PascalCase for components)
- Add comments for complex logic
- Keep components small and focused

### Security Best Practices
- Always validate and sanitize user input
- Use parameterized queries (prepared statements) for database operations
- Implement proper authentication and authorization
- Use HTTPS in production
- Encrypt sensitive data (credentials)
- Implement rate limiting
- Use CORS properly
- Keep dependencies updated

### Testing
- Write unit tests for utility functions
- Write integration tests for API endpoints
- Test error scenarios
- Test permission boundaries
- Test data isolation for client users

---

## Support & Questions

For support and questions:
- Review this documentation
- Check the code comments
- Review the database schema
- Contact the development team

---

**Last Updated**: 2024
**Version**: 1.0
