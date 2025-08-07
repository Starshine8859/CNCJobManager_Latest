// Using built-in fetch (Node.js 18+)

async function testUpdateSupply() {
  try {
    console.log('Testing update supply API...');
    
    // First, let's get a supply to update
    const getResponse = await fetch('http://localhost:5000/api/supplies', {
      credentials: 'include'
    });
    
    if (!getResponse.ok) {
      console.error('Failed to get supplies:', getResponse.status, await getResponse.text());
      return;
    }
    
    const supplies = await getResponse.json();
    console.log('Found supplies:', supplies.length);
    
    if (supplies.length === 0) {
      console.log('No supplies to test with');
      return;
    }
    
    const supplyToUpdate = supplies[0];
    console.log('Updating supply:', supplyToUpdate.id);
    
    // Test update with minimal data
    const updateData = {
      name: supplyToUpdate.name + ' (Updated)',
      hexColor: supplyToUpdate.hexColor,
      pieceSize: supplyToUpdate.pieceSize,
      partNumber: supplyToUpdate.partNumber || '',
      description: supplyToUpdate.description || '',
      availableInCatalog: supplyToUpdate.availableInCatalog || false,
      retailPrice: supplyToUpdate.retailPrice || 0,
      imageUrl: supplyToUpdate.imageUrl,
      texture: supplyToUpdate.texture,
      vendors: [],
      locations: []
    };
    
    console.log('Update data:', JSON.stringify(updateData, null, 2));
    
    const updateResponse = await fetch(`http://localhost:5000/api/supplies/${supplyToUpdate.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(updateData)
    });
    
    console.log('Update response status:', updateResponse.status);
    
    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Update failed:', errorText);
      return;
    }
    
    const result = await updateResponse.json();
    console.log('Update successful:', result);
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testUpdateSupply(); 