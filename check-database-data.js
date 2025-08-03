const axios = require('axios');

async function checkDatabaseData() {
  console.log('=== DATABASE DATA CHECK ===');
  
  try {
    // Check if backend is running
    console.log('\n1. Checking backend health...');
    const healthResponse = await axios.get('http://localhost:5000/health');
    console.log('✅ Backend is running:', healthResponse.data);
    
    // Since we can't access the database directly without auth, let's check what endpoints are available
    console.log('\n2. Available endpoints (based on code analysis):');
    console.log('- GET /health (no auth required)');
    console.log('- GET /api/history (requires auth)');
    console.log('- GET /api/user-stats (requires auth)');
    console.log('- GET /api/devices (requires auth)');
    
    console.log('\n3. Expected data structure for heatmap:');
    console.log('- HistoryItem should have: dayOfWeek (0-6), duration (number)');
    console.log('- dayOfWeek: 0=Sunday, 1=Monday, ..., 6=Saturday');
    console.log('- duration: time spent in seconds');
    
    console.log('\n4. Possible issues:');
    console.log('- No data in database for the selected period');
    console.log('- Data exists but dayOfWeek/duration fields are missing or null');
    console.log('- Authentication issues preventing data access');
    console.log('- Date range filtering excluding all data');
    
    console.log('\n5. Next steps for debugging:');
    console.log('- Check browser console for the debug logs we just added');
    console.log('- Verify user is authenticated in the frontend');
    console.log('- Check if any history items exist in the database');
    console.log('- Verify the date range being queried');
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('Backend is not running. Start it with: cd backend && npm start');
    }
  }
}

checkDatabaseData(); 