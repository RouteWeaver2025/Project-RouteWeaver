//for travelpackage.jsx
import { getOptions, getSuggest } from './gemini.js';
import fetch from 'node-fetch';

/**
 * Fetches nearby and distant places for travelpackage.jsx
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getNearbyPlaces = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: "Missing coordinates. Both lat and lng are required." 
      });
    }

    // Reverse geocode coordinates to get location name
    const locationName = await reverseGeocode(lat, lng);
    
    // Get places from Gemini API
    const { nearbyPlaces } = await getOptions(locationName);
    
    // Format the response
    const formattedPlaces = await Promise.all(nearbyPlaces.map(async place => {
      // Fetch photo reference from Google Places API
      let photoRef = null;
      try {
        photoRef = await getPlacePhoto(place.name, place.coordinates.latitude, place.coordinates.longitude);
      } catch (err) {
        console.warn(`Could not get photo for ${place.name}:`, err.message);
      }
      
      return {
        name: place.name,
        lat: place.coordinates.latitude,
        lng: place.coordinates.longitude,
        description: place.description,
        // Extract distance from the description (if available)
        distance: extractDistance(place.description) || calculateApproxDistance(lat, lng, place.coordinates.latitude, place.coordinates.longitude),
        photoRef: photoRef,
        imageUrl: null // We'll use photoRef with Google Places API directly in frontend
      };
    }));
    
    console.log(`Returning ${formattedPlaces.length} nearby places for ${locationName}`);
    
    return res.json({ 
      success: true,
      places: formattedPlaces 
    });
  } catch (error) {
    console.error("Error in getNearbyPlaces:", error);
    return res.status(500).json({ 
      error: "Failed to fetch nearby places" 
    });
  }
};

/**
 * Fetches distant places for travelpackage.jsx
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getDistantPlaces = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ 
        error: "Missing coordinates. Both lat and lng are required." 
      });
    }

    // Reverse geocode coordinates to get location name
    const locationName = await reverseGeocode(lat, lng);
    
    // Get places from Gemini API
    const { distantPlaces } = await getOptions(locationName);
    
    // Format the response
    const formattedPlaces = await Promise.all(distantPlaces.map(async place => {
      // Fetch photo reference from Google Places API
      let photoRef = null;
      try {
        photoRef = await getPlacePhoto(place.name, place.coordinates.latitude, place.coordinates.longitude);
      } catch (err) {
        console.warn(`Could not get photo for ${place.name}:`, err.message);
      }
      
      return {
        name: place.name,
        lat: place.coordinates.latitude,
        lng: place.coordinates.longitude,
        description: place.description,
        // Extract distance from the description (if available)
        distance: extractDistance(place.description) || calculateApproxDistance(lat, lng, place.coordinates.latitude, place.coordinates.longitude),
        photoRef: photoRef,
        imageUrl: null // We'll use photoRef with Google Places API directly in frontend
      };
    }));
    
    console.log(`Returning ${formattedPlaces.length} distant places for ${locationName}`);
    
    return res.json({ 
      success: true,
      places: formattedPlaces 
    });
  } catch (error) {
    console.error("Error in getDistantPlaces:", error);
    return res.status(500).json({ 
      error: "Failed to fetch distant places" 
    });
  }
};

/**
 * Fetches places along a route between origin and destination for prebuilt.jsx
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getRoutePlaces = async (req, res) => {
  try {
    const { origin, destination } = req.query;
    
    if (!origin || !destination) {
      return res.status(400).json({ 
        error: "Missing parameters. Both origin and destination are required." 
      });
    }

    console.log(`Fetching places along route from ${origin} to ${destination}`);
    
    // Get places using getSuggest from gemini.js
    const keyword = req.query.keyword || 'tourist attractions';
    const places = await getSuggest(origin, destination, keyword);
    
    if (!places || (!places.set1 && !places.set2)) {
      throw new Error("Failed to get places from Gemini API");
    }
    
    // Combine both sets of places
    const allPlaces = [...places.set1, ...places.set2];
    
    // Format all places
    const formattedPlaces = await Promise.all(allPlaces.map(async place => {
      // Fetch photo reference from Google Places API
      let photoRef = null;
      try {
        photoRef = await getPlacePhoto(place.name, place.coordinates.latitude, place.coordinates.longitude);
      } catch (err) {
        console.warn(`Could not get photo for ${place.name}:`, err.message);
      }
      
      return {
        name: place.name,
        lat: place.coordinates.latitude,
        lng: place.coordinates.longitude,
        description: place.description,
        photoRef: photoRef,
        imageUrl: null
      };
    }));
    
    // Try to get the coordinates for origin and destination
    let originCoords = null;
    let destCoords = null;
    
    // Try to use coordinates from query parameters if provided
    if (req.query.originLat && req.query.originLng) {
      originCoords = {
        lat: parseFloat(req.query.originLat),
        lon: parseFloat(req.query.originLng)
      };
    } else {
      // Fallback to geocoding
      try {
        originCoords = await getCoordinates(origin);
      } catch (err) {
        console.warn(`Could not geocode origin "${origin}". Using first place coordinates as fallback.`);
        // Fallback to using the first place's coordinates if available
        if (formattedPlaces.length > 0) {
          originCoords = {
            lat: formattedPlaces[0].lat,
            lon: formattedPlaces[0].lng
          };
        }
      }
    }
    
    if (req.query.destLat && req.query.destLng) {
      destCoords = {
        lat: parseFloat(req.query.destLat),
        lon: parseFloat(req.query.destLng)
      };
    } else {
      // Fallback to geocoding
      try {
        destCoords = await getCoordinates(destination);
      } catch (err) {
        console.warn(`Could not geocode destination "${destination}". Using last place coordinates as fallback.`);
        // Fallback to using the last place's coordinates if available
        if (formattedPlaces.length > 0) {
          destCoords = {
            lat: formattedPlaces[formattedPlaces.length - 1].lat,
            lon: formattedPlaces[formattedPlaces.length - 1].lng
          };
        }
      }
    }
    
    // If still no coordinates, use default fallback coordinates for Kerala
    if (!originCoords) {
      console.warn("Using fallback coordinates for origin");
      originCoords = { lat: 9.6374, lon: 76.7327 }; // Default Kanjirappally coordinates
    }
    
    if (!destCoords) {
      console.warn("Using fallback coordinates for destination");
      destCoords = { lat: 9.5104, lon: 77.1479 }; // Default Periyar coordinates
    }
    
    // Fetch the route with our coordinates
    const routeData = await getRoute(originCoords, destCoords);
    
    console.log(`Returning ${formattedPlaces.length} places along route from ${origin} to ${destination}`);
    
    return res.json({ 
      success: true,
      places: formattedPlaces,
      route: routeData
    });
  } catch (error) {
    console.error("Error in getRoutePlaces:", error);
    return res.status(500).json({ 
      error: "Failed to fetch places along route" 
    });
  }
};

/**
 * Gets a photo reference from Google Places API for a given place
 * @param {string} placeName - Name of the place
 * @param {number} lat - Latitude of the place
 * @param {number} lng - Longitude of the place
 * @returns {string|null} - Photo reference or null if not found
 */
