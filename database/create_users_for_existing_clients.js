const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createUsersForExistingClients() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'client_management',
      port: process.env.DB_PORT || 3306,
    });

    console.log('✅ Connected to database');

    // Get all clients that don't have a user account yet
    const [clients] = await connection.execute(
      `SELECT c.* 
       FROM clients c
       LEFT JOIN users u ON u.client_id = c.id
       WHERE u.id IS NULL
       AND c.email IS NOT NULL
       AND c.email != ''`
    );

    if (clients.length === 0) {
      console.log('ℹ️  No clients found without user accounts.');
      return;
    }

    console.log(`📋 Found ${clients.length} clients without user accounts.`);
    console.log('');

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const client of clients) {
      try {
        // Check if a user with this email already exists (but not linked to client)
        const [existingUsers] = await connection.execute(
          'SELECT id FROM users WHERE email = ?',
          [client.email]
        );

        if (existingUsers.length > 0) {
          console.log(`⏭️  Skipping ${client.full_name} (${client.email}) - User with this email already exists`);
          skipped++;
          continue;
        }

        // Generate username from email
        const usernameBase = client.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
        let username = usernameBase;
        let counter = 1;
        
        // Ensure username is unique
        while (true) {
          const [usernameCheck] = await connection.execute(
            'SELECT id FROM users WHERE username = ?',
            [username]
          );
          if (usernameCheck.length === 0) break;
          username = `${usernameBase}${counter}`;
          counter++;
        }

        // Generate a random secure password
        const randomPassword = Math.random().toString(36).slice(-8) + 
                              Math.random().toString(36).slice(-8) + 
                              'A1!';
        const hashedPassword = await bcrypt.hash(randomPassword, 12);

        // Create user account
        await connection.execute(
          `INSERT INTO users (username, email, password, full_name, role, client_id, is_active)
           VALUES (?, ?, ?, ?, 'client', ?, 1)`,
          [username, client.email, hashedPassword, client.full_name, client.id]
        );

        console.log(`✅ Created user for: ${client.full_name}`);
        console.log(`   Email: ${client.email}`);
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${randomPassword}`);
        console.log('');

        created++;
      } catch (error) {
        console.error(`❌ Error creating user for ${client.full_name} (${client.email}):`, error.message);
        errors++;
      }
    }

    console.log('');
    console.log('📊 Summary:');
    console.log(`   ✅ Created: ${created} users`);
    console.log(`   ⏭️  Skipped: ${skipped} clients`);
    console.log(`   ❌ Errors: ${errors} clients`);
    console.log('');

    if (created > 0) {
      console.log('⚠️  IMPORTANT: Save the passwords shown above. They will not be displayed again.');
      console.log('   Consider sending these credentials to clients via email or secure channel.');
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

createUsersForExistingClients();
