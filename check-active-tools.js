const { Client } = require('pg');

// Database configuration
const dbConfig = {
  host: '172.16.10.130',
  port: 5432,
  user: 'pega',
  password: '0okmNJI(8uhb',
  database: 'voiceagent',
};

async function checkActiveTools() {
  const client = new Client(dbConfig);
  
  try {
    console.log('🔗 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    // Get demo user ID
    const userResult = await client.query(
      'SELECT id, username FROM users WHERE username = $1',
      ['demo']
    );

    if (userResult.rows.length === 0) {
      console.log('❌ Demo user not found');
      return;
    }

    const userId = userResult.rows[0].id;
    console.log(`👤 Demo user ID: ${userId}`);

    // Get all tools for this user (active and inactive)
    const allToolsResult = await client.query(
      'SELECT id, name, is_active, created_at FROM tools WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    console.log(`\n🔧 All tools (${allToolsResult.rows.length}):`);
    allToolsResult.rows.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name} - ${tool.is_active ? '✅ Active' : '❌ Inactive'}`);
      console.log(`      ID: ${tool.id}`);
      console.log(`      Created: ${tool.created_at}`);
      console.log('');
    });

    // Get active tools only
    const activeToolsResult = await client.query(
      'SELECT id, name, is_active, created_at FROM tools WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC',
      [userId]
    );

    console.log(`\n✅ Active tools only (${activeToolsResult.rows.length}):`);
    activeToolsResult.rows.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name}`);
      console.log(`      ID: ${tool.id}`);
      console.log(`      Created: ${tool.created_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('🔐 Database connection closed');
  }
}

// Run the check
checkActiveTools();
