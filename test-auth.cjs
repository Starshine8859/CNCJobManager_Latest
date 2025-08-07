// Test authentication status
async function testAuth() {
  try {
    console.log('Testing authentication...');
    
    // Test /api/me endpoint
    const meResponse = await fetch('http://localhost:5000/api/me', {
      credentials: 'include'
    });
    
    console.log('Auth response status:', meResponse.status);
    
    if (meResponse.ok) {
      const userData = await meResponse.json();
      console.log('User authenticated:', userData);
    } else {
      const errorText = await meResponse.text();
      console.log('Not authenticated:', errorText);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAuth(); 