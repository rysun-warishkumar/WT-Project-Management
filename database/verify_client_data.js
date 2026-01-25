/**
 * Verification script to check client user data association
 * Run this to verify that client users have correct client_id and data is linked properly
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function verifyClientData() {
  let connection;

  try {
    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'client_management',
      port: process.env.DB_PORT || 3306,
    });

    console.log('✅ Connected to database\n');

    // Find client users
    const [clientUsers] = await connection.execute(
      `SELECT u.id, u.username, u.email, u.full_name, u.role, u.client_id, 
              c.id as client_record_id, c.full_name as client_name, c.company_name
       FROM users u
       LEFT JOIN clients c ON u.client_id = c.id
       WHERE u.role = 'client'
       ORDER BY u.id`
    );

    console.log(`Found ${clientUsers.length} client users:\n`);

    for (const user of clientUsers) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`👤 User: ${user.full_name} (${user.email})`);
      console.log(`   Username: ${user.username}`);
      console.log(`   User ID: ${user.id}`);
      console.log(`   Client ID in users table: ${user.client_id || '❌ NOT SET'}`);
      
      if (user.client_id) {
        if (user.client_record_id) {
          console.log(`   ✅ Linked to client: ${user.client_name} (ID: ${user.client_record_id})`);
          if (user.company_name) {
            console.log(`      Company: ${user.company_name}`);
          }
        } else {
          console.log(`   ⚠️  Client ID ${user.client_id} exists in users table but client record not found!`);
        }

        // Check associated data
        const [projects] = await connection.execute(
          'SELECT COUNT(*) as count FROM projects WHERE client_id = ?',
          [user.client_id]
        );
        console.log(`   📁 Projects: ${projects[0].count}`);

        const [quotations] = await connection.execute(
          'SELECT COUNT(*) as count FROM quotations WHERE client_id = ?',
          [user.client_id]
        );
        console.log(`   📄 Quotations: ${quotations[0].count}`);

        const [invoices] = await connection.execute(
          'SELECT COUNT(*) as count FROM invoices WHERE client_id = ?',
          [user.client_id]
        );
        console.log(`   💰 Invoices: ${invoices[0].count}`);

        const [files] = await connection.execute(
          'SELECT COUNT(*) as count FROM files WHERE client_id = ?',
          [user.client_id]
        );
        console.log(`   📎 Files: ${files[0].count}`);

        const [credentials] = await connection.execute(
          'SELECT COUNT(*) as count FROM credentials WHERE client_id = ?',
          [user.client_id]
        );
        console.log(`   🔑 Credentials: ${credentials[0].count}`);

        const [conversations] = await connection.execute(
          'SELECT COUNT(*) as count FROM conversations WHERE client_id = ?',
          [user.client_id]
        );
        console.log(`   💬 Conversations: ${conversations[0].count}`);
      } else {
        console.log(`   ❌ No client_id set! This user will not see any filtered data.`);
        console.log(`   💡 To fix: Update users table to set client_id for this user.`);
      }
      console.log('');
    }

    // Check for clients without users
    const [clientsWithoutUsers] = await connection.execute(
      `SELECT c.id, c.full_name, c.email, c.company_name
       FROM clients c
       LEFT JOIN users u ON c.id = u.client_id AND u.role = 'client'
       WHERE u.id IS NULL
       LIMIT 10`
    );

    if (clientsWithoutUsers.length > 0) {
      console.log(`\n⚠️  Found ${clientsWithoutUsers.length} clients without client user accounts:`);
      clientsWithoutUsers.forEach(client => {
        console.log(`   - ${client.full_name} (ID: ${client.id}, Email: ${client.email})`);
      });
      console.log(`\n💡 Tip: Run create_users_for_existing_clients.js to create user accounts for these clients.`);
    }

    console.log('\n✅ Verification complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error(`   Error Code: ${error.code}`);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Run verification
verifyClientData();
