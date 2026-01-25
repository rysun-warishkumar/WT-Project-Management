const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Client Management System...\n');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('✅ Created uploads directory');
}

// Create .env file if it doesn't exist
const envFile = path.join(__dirname, '.env');
const envExampleFile = path.join(__dirname, 'env.example');

if (!fs.existsSync(envFile) && fs.existsSync(envExampleFile)) {
  fs.copyFileSync(envExampleFile, envFile);
  console.log('✅ Created .env file from template');
  console.log('⚠️  Please update .env file with your database credentials');
}

console.log('\n📋 Setup complete! Next steps:');
console.log('1. Update .env file with your database credentials');
console.log('2. Start XAMPP and ensure MySQL is running');
console.log('3. Import database/schema.sql into your MySQL database');
console.log('4. Run: npm run install-all');
console.log('5. Run: npm run dev');
console.log('\n🎉 Your Client Management System is ready to use!');
