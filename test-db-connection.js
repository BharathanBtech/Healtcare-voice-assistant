const { Client } = require('pg');

const dbConfig = {
  host: '172.16.10.130',
  port: 5432,
  user: 'pega',
  password: '0okmNJI(8uhb',
  database: 'voiceagent',
};

async function testConnection() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔗 Testing database connection...');
    
    // Set a shorter timeout
    client._connect = client.connect;
    client.connect = function() {
      return Promise.race([
        this._connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout (5s)')), 5000)
        )
      ]);
    };
    
    await client.connect();
    console.log('✅ Database connection successful');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('⏰ Database time:', result.rows[0].current_time);
    
    // Test user count
    const userCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log('👥 User count:', userCount.rows[0].count);
    
  } catch (error) {
    console.log('❌ Database connection failed:', error.message);
    console.log('   This could be due to:');
    console.log('   1. PostgreSQL server not running on 172.16.10.130:5432');
    console.log('   2. Network connectivity issues');
    console.log('   3. Database credentials changed');
    console.log('   4. Firewall blocking the connection');
  } finally {
    try {
      await client.end();
      console.log('🔐 Database connection closed');
    } catch (e) {
      // Ignore close errors
    }
  }
}

testConnection();
