// landmarks.js
import express from "express";
import axios from "axios";

const router = express.Router();
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_PLACES_API_KEY; // Changed to match .env file name

// Log the API key (first few characters) to verify it's loaded
console.log("API Key loaded:", GOOGLE_MAPS_API_KEY ? "Yes (starts with " + GOOGLE_MAPS_API_KEY.substring(0, 5) + "...)" : "No");

// Helper function to check if an API error is due to authorization
function isAuthorizationError(status, message) {
  return status === 'REQUEST_DENIED' && 
    (message?.includes('not authorized') || message?.includes('API project'));
}

// Helper: decode Google's encoded polyline into an array of [lon, lat]
function decodePolyline(encoded) {
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [];
  while (index < encoded.length) {
    let shift = 0,
      result = 0,
      b;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += deltaLat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const deltaLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += deltaLng;
    // Note: Google polyline encoding returns lat/lng * 1e5
    coordinates.push([lng / 1e5, lat / 1e5]); // [lon, lat]
  }
  return coordinates;
}

// Modified /routes endpoint to fetch multiple routes
router.get("/routes", async (req, res) => {
  try {
    const { origin, destination } = req.query;
    if (!origin || !destination) {
      return res.status(400).json({ error: "origin and destination are required" });
    }

    // Clean up coordinates and parse them
    const [originLat, originLng] = origin.replace(/['"]/g, '').trim().split(',').map(coord => parseFloat(coord.trim()));
    const [destLat, destLng] = destination.replace(/['"]/g, '').trim().split(',').map(coord => parseFloat(coord.trim()));

    console.log("Processing coordinates:", {
      origin: `${originLat},${originLng}`,
      destination: `${destLat},${destLng}`
    });

    // Use the Routes API
    const routesUrl = "https://routes.googleapis.com/directions/v2:computeRoutes";
    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: originLat,
            longitude: originLng
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destLat,
            longitude: destLng
          }
        }
      },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
      computeAlternativeRoutes: true,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false
      },
      languageCode: "en-US",
      units: "METRIC"
    };

    console.log("Making Routes API request...");
    const routesResponse = await axios({
      method: 'post',
      url: routesUrl,
      data: requestBody,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.travelAdvisory,routes.localizedValues'
      }
    });

    console.log("Routes API Response received");

    if (!routesResponse.data.routes || routesResponse.data.routes.length === 0) {
      return res.status(404).json({ error: "No routes found" });
    }

    // Debug the route data
    console.log("Route data example:", JSON.stringify(routesResponse.data.routes[0].duration));
    
    // Process routes from Routes API
    const processedRoutes = routesResponse.data.routes.map((route, index) => {
      console.log(`Route ${index} duration:`, route.duration);
      console.log(`Route ${index} localized values:`, route.localizedValues);
      
      const geometry = decodePolyline(route.polyline.encodedPolyline);
      
      // Get travel time - try multiple sources
      let timeTaken = "0 min";
      
      // 1. Try to get from localizedValues
      if (route.localizedValues && route.localizedValues.duration) {
        timeTaken = route.localizedValues.duration.text;
        console.log(`Using localized duration: ${timeTaken}`);
      } 
      // 2. Try to format the duration string
      else if (route.duration) {
        timeTaken = formatDuration(route.duration);
        console.log(`Using formatted duration: ${timeTaken}`);
      }
      // 3. Calculate time as fallback
      else if (route.distanceMeters) {
        // Assume average speed of 60 km/h if no duration
        const estimatedMinutes = Math.round((route.distanceMeters / 1000) / 60 * 60);
        timeTaken = `${estimatedMinutes} min`;
        console.log(`Using estimated duration: ${timeTaken}`);
      }
      
      return {
        timeTaken: timeTaken,
        timeValue: parseDuration(route.duration),
        distance: formatDistance(route.distanceMeters),
        distanceValue: route.distanceMeters,
        geometry: geometry,
        bounds: route.viewport || calculateBounds(geometry),
        summary: route.description || `Route ${index + 1}`
      };
    });

    return res.json({ routes: processedRoutes });

  } catch (err) {
    console.error("Error in /routes:", err.response?.data || err.message);
    
    if (err.response?.status === 403 || err.response?.status === 401) {
      return res.status(403).json({ 
        error: "API Authorization Error", 
        details: "There's an issue with the API key or permissions.",
        message: err.response?.data?.error?.message || err.message,
        steps: [
          "1. Verify the API key in your .env file is correct",
          "2. Go to https://console.cloud.google.com",
          "3. Enable the Routes API in 'APIs & Services' > 'Library'",
          "4. Check API key restrictions in 'APIs & Services' > 'Credentials'",
          "5. Ensure billing is enabled for your project"
        ]
      });
    }
    
    return res.status(500).json({ 
      error: "Failed to process route request",
      details: err.message,
      response: err.response?.data
    });
  }
});

