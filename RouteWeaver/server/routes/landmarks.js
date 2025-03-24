/**
 * Fetch potential vacation destinations based on a location and distance requirements
 * 
 * Query params:
 * - location: Starting location (e.g., "Delhi, India")
 * - tripType: "short", "medium", or "long"
 */
router.get('/vacationDestinations', async (req, res) => {
  try {
    console.log("Proxying vacation destinations request to backend");
    // Forward the request to the backend implementation
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const response = await axios.get(`${backendUrl}/api/landmarks/vacationDestinations`, {
      params: req.query
    });
    
    // Return the backend response
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying vacation destinations request:', error);
    // Forward any error from the backend
    const status = error.response?.status || 500;
    const errorData = error.response?.data || { 
      error: 'Failed to fetch destinations from backend',
      details: error.message
    };
    
    res.status(status).json(errorData);
  }
});

// Leaving these functions here to support other parts of the proxy server that might need them,
// but the vacationDestinations implementation is now in the Backend/src/utils/landmarks.js file
// Haversine formula to calculate distance between coordinates in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export default router; 