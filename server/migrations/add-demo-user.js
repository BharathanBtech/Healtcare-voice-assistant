const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Database configuration (same as migrate.js)
const dbConfig = {
  host: '172.16.10.130',
  port: 5432,
  user: 'pega',
  password: '0okmNJI(8uhb',
  database: 'voiceagent',
};

async function addDemoUser() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔗 Connecting to PostgreSQL database...');
    await client.connect();
    console.log('✅ Connected to database successfully');

    // Create demo user with proper UUID and password hash
    const demoPassword = 'demo123';
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(demoPassword, saltRounds);
    const demoId = crypto.randomUUID();
    
    // Insert demo user
    const insertDemoQuery = `
      INSERT INTO users (id, username, email, password_hash, role)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (username) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        updated_at = CURRENT_TIMESTAMP;
    `;
    
    await client.query(insertDemoQuery, [
      demoId, 'demo', 'demo@healthcare.com', hashedPassword, 'user'
    ]);
    console.log('✅ Demo user created/updated successfully');

    console.log('\n🎉 Demo user setup completed!');
    console.log('\n📝 Demo Credentials:');
    console.log('   Username: demo');
    console.log('   Password: demo123');
    
  } catch (error) {
    console.error('❌ Failed to create demo user:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔐 Database connection closed');
  }
}

// Run if called directly
if (require.main === module) {
  addDemoUser();
}

module.exports = { addDemoUser };