// Helper function to calculate bounds from geometry points
function calculateBounds(geometry) {
  if (!geometry || geometry.length === 0) return null;
  
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  
  geometry.forEach(([lng, lat]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });
  
  return {
    northeast: { lat: maxLat, lng: maxLng },
    southwest: { lat: minLat, lng: minLng }
  };
}

// Helper function to format duration from Google Routes API format
function formatDuration(duration) {
  if (!duration) return "0 min";
  
  const matches = duration.match(/(\d+)([HMS])/g);
  if (!matches) return "0 min";
  
  const parts = [];
  matches.forEach(match => {
    const value = match.slice(0, -1);
    const unit = match.slice(-1);
    switch (unit) {
      case 'H': parts.push(`${value} hr`); break;
      case 'M': parts.push(`${value} min`); break;
      case 'S': if (parseInt(value) > 0) parts.push(`${value} sec`); break;
    }
  });
  return parts.length > 0 ? parts.join(' ') : "0 min";
}

// Helper function to parse duration to seconds
function parseDuration(duration) {
  const matches = duration.match(/(\d+)([HMS])/g);
  if (!matches) return 0;
  
  let seconds = 0;
  matches.forEach(match => {
    const value = parseInt(match.slice(0, -1));
    const unit = match.slice(-1);
    switch (unit) {
      case 'H': seconds += value * 3600; break;
      case 'M': seconds += value * 60; break;
      case 'S': seconds += value; break;
    }
  });
  return seconds;
}

