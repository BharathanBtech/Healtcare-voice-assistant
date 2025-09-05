const { Client } = require('pg');

const dbConfig = {
  host: '172.16.10.130',
  port: 5432,
  user: 'pega',
  password: '0okmNJI(8uhb',
  database: 'voiceagent',
};

async function checkUserId() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');
    
    // Get the demo user ID
    const userResult = await client.query('SELECT id, username, email FROM users WHERE username = $1', ['demo']);
    
    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      console.log('👤 Demo user found:');
      console.log('  ID:', user.id);
      console.log('  Username:', user.username);
      console.log('  Email:', user.email);
    } else {
      console.log('❌ Demo user not found');
    }
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await client.end();
    console.log('🔐 Database connection closed');
  }
}

checkUserId();
