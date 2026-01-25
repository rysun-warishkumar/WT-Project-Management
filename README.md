# Client & Project Management System

A comprehensive admin dashboard for managing clients, projects, quotations, invoices, and business operations.

## 🚀 Features

### Core Modules
- **Dashboard**: Overview with key metrics and quick actions
- **Client Management**: Complete client information and communication history
- **Project Management**: Project tracking with status and deliverables
- **Quotations & Proposals**: Generate and manage client quotes
- **Invoices & Billing**: Complete billing cycle management
- **Files & Documents**: Secure file storage and management
- **Credentials**: Secure access credential storage
- **Conversations & Notes**: Client communication tracking
- **Reports & Analytics**: Business insights and performance metrics

### Technical Features
- Modern React-based admin dashboard
- Node.js/Express backend API
- MySQL database with XAMPP
- JWT authentication
- File upload and management
- Email notifications
- Responsive design
- Real-time notifications

## 🛠️ Installation

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
   - Import the complete SQL schema from `database/complete_schema.sql`

4. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials and other settings.

5. **Start the application**
   ```bash
   npm run dev
   ```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

## 📁 Project Structure

```
client-project-management/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   ├── utils/         # Utility functions
│   │   └── styles/        # CSS and styling
├── server/                # Node.js backend
│   ├── config/           # Database and app config
│   ├── controllers/      # Route controllers
│   ├── middleware/       # Custom middleware
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   └── utils/           # Utility functions
├── database/            # Database schema and migrations
├── uploads/            # File upload directory
└── docs/              # Documentation
```

## 🔧 Configuration

### Environment Variables
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
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
```

## 📊 Database Schema

The complete database schema is available in `database/complete_schema.sql`. This includes:
- **Core Client Management Tables**: users, clients, projects, quotations, invoices, files, credentials, conversations, notifications, activity_logs
- **Role-Based Access Control**: roles, permissions, role_permissions, user_roles, user_projects
- **Project Management System**: All PM tables (workspaces, epics, user stories, tasks, sprints, comments, time logs, attachments, etc.)
- **Chat System**: Chat rooms, messages, reads, and participants

For detailed documentation, see `DOCUMENTATION.md`.

## 🎨 UI/UX Features

- Modern, responsive design
- Dark/Light theme support
- Interactive charts and graphs
- Real-time data updates
- Mobile-friendly interface
- Intuitive navigation
- Professional color scheme

## 🔒 Security Features

- JWT-based authentication
- Password encryption (bcrypt)
- Input validation and sanitization
- Rate limiting
- CORS protection
- Secure file uploads
- SQL injection prevention

## 📈 Business Features

- Client relationship management
- Project lifecycle tracking
- Automated invoice generation
- Payment tracking
- File organization
- Communication history
- Business analytics
- Custom reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License.

## 📚 Documentation

Complete documentation is available in `DOCUMENTATION.md`, including:
- System overview and installation
- Project Management System guide
- Role-Based Access Control
- Permissions Management
- Database schema details
- API documentation
- Development guidelines

## 🆘 Support

For support and questions, please create an issue in the repository or contact the development team.
