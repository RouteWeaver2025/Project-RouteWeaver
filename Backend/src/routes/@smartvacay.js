import express from 'express';
import { getVacaySuggestions } from '../utils/smartvacay.js';

const smartVacayRouter = express.Router();

/**
 * Route to get vacation suggestions based on trip duration
 * @route GET /smartvacay/suggestions
 * @param {string} location - User's starting location
 * @param {number} [tripDays=2] - Number of days for the trip
 * @returns {Object} Vacation suggestion data
 */
smartVacayRouter.get('/suggestions', async (req, res) => {
  try {
    const { location, tripDays = 2 } = req.query;
    
    if (!location) {
      return res.status(400).json({ 
        success: false,
        error: "Location parameter is required." 
      });
    }
    
    console.log(`Getting vacation suggestions for location: ${location}, trip days: ${tripDays}`);
    
    // Get suggestions from the utility function
    const suggestions = await getVacaySuggestions(location, tripDays);
    
    if (!suggestions.success) {
      return res.status(500).json({
        success: false,
        error: suggestions.error || "Failed to get vacation suggestions"
      });
    }
    
    // Return the suggestions
    return res.json({
      success: true,
      shortDistance: suggestions.shortDistance,
      mediumDistance: suggestions.mediumDistance,
      longDistance: suggestions.longDistance
    });
  } catch (error) {
    console.error("Error in vacation suggestions route:", error);
    return res.status(500).json({ 
      success: false,
      error: "Failed to get vacation suggestions"
    });
  }
});

export default smartVacayRouter; 