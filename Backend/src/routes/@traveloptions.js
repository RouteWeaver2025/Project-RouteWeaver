import express from 'express';
import { getNearbyPlaces, getDistantPlaces } from '../utils/place.js';

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

export default travelRouter; 