// Helper function to format distance
function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// Helper function to sample points along the route
function samplePoints(geometry, interval) {
  const points = [];
  let accumulatedDistance = 0;
  
  for (let i = 0; i < geometry.length - 1; i++) {
    const current = geometry[i];
    points.push(current);
    
    const next = geometry[i + 1];
    const distance = calculateDistance(
      current[1], current[0], // lat, lon
      next[1], next[0]
    );
    
    accumulatedDistance += distance;
    if (accumulatedDistance >= interval) {
      accumulatedDistance = 0;
    }
  }
  
  return points;
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Helper function to fetch nearby places
async function fetchNearbyPlaces(lat, lng, radius = 5000) {
  const placesUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
  const params = {
    location: `${lat},${lng}`,
    radius: radius,
    key: GOOGLE_MAPS_API_KEY
  };

  try {
    const response = await axios.get(placesUrl, { params });
    if (response.data.status === "OK" || response.data.status === "ZERO_RESULTS") {
      return response.data.results || [];
    }
    console.error("Places API error:", response.data.status);
    return [];
  } catch (error) {
    console.error("Error fetching places:", error);
    return [];
  }
}

// Simple in-memory rate limiting
const rateLimiter = {
  requests: new Map(),
  windowMs: 1000, // 1 second window
  maxRequests: 10, // maximum requests per window
  
  isRateLimited(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    
    // Clean up old entries
    for (const [key, time] of this.requests.entries()) {
      if (time < windowStart) this.requests.delete(key);
    }
    
    // Count requests in current window
    const requestCount = Array.from(this.requests.values())
      .filter(time => time > windowStart).length;
    
    if (requestCount >= this.maxRequests) return true;
    
    // Add current request
    this.requests.set(now, now);
    return false;
  }
};

// Places endpoint to fetch nearby places
router.get('/places', async (req, res) => {
  try {
    const { lat, lng, keywords = '', offset = '0' } = req.query;
    
    // Input validation
    if (!lat || !lng) {
      return res.status(400).json({
        error: 'Missing parameters',
        details: 'Both lat and lng are required'
      });
    }
    
    // Parse and validate coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) {
      return res.status(400).json({
        error: 'Invalid coordinates',
        details: 'Latitude and longitude must be valid numbers'
      });
    }
    
    // Check rate limiting
    const clientIp = req.ip || req.connection.remoteAddress;
    if (rateLimiter.isRateLimited(clientIp)) {
      return res.status(429).json({
        error: 'Too many requests',
        details: 'Please wait before making more requests'
      });
    }
    
    // Process keywords
    const keywordArray = keywords.split(',').filter(k => k);
    
    // Define place types based on location context
    // For tourist routes, these types are most relevant
    const placeTypes = [
      'tourist_attraction',
      'natural_feature',
      'museum',
      'historic_site',
      'landmark',
      'park',
      'point_of_interest',
      'church',
      'temple',
      'mosque',
      'hindu_temple',
      'art_gallery',
      'aquarium',
      'zoo',
      'amusement_park'
    ];
    
    // Parse offset to ensure it's a number
    const offsetValue = parseInt(offset) || 0;
    
    // Rotate the place types based on the offset to get different results each time
    // This ensures that different API calls are made when the reload button is pressed
    const rotatedTypes = [...placeTypes.slice(offsetValue % placeTypes.length), ...placeTypes.slice(0, offsetValue % placeTypes.length)];
    
    // We'll make multiple requests with different types to get diverse results
    // but limit to 2 requests to keep API usage reasonable
    const typeBatches = [
      rotatedTypes.slice(0, 5).join('|'),  // Tourist attractions and natural features
      rotatedTypes.slice(5, 10).join('|')  // Cultural and historical sites
    ];
    
    const allResults = [];
    
    // Make multiple requests with different type batches
    for (let i = 0; i < typeBatches.length; i++) {
      // Add a small delay between requests
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      const baseUrl = 'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
      const params = new URLSearchParams({
        location: `${latitude},${longitude}`,
        radius: 10000, // Increase radius to 10km to get more places
        key: GOOGLE_MAPS_API_KEY,
        ...(keywordArray.length && { keyword: keywordArray.join('|') }),
        type: typeBatches[i],
        // Add randomization parameter based on the offset
        rankby: offsetValue % 2 === 0 ? 'prominence' : 'distance'
      });

      console.log(`Fetching places near [${latitude}, ${longitude}] (batch ${i+1}/${typeBatches.length})`);
      
      const response = await fetch(`${baseUrl}?${params}`);
      const data = await response.json();

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        // Add results to our collection
        allResults.push(...(data.results || []));
      } else {
        console.error(`Places API Error (batch ${i+1}):`, data);
        // Continue with other batches even if one fails
      }
    }
    
    // Deduplicate results based on place_id
    const uniqueResults = {};
    allResults.forEach(place => {
      if (!uniqueResults[place.place_id]) {
        uniqueResults[place.place_id] = place;
      }
    });
    
    // Convert to array
    const results = Object.values(uniqueResults);
    
    // Add distance to each place
    results.forEach(place => {
      place.distance = calculateDistance(
        latitude, longitude,
        place.geometry.location.lat,
        place.geometry.location.lng
      );
    });
    
    // Use the offset to vary the sorting algorithm
    const sortRandomFactor = (offsetValue % 10) / 10; // Generate a value between 0 and 0.9
    
    // Sort with a balance of prominence and distance, varied by the offset
    results.sort((a, b) => {
      // First prioritize by prominence, with randomization based on offset
      if (a.rating && b.rating) {
        const ratingDiff = b.rating - a.rating;
        // If ratings are significantly different, use rating with a random factor
        if (Math.abs(ratingDiff) >= 0.5) {
          return ratingDiff + ((Math.random() * 2 - 1) * sortRandomFactor);
        }
      }
      
      // For similar ratings or no ratings, use distance with a random factor
      return (a.distance - b.distance) * (1 + ((Math.random() * 2 - 1) * sortRandomFactor));
    });
    
    // Rotate the results based on the offset to provide different places each time
    const rotationIndex = offsetValue % Math.max(5, Math.min(10, results.length / 2));
    let processedResults = [...results];
    
    if (results.length > 10) {
      // If we have more than 10 results, use the offset to select a different subset
      processedResults = [
        ...results.slice(rotationIndex),
        ...results.slice(0, rotationIndex)
      ];
    }
    
    // Limit to a reasonable number
    const limitedResults = processedResults.slice(0, 15);
    
    console.log(`Found ${results.length} places near [${latitude}, ${longitude}], returning top ${limitedResults.length}`);
    res.json({ results: limitedResults });
  } catch (error) {
    console.error('Server error while fetching places:', error);
    res.status(500).json({
      error: 'Internal server error while fetching places',
      details: error.message
    });
  }
});

