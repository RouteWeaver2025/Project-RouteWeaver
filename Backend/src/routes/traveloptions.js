import express from 'express';
import { getNearbyPlaces, getDistantPlaces } from '../utils/place.js';

const placeRouter = express.Router();

// Route to get nearby places (within 80km)
placeRouter.get('/nearby', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing latitude or longitude parameters' });
    }
    
    const coords = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    
    const result = await getNearbyPlaces(coords);
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in nearby places route:', error);
    res.status(500).json({ error: 'Server error while fetching nearby places' });
  }
});

// Route to get distant places (80km - 1000km), replacing the state route
placeRouter.get('/distant', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing latitude or longitude parameters' });
    }
    
    const coords = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    
    const result = await getDistantPlaces(coords);
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in distant places route:', error);
    res.status(500).json({ error: 'Server error while fetching distant places' });
  }
});

// Keep the state route for backward compatibility
placeRouter.get('/state', async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Missing latitude or longitude parameters' });
    }
    
    const coords = {
      lat: parseFloat(lat),
      lng: parseFloat(lng)
    };
    
    // Use getDistantPlaces instead but retain the same response format
    const result = await getDistantPlaces(coords);
    
    if (result.error) {
      return res.status(400).json({ error: result.error });
    }
    
    // For backward compatibility, always use "Unknown Region" as state name
    res.json({ 
      stateName: "Popular Tourist Destinations", 
      places: result.places 
    });
  } catch (error) {
    console.error('Error in state places route:', error);
    res.status(500).json({ error: 'Server error while fetching state places' });
  }
});

export default placeRouter; 