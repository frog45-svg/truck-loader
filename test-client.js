const http = require('http');
const fs = require('fs');
const path = require('path');

// Mock data representing a complete trip run payload
const mockPayload = {
  trip: {
    trip_code: 'TR-MOCK-99',
    status: 'completed',
    truck_number: 'MH-12-PQ-9999',
    driver_name: 'Rajesh Kumar',
    from_location: 'Mumbai',
    to_location: 'Delhi',
    loading_date: '2026-06-01',
    delivery_date: '2026-06-05',
    party_name: 'Balaji Logistics',
    goods_type: 'Steel Pipes',
    weight_tons: 21.5,
    freight_amount: 85000,
    start_km: 120500,
    end_km: 121950,
    notes: 'Fragile delivery. All consignments received in perfect shape.'
  },
  summary: {
    total_income_received: 85000,
    total_expense: 62000,
    actual_profit: 23000,
    balance_receivable: 0
  },
  incomeList: [
    { id: 1, date: '2026-06-01', payment_mode: 'upi', income_type: 'advance', reference_number: 'TXN111222', is_received: true, amount: 45000 },
    { id: 2, date: '2026-06-05', payment_mode: 'bank', income_type: 'balance', reference_number: 'TXN333444', is_received: true, amount: 40000 }
  ],
  dieselList: [
    { id: 1, date: '2026-06-02', fuel_station: 'HP Pump Jaipur', liters: 250, rate_per_liter: 92.40, total_amount: 23100, odometer_km: 121100 },
    { id: 2, date: '2026-06-04', fuel_station: 'IOCL Gurgaon', liters: 200, rate_per_liter: 94.50, total_amount: 18900, odometer_km: 121750 }
  ],
  advancesList: [
    { id: 1, date: '2026-06-01', reason: 'Toll cash & Food', payment_mode: 'cash', given_by: 'Office Account', is_settled: true, amount: 15000 }
  ],
  otherList: [
    { id: 1, date: '2026-06-02', category: 'toll', paid_by: 'Driver', place_vendor: 'Jaipur Toll Plaza', payment_mode: 'cash', amount: 3500 },
    { id: 2, date: '2026-06-03', category: 'repair', paid_by: 'Driver', place_vendor: 'Verma Tyres', payment_mode: 'cash', amount: 1500 }
  ]
};

const postData = JSON.stringify(mockPayload);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/generate-pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Sending test PDF request to http://localhost:5000/api/generate-pdf ...');

const req = http.request(options, (res) => {
  if (res.statusCode !== 200) {
    console.error(`Failed with status: ${res.statusCode}`);
    res.resume();
    return;
  }

  const outputPath = path.join(__dirname, 'test-report.pdf');
  const fileStream = fs.createWriteStream(outputPath);
  
  res.pipe(fileStream);
  
  fileStream.on('finish', () => {
    console.log(`✅ Success! Test PDF report generated and saved to ${outputPath}`);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
  console.log('Make sure the server is running locally on port 5000 (npm run dev / node server.js)');
});

req.write(postData);
req.end();