async function getPlacePhoto(placeName, lat, lng) {
  try {
    // Get Google Places API key from environment variables
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.error("Google Places API key not found in environment variables. Make sure GOOGLE_PLACES_API_KEY is set in your .env file");
      throw new Error("Google Places API key not found in environment variables");
    }
    
    // First try a text search for the place name
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(placeName)}&key=${apiKey}`;
    
    const searchResponse = await fetch(searchUrl);
    const searchData = await searchResponse.json();
    
    // Check if we got any results with photos
    if (searchData.results && searchData.results.length > 0 && searchData.results[0].photos) {
      return searchData.results[0].photos[0].photo_reference;
    }
    
    // If text search didn't work, try nearby search with coordinates
    const nearbyUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=500&key=${apiKey}`;
    
    const nearbyResponse = await fetch(nearbyUrl);
    const nearbyData = await nearbyResponse.json();
    
    // Check if we got any results with photos
    if (nearbyData.results && nearbyData.results.length > 0 && nearbyData.results[0].photos) {
      return nearbyData.results[0].photos[0].photo_reference;
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching place photo:", error);
    return null;
  }
}

/**
 * Helper function to extract distance in km from description
 * @param {string} description - Place description that may contain distance
 * @returns {number|null} - Distance in km or null if not found
 */
function extractDistance(description) {
  if (!description) return null;
  
  const matches = description.match(/(\d+(\.\d+)?)\s*km/i);
  if (matches && matches[1]) {
    return parseFloat(matches[1]);
  }
  return null;
}

/**
 * Helper function to calculate approximate distance between coordinates
 * @param {number} lat1 - Starting point latitude
 * @param {number} lon1 - Starting point longitude
 * @param {number} lat2 - Ending point latitude
 * @param {number} lon2 - Ending point longitude
 * @returns {number} - Distance in km (approximate)
 */
function calculateApproxDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in km
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Reverse geocode coordinates to get location name
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string} - Location name
 */
async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data && data.display_name) {
      return data.display_name;
    } else {
      return `${lat},${lng}`;
    }
  } catch (error) {
    console.error("Error in reverse geocoding:", error);
    return `${lat},${lng}`;
  }
}

/**
 * Gets coordinates for a location using Nominatim
 * @param {string} location - Location name
 * @returns {Object|null} - Coordinates object with lat and lon properties
 */
async function getCoordinates(location) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      throw new Error("No coordinates found");
    }
    
    return {
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon)
    };
  } catch (error) {
    console.error("Error in getCoordinates:", error);
    return null;
  }
}

/**
 * Gets a route between origin and destination using OSRM
 * @param {Object} origin - Origin coordinates with lat and lon properties
 * @param {Object} destination - Destination coordinates with lat and lon properties
 * @returns {Object|null} - Route data
 */
async function getRoute(origin, destination) {
  try {
    // Build the request for the OSRM API
    const apiUrl = 'http://router.project-osrm.org/route/v1/driving/';
    const waypoints = `${origin.lon},${origin.lat};${destination.lon},${destination.lat}`;
    const options = '?overview=full&geometries=geojson';
    
    const response = await fetch(`${apiUrl}${waypoints}${options}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || !data.routes || data.routes.length === 0) {
      throw new Error("No route found");
    }
    
    const route = data.routes[0];
    
    return {
      distance: route.distance,
      timeTaken: route.duration,
      geometry: route.geometry.coordinates
    };
  } catch (error) {
    console.error("Error in getRoute:", error);
    return null;
  }
}
