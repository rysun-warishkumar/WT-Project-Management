const mysql = require('mysql2/promise');
require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');

async function setupRolesAndPermissions() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'client_management',
      port: process.env.DB_PORT || 3306,
      multipleStatements: true
    });

    console.log('✅ Connected to database');

    // Read and execute the schema file
    const schemaPath = path.join(__dirname, 'roles_permissions_schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');

    // Split by semicolon and execute each statement
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await connection.query(statement);
      } catch (error) {
        // Ignore errors for "IF NOT EXISTS" or "IF EXISTS" statements
        if (!error.message.includes('already exists') && 
            !error.message.includes('Duplicate key') &&
            !error.message.includes('Unknown column')) {
          console.warn('Warning executing statement:', error.message);
        }
      }
    }

    console.log('✅ Roles and permissions schema setup completed');
    console.log('✅ Default roles and permissions have been created');

  } catch (error) {
    console.error('❌ Error setting up roles and permissions:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

setupRolesAndPermissions();
