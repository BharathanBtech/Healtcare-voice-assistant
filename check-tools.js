const { Client } = require('pg');

// Database configuration
const dbConfig = {
  host: '172.16.10.130',
  port: 5432,
  user: 'pega',
  password: '0okmNJI(8uhb',
  database: 'voiceagent',
};

async function checkTools() {
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

    // Get tools for this user
    const toolsResult = await client.query(
      'SELECT id, name, description, is_active, created_at FROM tools WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    console.log(`\n🔧 Found ${toolsResult.rows.length} tools:`);
    
    if (toolsResult.rows.length === 0) {
      console.log('   No tools found for demo user');
    } else {
      toolsResult.rows.forEach((tool, index) => {
        console.log(`   ${index + 1}. ${tool.name}`);
        console.log(`      ID: ${tool.id}`);
        console.log(`      Description: ${tool.description || 'No description'}`);
        console.log(`      Active: ${tool.is_active}`);
        console.log(`      Created: ${tool.created_at}`);
        console.log('');
      });
    }

    // Check tool fields for each tool
    for (const tool of toolsResult.rows) {
      const fieldsResult = await client.query(
        'SELECT id, name, field_type, is_required, field_order FROM tool_fields WHERE tool_id = $1 ORDER BY field_order',
        [tool.id]
      );
      
      console.log(`📝 Tool "${tool.name}" has ${fieldsResult.rows.length} fields:`);
      if (fieldsResult.rows.length === 0) {
        console.log('   No fields defined');
      } else {
        fieldsResult.rows.forEach((field, index) => {
          console.log(`   ${index + 1}. ${field.name} (${field.field_type}) ${field.is_required ? '- Required' : '- Optional'}`);
        });
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('🔐 Database connection closed');
  }
}

// Run the check
checkTools();
