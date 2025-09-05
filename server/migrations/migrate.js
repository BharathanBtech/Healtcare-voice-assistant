const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Database configuration
const dbConfig = {
  host: '172.16.10.130',
  port: 5432,
  user: 'pega',
  password: '0okmNJI(8uhb',
  database: 'voiceagent',
};

async function runMigration() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔗 Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Read and execute schema file
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🚀 Running database migration...');
    await client.query(schemaSql);
    console.log('✅ Database schema created successfully');

    // Create users with proper UUID and password hash
    const saltRounds = 12;
    
    // Create admin user
    const adminPassword = 'admin123';
    const hashedAdminPassword = await bcrypt.hash(adminPassword, saltRounds);
    const adminId = crypto.randomUUID();
    
    // Create demo user
    const demoPassword = 'demo123';
    const hashedDemoPassword = await bcrypt.hash(demoPassword, saltRounds);
    const demoId = crypto.randomUUID();
    
    // Insert user query
    const insertUserQuery = `
      INSERT INTO users (id, username, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP;
    `;
    
    // Insert admin user
    await client.query(insertUserQuery, [
      adminId, 'admin', 'admin@healthcare.com', hashedAdminPassword, 'admin'
    ]);
    console.log('✅ Admin user created with secure password');
    
    // Insert demo user
    await client.query(insertUserQuery, [
      demoId, 'demo', 'demo@healthcare.com', hashedDemoPassword, 'user'
    ]);
    console.log('✅ Demo user created with secure password');

    // Verify tables were created
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const result = await client.query(tablesQuery);
    console.log('📋 Created tables:');
    result.rows.forEach(row => {
      console.log(`   - ${row.table_name}`);
    });

    console.log('\n🎉 Database migration completed successfully!');
    console.log('\n📝 Default User Credentials:');
    console.log('   👨‍⚕️ Admin User:');
    console.log('     Username: admin');
    console.log('     Password: admin123');
    console.log('   👤 Demo User:');
    console.log('     Username: demo');
    console.log('     Password: demo123');
    console.log('   ⚠️  Please change these passwords after first login!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔐 Database connection closed');
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, dbConfig };
