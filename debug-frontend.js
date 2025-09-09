// Mock the frontend authentication and API flow
const axios = require('axios');

async function testFrontendFlow() {
  try {
    console.log('🔐 Testing frontend authentication flow...\n');
    
    // Step 1: Login
    console.log('1. Attempting login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'demo',
      password: 'demo123'
    });
    
    if (!loginResponse.data.success) {
      console.log('❌ Login failed:', loginResponse.data.error);
      return;
    }
    
    console.log('✅ Login successful');
    console.log(`   User: ${loginResponse.data.user.username}`);
    console.log(`   Role: ${loginResponse.data.user.role}`);
    console.log(`   Token received: ${loginResponse.data.token.substring(0, 50)}...`);
    
    const token = loginResponse.data.token;
    
    // Step 2: Fetch tools with authentication
    console.log('\n2. Fetching tools with authentication...');
    const toolsResponse = await axios.get('http://localhost:3001/api/tools', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!toolsResponse.data.success) {
      console.log('❌ Tools fetch failed:', toolsResponse.data.error);
      return;
    }
    
    console.log('✅ Tools fetched successfully');
    console.log(`   Number of tools: ${toolsResponse.data.data.length}`);
    
    toolsResponse.data.data.forEach((tool, index) => {
      console.log(`   ${index + 1}. ${tool.name}`);
      console.log(`      Fields: ${tool.fields ? tool.fields.length : 0}`);
      console.log(`      Description: ${tool.description}`);
    });
    
    // Step 3: Test specific tool details
    if (toolsResponse.data.data.length > 0) {
      console.log('\n3. Testing individual tool fetch...');
      const firstTool = toolsResponse.data.data[0];
      
      const toolDetailResponse = await axios.get(`http://localhost:3001/api/tools/${firstTool.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (toolDetailResponse.data.success) {
        console.log('✅ Individual tool fetch successful');
        console.log(`   Tool: ${toolDetailResponse.data.data.name}`);
        console.log(`   Fields: ${toolDetailResponse.data.data.fields.length}`);
      } else {
        console.log('❌ Individual tool fetch failed:', toolDetailResponse.data.error);
      }
    }
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\nThe backend API is working correctly. The issue is likely in the frontend.');
    
  } catch (error) {
    console.log('❌ Error during testing:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Response:', error.response.data);
    }
  }
}

testFrontendFlow();
