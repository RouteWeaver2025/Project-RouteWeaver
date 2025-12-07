import express from 'express';
import { getNearbyPlaces, getDistantPlaces, getRoutePlaces } from '../utils/options.js';
import { getCost } from '../utils/gemini.js';

const travelRouter = express.Router();

/**
 * Route to get nearby tourist attractions (within 80km)
 * @route GET /travel/nearby
 * @param {string} lat - Latitude coordinate
 * @param {string} lng - Longitude coordinate
 * @returns {Object} Nearby places object
 */
travelRouter.get('/nearby', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: 'Missing latitude or longitude parameters' 
      });
    }
    
    const coords = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    
    // Call the utility function from place.js
    const result = await getNearbyPlaces(coords, 50000, 8); // 50km radius, 8 results
    
    if (result.error) {
      console.error(`Error in nearby places: ${result.error}`);
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in nearby places route:', error);
    res.status(500).json({ 
      error: 'Server error while fetching nearby places',
      details: error.message 
    });
  }
});

/**
 * Route to get distant tourist attractions (80km - 1000km)
 * @route GET /travel/distant
 * @param {string} lat - Latitude coordinate
 * @param {string} lng - Longitude coordinate
 * @returns {Object} Distant places object
 */
travelRouter.get('/distant', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: 'Missing latitude or longitude parameters' 
      });
    }
    
    const coords = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    
    // Call the utility function from place.js
    const result = await getDistantPlaces(coords, 8); // 8 results
    
    if (result.error) {
      console.error(`Error in distant places: ${result.error}`);
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in distant places route:', error);
    res.status(500).json({ 
      error: 'Server error while fetching distant places',
      details: error.message 
    });
  }
});

/**
 * Route to get places along a route between origin and destination
 * @route GET /travel/routePlaces
 * @param {string} origin - Origin location name
 * @param {string} destination - Destination location name
 * @param {string} [keyword] - Optional keyword for place type (default: tourist attractions)
 * @returns {Object} Places and route data
 */
travelRouter.get('/routePlaces', getRoutePlaces);

/**
 * Route to get estimated travel cost
 * @route POST /travel/cost
 * @param {string} origin - Origin location name
 * @param {string} destination - Destination location name
 * @param {Array} places - Array of place names to visit
 * @param {number} numPeople - Number of people traveling
 * @returns {Object} Cost estimate data
 */
travelRouter.post('/cost', async (req, res) => {
  try {
    const { origin, destination, places, numPeople } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ 
        error: "Missing parameters. Both origin and destination are required." 
      });
    }

    // Default to 2 people if not specified
    const travelers = numPeople || 2;
    
    console.log(`Estimating cost for trip from ${origin} to ${destination} for ${travelers} people`);
    console.log(`Places to visit: ${places ? places.join(', ') : 'None'}`);
    
    // Get cost estimate from Gemini
    const costEstimate = await getCost(origin, destination, places, travelers);
    
    // Return the cost estimate
    return res.json(costEstimate);
  } catch (error) {
    console.error("Error estimating travel cost:", error);
    return res.status(500).json({ 
      error: "Failed to estimate travel cost",
      totalCost: "Unknown"
    });
  }
});

export default travelRouter; 