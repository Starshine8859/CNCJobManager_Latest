import 'dotenv/config';

async function testPurchaseOrder() {
  try {
    console.log('Testing purchase order creation...');
    
    // Test data
    const orderData = {
      additionalComments: "Test purchase order",
      status: "pending"
    };
    
    const items = [
      {
        supplyId: 7,
        vendorId: 1,
        quantity: 10,
        pricePerUnit: 2500, // $25.00 in cents
        totalPrice: 25000
      }
    ];
    
    const response = await fetch('http://localhost:80/api/purchase-orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderData,
        items
      }),
      credentials: 'include'
    });
    
    console.log('Response status:', response.status);
    
    if (response.ok) {
      const result = await response.json();
      console.log('Purchase order created successfully:', result);
    } else {
      const error = await response.text();
      console.error('Failed to create purchase order:', error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testPurchaseOrder();