// --- Endpoint: GET /api/landmarks/routesWithPlaces ---
// Expects query parameters: origin, destination, and waypoints (a pipe-separated list of lat,lon pairs)
// Returns a single route that goes via the given waypoints.
router.get("/routesWithPlaces", async (req, res) => {
  try {
    const { origin, destination, waypoints } = req.query;
    if (!origin || !destination) {
      return res.status(400).json({ error: "origin and destination are required" });
    }
    // waypoints is optional; if provided, include it.
    const directionsUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const params = {
      origin,
      destination,
      key: GOOGLE_MAPS_API_KEY,
      // If waypoints is provided, add it (Google expects pipe-separated values)
      ...(waypoints && { waypoints }),
    };
    const response = await axios.get(directionsUrl, { params });
    const data = response.data;
    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      return res.status(500).json({ error: "No route found", details: data.status });
    }
    const r = data.routes[0];
    const leg = r.legs[0];
    const route = {
      timeTaken: leg.duration.text,
      distance: leg.distance.text,
      geometry: decodePolyline(r.overview_polyline.points),
    };
    return res.json({ route });
  } catch (err) {
    console.error("Error in /routesWithPlaces:", err);
    return res.status(500).json({ error: err.message });
  }
});

// --- Endpoint: GET /api/landmarks/routesByPlaceNames ---
// Expects query parameters: origin, destination, waypoints (pipe-separated place names), region (optional)
// Returns a single route that goes via the given place names.
router.get("/routesByPlaceNames", async (req, res) => {
  try {
    const { origin, destination, waypoints, region } = req.query;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: "Origin and destination are required" });
    }
    
    console.log(`Creating route from "${origin}" to "${destination}" via waypoints: ${waypoints || 'none'}`);
    
    // First, geocode the origin and destination
    const geocodeUrl = "https://maps.googleapis.com/maps/api/geocode/json";
    
    // Geocode the origin
    const originGeocode = await axios.get(geocodeUrl, { 
      params: { 
        address: origin,
        key: GOOGLE_MAPS_API_KEY,
        ...(region && { region }) // Add region bias if provided
      }
    });
    
    if (originGeocode.data.status !== "OK" || !originGeocode.data.results[0]) {
      return res.status(400).json({ error: "Could not geocode origin", details: originGeocode.data.status });
    }
    
    const originLocation = originGeocode.data.results[0].geometry.location;
    const originCoords = `${originLocation.lat},${originLocation.lng}`;
    
    // Geocode the destination
    const destGeocode = await axios.get(geocodeUrl, { 
      params: { 
        address: destination,
        key: GOOGLE_MAPS_API_KEY,
        ...(region && { region }) // Add region bias if provided
      }
    });
    
    if (destGeocode.data.status !== "OK" || !destGeocode.data.results[0]) {
      return res.status(400).json({ error: "Could not geocode destination", details: destGeocode.data.status });
    }
    
    const destLocation = destGeocode.data.results[0].geometry.location;
    const destCoords = `${destLocation.lat},${destLocation.lng}`;
    
    // Prepare the response object with origin and destination information
    const result = {
      origin: {
        name: origin,
        location: [originLocation.lng, originLocation.lat], // [lon, lat] format
        formattedAddress: originGeocode.data.results[0].formatted_address
      },
      destination: {
        name: destination,
        location: [destLocation.lng, destLocation.lat], // [lon, lat] format
        formattedAddress: destGeocode.data.results[0].formatted_address
      },
      waypoints: []
    };
    
    // If waypoints are provided, geocode each of them
    let waypointCoords = "";
    
    if (waypoints) {
      const waypointNames = waypoints.split('|');
      
      // Geocode each waypoint
      const waypointPromises = waypointNames.map(async (placeName, index) => {
        try {
          // Try with more specific query first - add destination to the query
          let specificQuery = `${placeName} near ${destination}`;
          console.log(`Trying geocode with specific query: "${specificQuery}"`);
          
          const waypointGeocode = await axios.get(geocodeUrl, { 
            params: { 
              address: specificQuery,
              key: GOOGLE_MAPS_API_KEY,
              ...(region && { region }) // Add region bias if provided
            }
          });
          
          if (waypointGeocode.data.status === "OK" && waypointGeocode.data.results[0]) {
            const location = waypointGeocode.data.results[0].geometry.location;
            return {
              name: placeName,
              location: [location.lng, location.lat], // [lon, lat] format
              formattedAddress: waypointGeocode.data.results[0].formatted_address
            };
          } else {
            console.warn(`Could not geocode waypoint "${placeName}": ${waypointGeocode.data.status}`);
            
            // Fallback - use destination coordinates with offset for points without specific location
            const destinationLat = destLocation.lat;
            const destinationLng = destLocation.lng;
            
            // Create a distributed pattern around destination for waypoints without coordinates
            const angle = (index * 45) % 360; // Distribute in a circle
            const distance = 0.01 + (index * 0.005); // Increasing distance from center
            
            // Calculate offset using trigonometry
            const latOffset = distance * Math.cos(angle * Math.PI / 180);
            const lngOffset = distance * Math.sin(angle * Math.PI / 180);
            
            console.log(`Using fallback coordinates for "${placeName}" near destination`);
            
            return {
              name: placeName,
              location: [destinationLng + lngOffset, destinationLat + latOffset],
              formattedAddress: `${placeName} (near ${destination})`
            };
          }
        } catch (error) {
          console.error(`Error geocoding waypoint "${placeName}":`, error);
          return null;
        }
      });
      
      // Wait for all geocoding requests to complete
      const waypointResults = await Promise.all(waypointPromises);
      
      // Filter out null results and add valid waypoints to the result
      const validWaypoints = waypointResults.filter(wp => wp !== null);
      result.waypoints = validWaypoints;
      
      // Format waypoints for the directions API
      waypointCoords = validWaypoints
        .map(wp => `${wp.location[1]},${wp.location[0]}`) // Convert to lat,lng
        .join('|');
    }
    
    // Now that we have the coordinates, get the directions
    const directionsUrl = "https://maps.googleapis.com/maps/api/directions/json";
    const directionsParams = {
      origin: originCoords,
      destination: destCoords,
      key: GOOGLE_MAPS_API_KEY,
      ...(waypointCoords && { waypoints: waypointCoords }),
    };
    
    const directionsResponse = await axios.get(directionsUrl, { params: directionsParams });
    const data = directionsResponse.data;
    
    if (data.status !== "OK" || !data.routes || data.routes.length === 0) {
      return res.status(400).json({ 
        error: "No route found", 
        details: data.status,
        origin: result.origin,
        destination: result.destination,
        waypoints: result.waypoints
      });
    }
    
    const r = data.routes[0];
    const leg = r.legs[0];
    
    // Add route information to the result
    result.route = {
      timeTaken: leg.duration.text,
      timeValue: leg.duration.value, // Time in seconds
      distance: leg.distance.text,
      distanceValue: leg.distance.value, // Distance in meters
      geometry: decodePolyline(r.overview_polyline.points),
    };
    
    return res.json(result);
    
  } catch (err) {
    console.error("Error in /routesByPlaceNames:", err.response?.data || err.message);
    return res.status(500).json({ 
      error: "Failed to create route with place names",
      details: err.message
    });
  }
});

