// Using built-in fetch (Node.js 18+)

async function testJobCreation() {
  try {
    console.log('🧪 Testing job creation...');
    
    // First, let's get the available colors/supplies
    const colorsResponse = await fetch('http://localhost:5000/api/colors');
    const colors = await colorsResponse.json();
    
    console.log(`Found ${colors.length} available colors/supplies:`);
    colors.forEach(color => {
      console.log(`  - ID ${color.id}: ${color.name} (${color.hexColor})`);
    });
    
    if (colors.length === 0) {
      console.log('❌ No colors/supplies available. Cannot test job creation.');
      return;
    }
    
    // Create a test job
    const testJob = {
      customerName: "Test Customer",
      jobName: "Test Job",
      materials: [
        {
          colorId: colors[0].id,
          totalSheets: 2
        }
      ]
    };
    
    console.log('\n📝 Creating test job:', JSON.stringify(testJob, null, 2));
    
    const createResponse = await fetch('http://localhost:5000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testJob)
    });
    
    if (createResponse.ok) {
      const createdJob = await createResponse.json();
      console.log('✅ Job created successfully!');
      console.log('Job details:', JSON.stringify(createdJob, null, 2));
    } else {
      const error = await createResponse.text();
      console.log('❌ Job creation failed:');
      console.log('Status:', createResponse.status);
      console.log('Error:', error);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testJobCreation(); 