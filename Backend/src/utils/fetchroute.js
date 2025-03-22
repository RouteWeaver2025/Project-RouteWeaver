import { Route } from '../models/routes.js';
import { decodeRouteData } from './saveroute.js';

/**
 * Extracts origin and destination from encoded route data
 * @param {string} encodedRouteData - The encoded route string
 * @returns {Object} - Origin and destination locations
 */
async function getOD(encodedRouteData) {
  try {
    // Decode the route data using the decoder from saveroute.js
    const decoded = decodeRouteData(encodedRouteData);
    
    // Return the origin and destination in the format expected by the frontend
    return {
      origin: decoded.origin,
      destination: decoded.destination
    };
  } catch (error) {
    console.error("Error extracting origin/destination:", error);
    return { 
      origin: "Unknown origin", 
      destination: "Unknown destination" 
    };
  }
}

/**
 * Fetch a specific route by ID
 * @param {Object} req - Express request object with email and routeId
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with detailed route data or error
 */
async function getRouteById(req, res) {
  try {
    const { email, routeId } = req.params;
    
    if (!email || !routeId) {
      return res.status(400).json({ 
        message: "Email and routeId are required to fetch route details" 
      });
    }

    console.log(`Fetching route ID: ${routeId} for user: ${email}`);

    // Fetch the user's saved routes from MongoDB
    const user = await Route.findOne({ user: email });

    if (!user || !user.routes || user.routes.length === 0) {
      console.log("No routes found for user:", email);
      return res.status(404).json({ message: "No routes found for this user" });
    }

    // Find the specific route by ID
    const routeData = user.routes.find(route => route.id.toString() === routeId);
    
    if (!routeData) {
      console.log(`Route ID ${routeId} not found for user ${email}`);
      return res.status(404).json({ message: "Route not found" });
    }

    // Decode the route data
    const decodedRoute = decodeRouteData(routeData.routeData);
    
    console.log(`Successfully retrieved route ID: ${routeId}`);
    
    // Return the full route details including places
    return res.json({
      id: routeData.id,
      origin: decodedRoute.origin,
      destination: decodedRoute.destination,
      places: decodedRoute.places.map(place => ({
        ...place,
        checked: true // All places are checked by default in summary view
      }))
    });
  } catch (error) {
    console.error("Error fetching route by ID:", error);
    res.status(500).json({ 
      message: "Server error while fetching route",
      error: error.message
    });
  }
}

/**
 * Fetch all saved routes for a user
 * @param {Object} req - Express request object with email in body
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with route data or error
 */
async function fetchSavedRoutes(req, res) {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        message: "Email is required to fetch saved routes" 
      });
    }

    console.log("Fetching routes for user:", email);

    // Fetch the user's saved routes from MongoDB
    const user = await Route.findOne({ user: email });

    if (!user || !user.routes || user.routes.length === 0) {
      console.log("No routes found for user:", email);
      return res.status(404).json({ message: "No available routes" });
    }

    console.log(`Found ${user.routes.length} routes for user:`, email);
    
    // Create an object to hold route data with IDs as keys
    const routesObject = {};

    // Process each route to extract origin and destination
    await Promise.all(user.routes.map(async (route) => {
      const { origin, destination } = await getOD(route.routeData);
      routesObject[route.id] = { origin, destination };
    }));

    return res.json(routesObject);
  } catch (error) {
    console.error("Error fetching routes:", error);
    res.status(500).json({ 
      message: "Server error while fetching routes",
      error: error.message
    });
  }
}

/**
 * Updates a route by ID with new place data
 * @param {Object} req - The request object
 * @param {Object} res - The response object
 * @returns {Promise<void>} Nothing
 */
const updateRouteById = async (req, res) => {
  try {
    const { email, routeId, origin, destination, places } = req.body;
    
    if (!email || !routeId) {
      return res.status(400).json({ error: 'Email and route ID are required' });
    }
    
    // Find the user's saved routes
    const userRoutes = await Route.findOne({ user: email });
    
    if (!userRoutes) {
      return res.status(404).json({ error: 'No saved routes found for this user' });
    }
    
    // Find the specific route to update
    const routeIndex = userRoutes.routes.findIndex(route => route.id === routeId);
    
    if (routeIndex === -1) {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    // Update the route with the new places
    userRoutes.routes[routeIndex].places = places;
    
    // Save the updated routes
    await userRoutes.save();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Route updated successfully',
      route: userRoutes.routes[routeIndex]
    });
    
  } catch (error) {
    console.error('Error updating route:', error);
    return res.status(500).json({ error: 'Failed to update route' });
  }
};

export { fetchSavedRoutes, getOD, getRouteById, updateRouteById };