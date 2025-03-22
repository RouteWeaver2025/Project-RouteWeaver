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
    const { lat, lng, keywords = '' } = req.query;
    
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
    
    // We'll make multiple requests with different types to get diverse results
    // but limit to 2 requests to keep API usage reasonable
    const typeBatches = [
      placeTypes.slice(0, 5).join('|'),  // Tourist attractions and natural features
      placeTypes.slice(5, 10).join('|')  // Cultural and historical sites
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
        type: typeBatches[i]
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
    
    // Sort with a balance of prominence and distance
    results.sort((a, b) => {
      // First prioritize by prominence
      if (a.rating && b.rating) {
        const ratingDiff = b.rating - a.rating;
        // If ratings are significantly different, use rating
        if (Math.abs(ratingDiff) >= 0.5) return ratingDiff;
      }
      
      // For similar ratings or no ratings, use distance
      return a.distance - b.distance;
    });
    
    // Limit to a reasonable number
    const limitedResults = results.slice(0, 15);
    
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

export default router;