// ----------------------- SMART VACAY FUNCTIONS -----------------------

// Cache for popular destinations to avoid repeated API calls
const popularDestinationsCache = new Map();

// Endpoint to fetch popular tourist destinations within a specific distance range
router.get("/popularDestinations", async (req, res) => {
  try {
    const { origin, minDistance = 50, maxDistance = 500, limit = 4 } = req.query;
    
    if (!origin) {
      return res.status(400).json({ error: "Origin is required" });
    }
    
    // Generate cache key
    const cacheKey = `${origin}-${minDistance}-${maxDistance}`;
    
    // Check if we have cached results
    if (popularDestinationsCache.has(cacheKey)) {
      const cachedData = popularDestinationsCache.get(cacheKey);
      // Check if cache is still fresh (less than 24 hours old)
      if (Date.now() - cachedData.timestamp < 24 * 60 * 60 * 1000) {
        return res.json({
          destinations: cachedData.destinations.slice(0, parseInt(limit))
        });
      }
    }
    
    // First, get coordinates for the origin
    const originCoords = await geocodeLocation(origin);
    if (!originCoords) {
      return res.status(400).json({ error: "Could not geocode origin location" });
    }
    
    // Fetch popular tourist destinations
    const destinations = await fetchPopularTouristDestinations(
      originCoords.lat, 
      originCoords.lng, 
      parseFloat(minDistance) * 1000, // Convert to meters
      parseFloat(maxDistance) * 1000  // Convert to meters
    );
    
    // Calculate distance from origin to each destination
    const destinationsWithDistance = destinations.map(dest => {
      const distance = calculateDistance(
        originCoords.lat, 
        originCoords.lng,
        dest.lat,
        dest.lng
      ) / 1000; // Convert to km
      
      return {
        ...dest,
        distance
      };
    });
    
    // Filter destinations by distance range
    const filteredDestinations = destinationsWithDistance.filter(dest => 
      dest.distance >= parseFloat(minDistance) && 
      dest.distance <= parseFloat(maxDistance)
    );
    
    // Randomize the order for variety
    const shuffledDestinations = shuffleArray(filteredDestinations);
    
    // Cache the results
    popularDestinationsCache.set(cacheKey, {
      destinations: shuffledDestinations,
      timestamp: Date.now()
    });
    
    res.json({
      destinations: shuffledDestinations.slice(0, parseInt(limit))
    });
  } catch (error) {
    console.error("Error fetching popular destinations:", error);
    res.status(500).json({ error: "Failed to fetch popular destinations" });
  }
});

