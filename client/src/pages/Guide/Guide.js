import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  Home,
  Users,
  FolderOpen,
  FileText,
  Receipt,
  Folder,
  Key,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronRight,
  CheckCircle,
  DollarSign,
  Calendar,
  Building,
  Download,
  Eye,
  Edit,
  Plus,
  CreditCard,
  UserCog,
  Shield,
} from 'lucide-react';

const Guide = () => {
  const [expandedSection, setExpandedSection] = useState(null);

  /**
   * MODULES CONFIGURATION
   * 
   * To add a new module to this guide:
   * 1. Add a new object to the modules array below
   * 2. Include: id, name, icon (from lucide-react), description, features array, example, howToUse array, and route
   * 3. The module will automatically appear in the guide
   * 
   * Example:
   * {
   *   id: 'new-module',
   *   name: 'New Module',
   *   icon: YourIcon,
   *   description: 'Description of what this module does',
   *   features: ['Feature 1', 'Feature 2', 'Feature 3'],
   *   example: 'Example use case description',
   *   howToUse: ['Step 1', 'Step 2', 'Step 3'],
   *   route: '/new-module',
   * }
   */
  const modules = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: Home,
      description: 'Get an overview of your business with key metrics, recent activities, and quick insights.',
      features: [
        'View total clients, projects, and revenue statistics',
        'Monitor recent activities and upcoming due dates',
        'Quick access to important metrics',
        'Revenue charts and project status overview',
      ],
      example: 'Example: View your total revenue for the month, see how many active projects you have, and check which invoices are due soon.',
      howToUse: [
        'Navigate to Dashboard from the sidebar',
        'View key statistics cards at the top',
        'Check recent activities and upcoming deadlines',
        'Review revenue and project status charts',
      ],
      route: '/dashboard',
    },
    {
      id: 'clients',
      name: 'Clients',
      icon: Users,
      description: 'Manage all your client information, contact details, and client relationships in one place.',
      features: [
        'Add, edit, and delete client records',
        'Store client contact information (email, phone, address)',
        'Track client status (active, inactive, prospect)',
        'View client details with associated projects and invoices',
        'Filter and search clients easily',
      ],
      example: 'Example: Add a new client "ABC Corporation" with their contact details. When you create a project for them, it will be automatically linked to this client record.',
      howToUse: [
        'Click "Add Client" button to create a new client',
        'Fill in client information (name, email, phone, address)',
        'Set client status and add any notes',
        'Click on a client to view detailed information',
        'From client detail page, you can view all related projects and invoices',
      ],
      route: '/clients',
    },
    {
      id: 'projects',
      name: 'Projects',
      icon: FolderOpen,
      description: 'Track and manage all your projects from planning to completion with detailed project information.',
      features: [
        'Create and manage projects linked to clients',
        'Track project status (planning, in progress, review, completed, on hold, cancelled)',
        'Set project budgets and track actual costs',
        'Store project URLs (admin panel, delivery link)',
        'Manage project files and documents',
        'View project timeline and deadlines',
      ],
      example: 'Example: Create a project "Website Redesign" for client "ABC Corporation" with a budget of $10,000. Track its progress from planning to completion, and upload project files like design mockups.',
      howToUse: [
        'Click "Add Project" to create a new project',
        'Select a client and enter project details (title, type, description)',
        'Set project status, start date, and end date',
        'Add budget and technology stack information',
        'Upload project files from the project detail page',
        'View all invoices and quotations related to the project',
      ],
      route: '/projects',
    },
    {
      id: 'quotations',
      name: 'Quotations',
      icon: FileText,
      description: 'Create, send, and manage quotations for your clients with itemized pricing and terms.',
      features: [
        'Create professional quotations with itemized lists',
        'Set quotation validity dates',
        'Track quotation status (draft, sent, accepted, declined, expired)',
        'Convert accepted quotations to invoices',
        'Download quotations as PDF',
        'Link quotations to clients and projects',
      ],
      example: 'Example: Create a quotation "QTE-2024-0001" for a website project with items like "Web Design" ($2,000), "Development" ($5,000), and "Testing" ($1,000). Send it to the client, and when accepted, convert it directly to an invoice.',
      howToUse: [
        'Click "Add Quotation" to create a new quotation',
        'Select a client and optionally link to a project',
        'Add quotation items with descriptions, quantities, and prices',
        'Set quotation date and validity period',
        'Save as draft or mark as sent',
        'When client accepts, convert quotation to invoice with one click',
      ],
      route: '/quotations',
    },
    {
      id: 'invoices',
      name: 'Invoices',
      icon: Receipt,
      description: 'Generate professional invoices, track payments, and manage billing for your clients.',
      features: [
        'Create invoices with itemized billing',
        'Track invoice status (draft, sent, paid, partial, overdue, cancelled)',
        'Record payments and track outstanding amounts',
        'Download invoices as professional PDF documents',
        'Link invoices to quotations and projects',
        'View payment history for each invoice',
      ],
      example: 'Example: Create invoice "INV-2024-0001" for $8,000. When client pays $3,000, record the payment. The system automatically updates the status to "Partial" and shows $5,000 outstanding. Download the invoice as PDF to send to the client.',
      howToUse: [
        'Click "Add Invoice" to create a new invoice',
        'Select client and add invoice items',
        'Set invoice date, due date, and tax rate',
        'Save and send invoice to client',
        'Record payments using "Record Payment" button',
        'Download invoice PDF from list or detail page',
        'View complete payment history on invoice detail page',
      ],
      route: '/invoices',
    },
    {
      id: 'files',
      name: 'Files',
      icon: Folder,
      description: 'Store and organize project files, documents, and other important files linked to clients or projects.',
      features: [
        'Upload and store files securely',
        'Link files to specific clients or projects',
        'Organize files by type (document, image, archive, other)',
        'Add descriptions and tags to files',
        'Download files when needed',
        'Filter files by client, project, or type',
      ],
      example: 'Example: Upload a design mockup PDF for a website project. Link it to the project "Website Redesign" and client "ABC Corporation". Add tags like "design" and "mockup" for easy searching later.',
      howToUse: [
        'Navigate to Files section',
        'Click "Upload File" button',
        'Select file and choose associated client/project',
        'Add description and tags',
        'Files are automatically organized and searchable',
        'Download files by clicking the download button',
      ],
      route: '/files',
    },
    {
      id: 'credentials',
      name: 'Credentials',
      icon: Key,
      description: 'Securely store and manage login credentials, API keys, and access information for clients and projects.',
      features: [
        'Store credentials securely (admin panels, hosting, domains, FTP, databases, APIs)',
        'Link credentials to clients or projects',
        'Organize by credential type',
        'Store URLs, IP addresses, usernames, and passwords',
        'Add notes for additional information',
        'Quick access to client/project credentials',
      ],
      example: 'Example: Store WordPress admin credentials for a client website. Include the admin URL, username, and password. Link it to the project "Website Redesign" so team members can easily access it.',
      howToUse: [
        'Click "Add Credential" to create a new credential entry',
        'Select credential type (admin panel, hosting, domain, FTP, database, API, other)',
        'Enter URL, IP address, username, email, and password',
        'Link to client or project',
        'Add notes for additional information',
        'Access credentials from the credentials list or client/project detail pages',
      ],
      route: '/credentials',
    },
    {
      id: 'conversations',
      name: 'Conversations',
      icon: MessageSquare,
      description: 'Track all communications with clients including emails, calls, meetings, and notes.',
      features: [
        'Record conversations with clients',
        'Track conversation type (email, call, meeting, chat, note)',
        'Mark important conversations',
        'Set follow-up dates',
        'Link conversations to clients and projects',
        'View conversation history',
      ],
      example: 'Example: Record a client meeting where you discussed project requirements. Mark it as important and set a follow-up date. Link it to the project "Website Redesign" so you can reference it later.',
      howToUse: [
        'Click "Add Conversation" to log a new communication',
        'Select conversation type (email, call, meeting, chat, note)',
        'Enter subject and message/details',
        'Set direction (inbound, outbound, internal)',
        'Mark as important if needed',
        'Set follow-up date for reminders',
        'Link to client and optionally to a project',
      ],
      route: '/conversations',
    },
    {
      id: 'users',
      name: 'Users',
      icon: UserCog,
      description: 'Manage system users, their roles, and access permissions. Control who can access the system and what they can do.',
      features: [
        'View all system users with their roles and status',
        'Create new user accounts with role assignments',
        'Edit user information and permissions',
        'Assign users to specific clients (for client users)',
        'Filter users by role, client, or status',
        'Search users by name, email, or username',
        'Activate or deactivate user accounts',
        'View user project assignments',
      ],
      example: 'Example: Create a new user account for a client "John Doe" with email "john@example.com". Assign them the "Client" role and link them to their client record. The system will automatically generate secure credentials.',
      howToUse: [
        'Navigate to Users section from the sidebar',
        'Click "Add User" to create a new user account',
        'Fill in user details (name, email, username, password)',
        'Select appropriate role (Admin, PO, Manager, Accountant, Client, Viewer)',
        'Link to client if creating a client user',
        'Set user status (active/inactive)',
        'Use filters to find specific users',
        'Edit or delete users as needed',
      ],
      route: '/users',
    },
    {
      id: 'roles',
      name: 'Roles & Permissions',
      icon: Shield,
      description: 'Manage user roles and their permissions. Control what each role can access and modify in the system.',
      features: [
        'View all system roles and custom roles',
        'Manage permissions for each role',
        'Create custom roles with specific permissions',
        'Edit role permissions (except Super Admin)',
        'Assign multiple roles to users',
        'View which users have which roles',
        'Organize permissions by module (Clients, Projects, Invoices, etc.)',
        'Protect Super Admin role from modification',
      ],
      example: 'Example: Create a custom role "Project Manager" with permissions to view and edit projects, view invoices, and manage files. Assign this role to team members who need project management access but not full admin rights.',
      howToUse: [
        'Navigate to Roles & Permissions section',
        'Select a role from the list to view its permissions',
        'Click "Add Role" to create a custom role',
        'Select permissions for the new role by checking boxes',
        'Edit existing role permissions (except Super Admin)',
        'Use module-level toggles to quickly select all permissions in a module',
        'Save changes to update role permissions',
        'View which users are assigned to each role',
      ],
      route: '/roles',
    },
    {
      id: 'reports',
      name: 'Reports',
      icon: BarChart3,
      description: 'Generate comprehensive reports and analytics for your business operations with detailed insights and data visualization.',
      features: [
        'Generate financial reports (revenue, expenses, profit)',
        'View client performance reports',
        'Track project completion and status reports',
        'Analyze invoice and payment reports',
        'Export reports in multiple formats (PDF, Excel, CSV)',
        'Filter reports by date range, client, or project',
        'View graphical charts and visualizations',
        'Schedule automated report generation',
      ],
      example: 'Example: Generate a monthly revenue report for January 2024 showing total revenue of $50,000, breakdown by client, top performing projects, and payment trends. Export the report as PDF to share with stakeholders.',
      howToUse: [
        'Navigate to Reports section',
        'Select report type (Financial, Client, Project, Invoice)',
        'Choose date range and filters',
        'Click "Generate Report" to create the report',
        'View report with charts and detailed data',
        'Export report in desired format (PDF, Excel, CSV)',
        'Save report for future reference',
      ],
      route: '/reports',
    },
    {
      id: 'settings',
      name: 'Settings',
      icon: Settings,
      description: 'Manage your account settings, update profile information, change password, and view account details.',
      features: [
        'Update personal information (name, email, username)',
        'Change account password securely',
        'View account information and status',
        'Check last login time and account creation date',
        'View assigned role and permissions',
        'Real-time validation and error handling',
        'Mobile-responsive interface',
      ],
      example: 'Example: Update your email address from "old@example.com" to "new@example.com", change your password for security, and view when your account was created and your last login time.',
      howToUse: [
        'Navigate to Settings from the sidebar',
        'Go to "Profile Settings" tab to update your name, email, or username',
        'Click "Save Changes" after making updates',
        'Go to "Change Password" tab to update your password',
        'Enter current password, new password, and confirm password',
        'Click "Change Password" to save',
        'View "Account Information" tab to see your account details, role, and activity',
      ],
      route: '/settings',
    },
  ];

  const toggleSection = (id) => {
    setExpandedSection(expandedSection === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-primary-600" />
            <span>User Guide</span>
          </h1>
          <p className="text-gray-600 mt-2">
            Complete guide to using the Client Management System
          </p>
        </div>
      </div>

      {/* Introduction */}
      <div className="card bg-gradient-to-r from-primary-50 to-blue-50 border-primary-200">
        <div className="card-body">
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Welcome to the User Guide</h2>
          <p className="text-gray-700 mb-4">
            This guide will help you understand and use all the features of the Client Management System. 
            Each module is designed to help you manage your clients, projects, and business operations efficiently.
          </p>
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span>Click on any module below to learn more about it</span>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="card">
        <div className="card-header">
          <h2 className="text-lg font-medium text-gray-900">Quick Navigation</h2>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Link
                  key={module.id}
                  to={module.route}
                  className="flex flex-col items-center p-4 bg-gray-50 hover:bg-primary-50 rounded-lg transition-colors border border-gray-200 hover:border-primary-300"
                >
                  <Icon className="h-6 w-6 text-primary-600 mb-2" />
                  <span className="text-sm font-medium text-gray-700 text-center">{module.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modules List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Modules</h2>
        {modules.map((module) => {
          const Icon = module.icon;
          const isExpanded = expandedSection === module.id;

          return (
            <div key={module.id} className="card">
              <div
                className="card-header cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection(module.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary-100 rounded-lg">
                      <Icon className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{module.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Link
                      to={module.route}
                      onClick={(e) => e.stopPropagation()}
                      className="btn btn-outline btn-sm"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Open Module
                    </Link>
                    <ChevronRight
                      className={`h-5 w-5 text-gray-400 transition-transform ${
                        isExpanded ? 'transform rotate-90' : ''
                      }`}
                    />
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="card-body border-t border-gray-200 pt-6 space-y-6">
                  {/* Features */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      Key Features
                    </h4>
                    <ul className="space-y-2">
                      {module.features.map((feature, index) => (
                        <li key={index} className="flex items-start space-x-2 text-gray-700">
                          <ChevronRight className="h-4 w-4 text-primary-600 mt-1 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Example */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="text-md font-semibold text-gray-900 mb-2 flex items-center">
                      <FileText className="h-5 w-5 text-blue-600 mr-2" />
                      Example Use Case
                    </h4>
                    <p className="text-gray-700">{module.example}</p>
                  </div>

                  {/* How to Use */}
                  <div>
                    <h4 className="text-md font-semibold text-gray-900 mb-3 flex items-center">
                      <BookOpen className="h-5 w-5 text-primary-600 mr-2" />
                      How to Use
                    </h4>
                    <ol className="space-y-2">
                      {module.howToUse.map((step, index) => (
                        <li key={index} className="flex items-start space-x-3 text-gray-700">
                          <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-semibold">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center space-x-3 pt-4 border-t border-gray-200">
                    <Link to={module.route} className="btn btn-primary btn-sm">
                      <Eye className="h-4 w-4 mr-2" />
                      Open {module.name}
                    </Link>
                    <span className="text-sm text-gray-500">
                      Route: <code className="bg-gray-100 px-2 py-1 rounded">{module.route}</code>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tips Section */}
      <div className="card bg-yellow-50 border-yellow-200">
        <div className="card-body">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">💡 Pro Tips</h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <span>Always link projects to clients for better organization and tracking</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <span>Convert accepted quotations to invoices to save time and maintain consistency</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <span>Record all client conversations to maintain a complete communication history</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <span>Download invoices as PDFs to send to clients professionally</span>
            </li>
            <li className="flex items-start space-x-2">
              <CheckCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <span>Use tags and descriptions when uploading files for easy searching later</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-center py-6 text-gray-500 text-sm">
        <p>
          This guide is updated automatically when new modules are added to the system.
          For additional support, please contact your system administrator.
        </p>
      </div>
    </div>
  );
};

export default Guide;
