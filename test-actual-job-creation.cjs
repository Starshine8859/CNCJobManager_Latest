// Test actual job creation through the API
// Using built-in fetch (Node.js 18+)

async function testActualJobCreation() {
  try {
    console.log('🧪 Testing actual job creation through API...\n');

    // Step 1: Get available colors/supplies
    console.log('1. Fetching available colors/supplies...');
    const colorsResponse = await fetch('http://localhost:5000/api/colors');
    
    if (!colorsResponse.ok) {
      throw new Error(`Failed to fetch colors: ${colorsResponse.status} ${colorsResponse.statusText}`);
    }
    
    const colors = await colorsResponse.json();
    console.log(`Found ${colors.length} available colors/supplies:`);
    colors.forEach(color => {
      console.log(`  - ID ${color.id}: ${color.name} (${color.hexColor})`);
    });

    if (colors.length === 0) {
      console.log('❌ No colors/supplies available. Cannot test job creation.');
      return;
    }

    // Step 2: Create a test job
    console.log('\n2. Creating test job...');
    const testJob = {
      customerName: "Test Customer After Migration",
      jobName: "Test Job Created After Migration",
      materials: [
        {
          colorId: colors[0].id,
          totalSheets: 2
        }
      ]
    };

    console.log('Job data to send:');
    console.log(JSON.stringify(testJob, null, 2));

    const jobResponse = await fetch('http://localhost:5000/api/jobs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testJob)
    });

    if (!jobResponse.ok) {
      const errorText = await jobResponse.text();
      throw new Error(`Failed to create job: ${jobResponse.status} ${jobResponse.statusText}\n${errorText}`);
    }

    const createdJob = await jobResponse.json();
    console.log('\n✅ Job created successfully!');
    console.log('Created job details:');
    console.log(JSON.stringify(createdJob, null, 2));

    // Step 3: Verify the job was created correctly
    console.log('\n3. Verifying job creation...');
    const jobId = createdJob.id;
    
    const verifyResponse = await fetch(`http://localhost:5000/api/jobs/${jobId}`);
    
    if (!verifyResponse.ok) {
      throw new Error(`Failed to fetch created job: ${verifyResponse.status} ${verifyResponse.statusText}`);
    }

    const fetchedJob = await verifyResponse.json();
    console.log('✅ Job verification successful!');
    console.log(`Job ID: ${fetchedJob.id}`);
    console.log(`Job Number: ${fetchedJob.jobNumber}`);
    console.log(`Customer: ${fetchedJob.customerName}`);
    console.log(`Job Name: ${fetchedJob.jobName}`);
    console.log(`Status: ${fetchedJob.status}`);
    console.log(`Materials: ${fetchedJob.materials?.length || 0} materials`);

    if (fetchedJob.materials && fetchedJob.materials.length > 0) {
      console.log('Material details:');
      fetchedJob.materials.forEach((material, index) => {
        console.log(`  Material ${index + 1}:`);
        console.log(`    - Supply ID: ${material.colorId}`);
        console.log(`    - Total Sheets: ${material.totalSheets}`);
        console.log(`    - Completed Sheets: ${material.completedSheets}`);
      });
    }

    console.log('\n🎉 Job creation test completed successfully!');
    console.log('✅ The "Create Job" button should now work correctly!');

  } catch (error) {
    console.error('❌ Job creation test failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
  }
}

testActualJobCreation(); 