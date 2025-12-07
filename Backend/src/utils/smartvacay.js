//for smartvacay
import { getCozy } from './gemini.js';

/**
 * Gets vacation suggestions based on trip duration
 * @param {string} location - User's starting location
 * @param {number} tripDays - Number of days for the trip
 * @returns {Object} - Short, medium, and long distance vacation places
 */
export const getVacaySuggestions = async (location, tripDays = 2) => {
  try {
    console.log(`Fetching vacation suggestions for location: ${location}, trip days: ${tripDays}`);
    
    if (!location) {
      throw new Error("Location is required to get vacation suggestions");
    }
    
    // Ensure tripDays is a valid number
    const days = parseInt(tripDays);
    if (isNaN(days) || days <= 0) {
      console.warn(`Invalid trip days: ${tripDays}, using default value of 2`);
      tripDays = 2;
    }
    
    // Call the getCozy function from gemini.js to get curated suggestions based on trip duration
    const suggestions = await getCozy(location, days);
    
    return {
      success: true,
      shortDistance: suggestions.shortDistancePlaces || [],
      mediumDistance: suggestions.mediumDistancePlaces || [],
      longDistance: suggestions.longDistancePlaces || []
    };
  } catch (error) {
    console.error("Error in getVacaySuggestions:", error);
    return {
      success: false,
      error: error.message || "Failed to get vacation suggestions",
      shortDistance: [],
      mediumDistance: [],
      longDistance: []
    };
  }
};