/**
 * Fetch potential vacation destinations based on a location and distance requirements
 * 
 * Query params:
 * - location: Starting location (e.g., "Delhi, India")
 * - tripType: "short", "medium", or "long"
 */
router.get('/vacationDestinations', async (req, res) => {
  try {
    const { location, tripType } = req.query;
    
    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    // Define distance ranges based on trip type
    let minDistance = 50; // km
    let maxDistance = 150; // km
    
    switch (tripType) {
      case 'short':
        minDistance = 50;
        maxDistance = 150;
        break;
      case 'medium':
        minDistance = 150;
        maxDistance = 300;
        break;
      case 'long':
        minDistance = 300;
        maxDistance = 1000;
        break;
      default:
        // Default to medium trip
        minDistance = 150;
        maxDistance = 300;
    }
    
    console.log(`Searching for ${tripType} trip destinations ${minDistance}-${maxDistance}km from ${location}`);

    // First geocode the starting location
    const originCoords = await geocodeLocation(location);
    if (!originCoords) {
      return res.status(400).json({ error: "Could not geocode origin location" });
    }

    console.log(`Geocoded ${location} to:`, originCoords);

    // Find tourist destinations within the specified range using our existing function
    const destinations = await fetchPopularTouristDestinations(
      originCoords.lat,
      originCoords.lng,
      minDistance * 1000, // Convert to meters
      maxDistance * 1000  // Convert to meters
    );

    if (!destinations || destinations.length === 0) {
      console.log(`No destinations found for ${location} within ${minDistance}-${maxDistance}km range`);
      return res.status(404).json({ 
        error: "No destinations found",
        message: `No suitable destinations found within ${minDistance}-${maxDistance}km of ${location}`
      });
    }

    // Calculate distance from origin to each destination
    const destinationsWithDistance = destinations.map(dest => {
      const distance = calculateDistance(
        originCoords.lat, 
        originCoords.lng,
        dest.lat,
        dest.lng
      ) / 1000; // Convert to km
      
      return {
        ...dest,
        distance: Math.round(distance) // Round to nearest km
      };
    });
    
    // Filter destinations by distance range
    const filteredDestinations = destinationsWithDistance.filter(dest => 
      dest.distance >= minDistance && dest.distance <= maxDistance
    );
    
    // If we don't have enough destinations, adjust the range
    let finalDestinations = filteredDestinations;
    
    if (filteredDestinations.length < 3) {
      console.log(`Only found ${filteredDestinations.length} destinations, expanding search range`);
      
      // Expand the range by 50% 
      const expandedMinDistance = Math.max(10, minDistance * 0.5);
      const expandedMaxDistance = maxDistance * 1.5;
      
      finalDestinations = destinationsWithDistance.filter(dest => 
        dest.distance >= expandedMinDistance && dest.distance <= expandedMaxDistance
      );
    }
    
    // Sort by a combination of rating and distance
    finalDestinations.sort((a, b) => {
      // If ratings are available and differ significantly, sort by rating
      if (a.rating && b.rating && Math.abs(a.rating - b.rating) > 1) {
        return b.rating - a.rating;
      }
      // Otherwise sort by distance
      return a.distance - b.distance;
    });
    
    // Take top 3
    const topDestinations = finalDestinations.slice(0, 3);
    
    // If we still don't have enough destinations, add hardcoded fallbacks
    if (topDestinations.length < 3) {
      console.log(`Only found ${topDestinations.length} destinations after expanding range, adding fallbacks`);
      
      // Get fallback destinations based on trip type
      const fallbacks = [
        // Short trips
        { 
          name: "Munnar, Kerala", 
          distance: tripType === 'short' ? 70 : (tripType === 'medium' ? 200 : 450), 
          coords: { lat: 10.0889, lng: 77.0595 },
          rating: 4.7 
        },
        { 
          name: "Coorg, Karnataka", 
          distance: tripType === 'short' ? 120 : (tripType === 'medium' ? 250 : 500), 
          coords: { lat: 12.4244, lng: 75.7382 },
          rating: 4.5 
        },
        { 
          name: "Pondicherry", 
          distance: tripType === 'short' ? 150 : (tripType === 'medium' ? 280 : 550), 
          coords: { lat: 11.9416, lng: 79.8083 },
          rating: 4.4 
        },
        { 
          name: "Goa", 
          distance: tripType === 'short' ? 140 : (tripType === 'medium' ? 250 : 550), 
          coords: { lat: 15.2993, lng: 74.1240 },
          rating: 4.6 
        },
        { 
          name: "Ooty, Tamil Nadu", 
          distance: tripType === 'short' ? 130 : (tripType === 'medium' ? 250 : 500), 
          coords: { lat: 11.4102, lng: 76.6950 },
          rating: 4.5 
        },
        { 
          name: "Varanasi, Uttar Pradesh", 
          distance: tripType === 'medium' ? 300 : 600, 
          coords: { lat: 25.3176, lng: 82.9739 },
          rating: 4.3 
        }
      ];
      
      // Add fallbacks until we have 3 destinations, but don't add duplicates
      for (const fallback of fallbacks) {
        if (topDestinations.length >= 3) break;
        
        // Check if this fallback is already in the list
        const isDuplicate = topDestinations.some(dest => 
          dest.name === fallback.name || 
          (Math.abs(dest.lat - fallback.coords.lat) < 0.01 && 
           Math.abs(dest.lng - fallback.coords.lng) < 0.01)
        );
        
        if (!isDuplicate) {
          topDestinations.push(fallback);
        }
      }
    }

    res.json({
      origin: {
        name: location,
        coords: originCoords
      },
      destinations: topDestinations
    });
  } catch (error) {
    console.error('Error in /vacationDestinations:', error);
    res.status(500).json({ 
      error: 'Error fetching vacation destinations',
      details: error.message 
    });
  }
});

