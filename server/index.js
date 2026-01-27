const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
// const rateLimit = require('express-rate-limit'); // Disabled - no rate limiting
const path = require('path');
require('dotenv').config();

const db = require('./config/database');
const authRoutes = require('./routes/auth');
const clientRoutes = require('./routes/clients');
const projectRoutes = require('./routes/projects');
const quotationRoutes = require('./routes/quotations');
const invoiceRoutes = require('./routes/invoices');
const fileRoutes = require('./routes/files');
const credentialRoutes = require('./routes/credentials');
const conversationRoutes = require('./routes/conversations');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const userRoutes = require('./routes/users');
const roleRoutes = require('./routes/roles');
const reportRoutes = require('./routes/reports');
const pmWorkspaceRoutes = require('./routes/pm/workspaces');
const pmUserStoryRoutes = require('./routes/pm/userStories');
const pmTaskRoutes = require('./routes/pm/tasks');
const pmCommentRoutes = require('./routes/pm/comments');
const pmSprintRoutes = require('./routes/pm/sprints');
const pmReportRoutes = require('./routes/pm/reports');
const pmSettingsRoutes = require('./routes/pm/settings');
const pmEpicRoutes = require('./routes/pm/epics');
const pmTimeLogRoutes = require('./routes/pm/timeLogs');
const pmAttachmentRoutes = require('./routes/pm/attachments');
const pmTaskLinkRoutes = require('./routes/pm/taskLinks');
const pmActivityRoutes = require('./routes/pm/activities');
const pmCicdRoutes = require('./routes/pm/cicd');
const pmReferenceRoutes = require('./routes/pm/reference');
const pmAssignmentRoutes = require('./routes/pm/assignments');
const pmChatRoutes = require('./routes/pm/chat');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration - MUST BE FIRST
// Supports single origin or comma-separated list in CORS_ORIGIN, e.g.
// CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
const corsAllowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Helper function to check if origin is allowed
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  
  // Exact match in allowed origins list
  if (corsAllowedOrigins.includes(origin)) return true;
  
  // Development mode - allow localhost
  if (process.env.NODE_ENV !== 'production') {
    return origin === 'http://localhost:3000' ||
           origin === 'http://127.0.0.1:3000' ||
           origin === 'http://localhost:3001' ||
           origin === 'http://127.0.0.1:3001';
  }
  
  // Production mode - check if origin matches Render pattern
  // Allow any Render static site (*.onrender.com) if CORS_ORIGIN is not set or matches pattern
  if (process.env.NODE_ENV === 'production') {
    // If CORS_ORIGIN is not set, allow all Render origins (for initial setup)
    if (corsAllowedOrigins.length === 0 || corsAllowedOrigins[0] === 'http://localhost:3000') {
      if (origin && origin.includes('.onrender.com')) {
        console.log(`⚠️  Allowing Render origin (CORS_ORIGIN not configured): ${origin}`);
        return true;
      }
    }
    
    // Check if any allowed origin matches the pattern (for partial matches)
    const originMatches = corsAllowedOrigins.some(allowed => {
      // Exact match
      if (allowed === origin) return true;
      // Pattern match (e.g., if CORS_ORIGIN contains the domain)
      if (origin.includes(allowed.replace('https://', '').replace('http://', ''))) return true;
      return false;
    });
    
    if (originMatches) return true;
  }
  
  return false;
};

// CORS middleware - applied before all other middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        if (process.env.NODE_ENV !== 'production' && origin) {
          // console.log(`✅ Allowing CORS for origin: ${origin}`);
        }
        return callback(null, true);
      }
      
      // In development, be more permissive
      if (process.env.NODE_ENV !== 'production') {
        console.log(`⚠️  Allowing CORS for origin (dev mode): ${origin}`);
        return callback(null, true);
      }

      // Production mode - provide helpful error message
      console.error(`❌ CORS blocked for origin: ${origin}`);
      console.error(`   Allowed origins: ${corsAllowedOrigins.join(', ') || 'None configured'}`);
      console.error(`   Please set CORS_ORIGIN environment variable to: ${origin}`);
      return callback(new Error(`CORS blocked for origin: ${origin}. Please configure CORS_ORIGIN environment variable.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    optionsSuccessStatus: 200,
    preflightContinue: false,
  })
);

// Handle OPTIONS requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  
  // Allow origin if it's allowed
  if (isOriginAllowed(origin) || process.env.NODE_ENV !== 'production') {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else if (process.env.NODE_ENV !== 'production') {
      res.header('Access-Control-Allow-Origin', '*');
    }
  } else if (origin && corsAllowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - DISABLED per user request
// const limiter = rateLimit({
//   windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
//   max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Increased to 1000 requests per windowMs for development
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true,
//   legacyHeaders: false,
// });
// app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
console.log('✅ Auth routes registered at /api/auth');
app.use('/api/clients', clientRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/credentials', credentialRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/pm/workspaces', pmWorkspaceRoutes);
app.use('/api/pm/user-stories', pmUserStoryRoutes);
app.use('/api/pm/tasks', pmTaskRoutes);
app.use('/api/pm/comments', pmCommentRoutes);
app.use('/api/pm/sprints', pmSprintRoutes);
app.use('/api/pm/reports', pmReportRoutes);
app.use('/api/pm/settings', pmSettingsRoutes);
app.use('/api/pm/epics', pmEpicRoutes);
app.use('/api/pm/time-logs', pmTimeLogRoutes);
app.use('/api/pm/attachments', pmAttachmentRoutes);
app.use('/api/pm/task-links', pmTaskLinkRoutes);
app.use('/api/pm/activities', pmActivityRoutes);
app.use('/api/pm/cicd', pmCicdRoutes);
app.use('/api/pm/reference', pmReferenceRoutes);
app.use('/api/pm/assignments', pmAssignmentRoutes);
app.use('/api/pm/chat', pmChatRoutes);
app.use('/api/settings', require('./routes/settings'));

// Error handling middleware - must include CORS headers
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Ensure CORS headers are set even on errors
  const origin = req.headers.origin;
  if (isOriginAllowed(origin) || process.env.NODE_ENV !== 'production') {
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
  }
  
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      errors: err.errors
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access'
    });
  }
  
  // Handle CORS errors specifically
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: err.message
    });
  }
  
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});

// 404 handler for API routes
// Note: Frontend is deployed separately as a Static Site on Render
// So we only handle API routes here, not frontend routes
app.use('*', (req, res) => {
  // Only handle API routes
  if (req.path.startsWith('/api')) {
    console.log(`❌ API route not found: ${req.method} ${req.path}`);
    return res.status(404).json({
      success: false,
      message: 'Route not found'
    });
  }
  // For non-API routes, return 404 (frontend should handle these)
  res.status(404).json({
    success: false,
    message: 'Route not found. This is the API server. Please use the frontend URL.'
  });
});

// Database connection and server start
const startServer = async () => {
  try {
    // Test database connection
    await db.query('SELECT 1');
    console.log('✅ Database connected successfully');
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API URL: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
