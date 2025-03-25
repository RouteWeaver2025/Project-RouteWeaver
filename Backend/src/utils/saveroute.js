import { Route } from "../models/routes.js";

// Helper function to encode route data
function encodeRouteData(origin, destination, selectedPlaces) {
  try {
    // Format: origin|destination|place1,place2,place3
    const placesString = selectedPlaces
      .map(place => `${place.lat},${place.lng},${encodeURIComponent(place.name)}`)
      .join('|');
    
    return `${origin}|${destination}|${placesString}`;
  } catch (error) {
    console.error("Error encoding route data:", error);
    throw new Error("Failed to encode route data");
  }
}

// Helper function to decode route data (will be useful for fetching)
function decodeRouteData(encodedString) {
  try {
    const parts = encodedString.split('|');
    const origin = parts[0];
    const destination = parts[1];
    const places = [];

    // Process each place entry (parts[2] onwards)
    for (let i = 2; i < parts.length; i++) {
      const placeData = parts[i].split(',');
      if (placeData.length >= 3) {
        places.push({
          lat: parseFloat(placeData[0]),
          lng: parseFloat(placeData[1]),
          name: decodeURIComponent(placeData[2])
        });
      }
    }

    return {
      origin,
      destination,
      places
    };
  } catch (error) {
    console.error("Error decoding route data:", error);
    throw new Error("Failed to decode route data");
  }
}

async function addRoute(req, res) {
  try {
    const { email, id, origin, destination, selectedPlaces } = req.body;
    
    if (!email || !origin || !destination || !selectedPlaces) {
      return res.status(400).json({ 
        message: "Missing required fields", 
        required: ["email", "origin", "destination", "selectedPlaces"] 
      });
    }

    console.log("Saving route for user:", email);
    console.log("Selected places:", selectedPlaces.length);

    // Encode the route data
    const encodedRoute = encodeRouteData(origin, destination, selectedPlaces);
    console.log("Encoded route data:", encodedRoute.substring(0, 100) + "...");

    // Find or create user's route document
    let userRoute = await Route.findOne({ user: email });
    if (!userRoute) {
      userRoute = new Route({ user: email, routes: [] });
    }

    // Generate new ID or use provided one
    let newId;
    if (id === "x") {
      // Check if there are existing routes for this user
      if (userRoute.routes.length > 0) {
        // Find the maximum ID for this user and add 1
        newId = Math.max(...userRoute.routes.map(r => r.id)) + 1;
      } else {
        // Find the maximum ID across all users to ensure global uniqueness
        try {
          const allRoutes = await Route.find({});
          const allIds = allRoutes
            .flatMap(route => route.routes.map(r => r.id))
            .filter(id => typeof id === 'number');
          
          newId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
          console.log(`Generated globally unique ID: ${newId}`);
        } catch (error) {
          console.warn("Error finding max route ID, falling back to timestamp-based ID:", error);
          // Fallback to a timestamp-based ID
          newId = Math.floor(Date.now() / 1000); // Unix timestamp
        }
      }
    } else {
      newId = parseInt(id);
    }

    // Add new route
    userRoute.routes.push({ 
      id: newId, 
      routeData: encodedRoute
    });

    // Save to database
    await userRoute.save();
    console.log("Route saved successfully with ID:", newId);

    return res.status(200).json({ 
      message: "Route saved successfully", 
      routeId: newId
    });

  } catch (error) {
    console.error("Error in addRoute:", error);
    return res.status(500).json({ 
      message: "Server error", 
      error: error.message 
    });
  }
}

export { addRoute, decodeRouteData };