// Function to geocode a location string to coordinates
async function geocodeLocation(locationString) {
  try {
    const encodedLocation = encodeURIComponent(locationString);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedLocation}&key=${GOOGLE_MAPS_API_KEY}`;
    
    const response = await axios.get(url);
    
    if (response.data.status === "OK" && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng,
        formattedAddress: response.data.results[0].formatted_address
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error geocoding location:", error);
    return null;
  }
}

// Function to fetch popular tourist destinations based on distance
async function fetchPopularTouristDestinations(lat, lng, minDistance, maxDistance) {
  try {
    // Define tourist destination types
    const touristTypes = [
      "tourist_attraction",
      "point_of_interest",
      "natural_feature",
      "park",
      "museum",
      "landmark",
      "historical_landmark",
      "neighborhood"
    ];
    
    // Create concentric search rings to find places at different distances
    const searchRadii = [];
    const numberOfRings = 5;
    
    for (let i = 0; i < numberOfRings; i++) {
      const radius = minDistance + (i * ((maxDistance - minDistance) / (numberOfRings - 1)));
      searchRadii.push(radius);
    }
    
    // Fetch places at each radius
    const allDestinations = [];
    
    for (const radius of searchRadii) {
      for (const type of touristTypes) {
        try {
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
          const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&keyword=tourist&rankby=prominence&key=${GOOGLE_MAPS_API_KEY}`;
          
          const response = await axios.get(url);
          
          if (response.data.status === "OK" && response.data.results.length > 0) {
            // Process and filter places
            const places = response.data.results
              // Filter for high-rated places when possible
              .filter(place => !place.rating || place.rating >= 4.0)
              // Map to simpler format
              .map(place => ({
                place_id: place.place_id,
                name: place.name,
                lat: place.geometry.location.lat,
                lng: place.geometry.location.lng,
                rating: place.rating || 0,
                types: place.types || [],
                photo: place.photos && place.photos.length > 0 ? place.photos[0].photo_reference : null
              }));
            
            allDestinations.push(...places);
          }
        } catch (error) {
          console.error(`Error fetching places for type ${type} at radius ${radius}:`, error);
          // Continue with other types and radii
        }
      }
    }
    
    // Deduplicate by place_id
    const uniqueDestinations = [];
    const seenIds = new Set();
    
    for (const dest of allDestinations) {
      if (!seenIds.has(dest.place_id)) {
        seenIds.add(dest.place_id);
        uniqueDestinations.push(dest);
      }
    }
  
    return uniqueDestinations;
  } catch (error) {
    console.error("Error fetching popular tourist destinations:", error);
    return [];
  }
}

// Fisher-Yates shuffle algorithm for randomizing destinations
function shuffleArray(array) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export default router;
