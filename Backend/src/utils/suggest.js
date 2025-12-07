import axios from 'axios';
import dotenv from 'dotenv';
import { getSuggest, getGeminiGeocode } from './gemini.js';

dotenv.config();

// Google Maps API key - corrected variable name to match .env file
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
// OSRM API base URL - Open Source Routing Machine
const OSRM_API_BASE_URL = process.env.OSRM_API_BASE_URL || 'http://router.project-osrm.org';

/**
 * Get place suggestions between origin and destination
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getPlaceSuggestions(req, res) {
  try {
    const { origin, destination, keyword } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }
    
    // Get suggestions from Gemini
    const geminiSuggestions = await getSuggest(origin, destination, keyword || 'tourist attractions');
    
    // Process both sets of places
    const processedSet1 = await processPlaces(geminiSuggestions.set1);
    const processedSet2 = await processPlaces(geminiSuggestions.set2);
    
    return res.status(200).json({
      success: true,
      places: {
        set1: processedSet1,
        set2: processedSet2
      }
    });
  } catch (error) {
    console.error('Error getting place suggestions:', error);
    return res.status(500).json({ error: 'Failed to get place suggestions', details: error.message });
  }
}

/**
 * Process a list of places to add routes and images
 * 
 * @param {Array} places - List of places with name, description, and coordinates
 * @returns {Array} - Enhanced places with routes and images
 */
async function processPlaces(places) {
  try {
    // Process each place in parallel
    const enhancedPlaces = await Promise.all(places.map(async (place) => {
      try {
        // Get place image
        const imageUrl = await getPlaceImage(place.name);
        
        return {
          ...place,
          imageUrl
        };
      } catch (placeError) {
        console.error(`Error processing place ${place.name}:`, placeError);
        return {
          ...place,
          imageUrl: null,
          error: 'Failed to process place'
        };
      }
    }));
    
    return enhancedPlaces;
  } catch (error) {
    console.error('Error processing places:', error);
    return places;
  }
}

/**
 * Get a route between origin, destination, and waypoints using OSRM
 * 
 * @param {Object} origin - Origin coordinates {latitude, longitude}
 * @param {Object} destination - Destination coordinates {latitude, longitude}
 * @param {Array} waypoints - List of waypoint coordinates [{latitude, longitude}]
 * @returns {Object} - OSRM route response
 */
export async function getOSRMRoute(origin, destination, waypoints = []) {
  try {
    // Format coordinates for OSRM API
    const coordinates = [
      `${origin.longitude},${origin.latitude}`,
      ...waypoints.map(wp => `${wp.longitude},${wp.latitude}`),
      `${destination.longitude},${destination.latitude}`
    ].join(';');
    
    // Make request to OSRM API
    const response = await axios.get(`${OSRM_API_BASE_URL}/route/v1/driving/${coordinates}`, {
      params: {
        overview: 'full',
        geometries: 'geojson',
        steps: true
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Error getting OSRM route:', error);
    throw new Error('Failed to get route');
  }
}

/**
 * Get an image for a place using Google Maps Places API with multiple fallback strategies
 * 
 * @param {string} placeName - The name of the place
 * @returns {string} - URL of the place image
 */
async function getPlaceImage(placeName) {
  try {
    // Clean up the place name to improve search results
    const cleanPlaceName = placeName
      .replace(/\*\*/g, '') // Remove asterisks that Gemini sometimes adds
      .replace(/\([^)]*\)/g, '') // Remove anything in parentheses
      .trim();
    
    console.log(`Searching for image of: "${cleanPlaceName}"`);
    
    // Add Kerala/India context for better search results
    const locationContext = cleanPlaceName.toLowerCase().includes('kerala') ? '' : 'Kerala India';
    
    // STRATEGY 1: Try Google Places API with exact name, location context and "tourist attraction"
    try {
      const searchResponse = await axios.get('https://maps.googleapis.com/maps/api/place/findplacefromtext/json', {
        params: {
          input: `${cleanPlaceName} ${locationContext} tourist attraction`,
          inputtype: 'textquery',
          fields: 'photos,place_id,name,formatted_address',
          key: GOOGLE_MAPS_API_KEY
        }
      });
      
      if (searchResponse.data.candidates && 
          searchResponse.data.candidates.length > 0 && 
          searchResponse.data.candidates[0].photos && 
          searchResponse.data.candidates[0].photos.length > 0) {
        
        const photoRef = searchResponse.data.candidates[0].photos[0].photo_reference;
        console.log(`Found photo reference for ${cleanPlaceName} (Strategy 1):`, photoRef);
        
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
      }
    } catch (error) {
      console.error(`Error in strategy 1 for ${cleanPlaceName}:`, error.message);
    }
    
    // STRATEGY 2: Try Google Places Text Search API with location context
    try {
      const textSearchResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
        params: {
          query: `${cleanPlaceName} ${locationContext}`,
          key: GOOGLE_MAPS_API_KEY
        }
      });
      
      if (textSearchResponse.data.results && 
          textSearchResponse.data.results.length > 0 && 
          textSearchResponse.data.results[0].photos && 
          textSearchResponse.data.results[0].photos.length > 0) {
        
        const photoRef = textSearchResponse.data.results[0].photos[0].photo_reference;
        console.log(`Found photo reference from text search for ${cleanPlaceName} (Strategy 2):`, photoRef);
        
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
      }
    } catch (error) {
      console.error(`Error in strategy 2 for ${cleanPlaceName}:`, error.message);
    }
    
    // STRATEGY 3: Try breaking down the place name
    // For Indian places, sometimes names like "Athirappilly Waterfalls" need to be split
    // to "Athirappilly" + "Waterfall" as separate keywords
    try {
      // Extract meaningful parts of the name
      let nameParts = cleanPlaceName.split(' ');
      let placeType = '';
      
      // Common Indian attraction types to look for
      const attractionTypes = ['beach', 'temple', 'waterfall', 'falls', 'dam', 'sanctuary', 'garden', 'fort', 'palace', 'church', 'mosque', 'lake', 'hill', 'museum'];
      
      // Identify if the place includes a type
      for (const type of attractionTypes) {
        if (cleanPlaceName.toLowerCase().includes(type)) {
          placeType = type;
          break;
        }
      }
      
      // Try with the main location name + type separately
      const mainName = nameParts[0]; // Usually the most specific part (e.g., "Athirappilly")
      
      if (mainName && mainName.length > 3) {
        const alternativeResponse = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
          params: {
            query: `${mainName} ${placeType} ${locationContext}`,
            key: GOOGLE_MAPS_API_KEY
          }
        });
        
        if (alternativeResponse.data.results && 
            alternativeResponse.data.results.length > 0 && 
            alternativeResponse.data.results[0].photos && 
            alternativeResponse.data.results[0].photos.length > 0) {
          
          const photoRef = alternativeResponse.data.results[0].photos[0].photo_reference;
          console.log(`Found photo reference using main name "${mainName}" and type "${placeType}" (Strategy 3):`, photoRef);
          
          return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${photoRef}&key=${GOOGLE_MAPS_API_KEY}`;
        }
      }
    } catch (error) {
      console.error(`Error in strategy 3 for ${cleanPlaceName}:`, error.message);
    }
    
    // STRATEGY 4: Try using a direct search with "site:wikipedia.org" or "site:flickr.com" for reliable images
    try {
      const searchResponse = await axios.get('https://www.googleapis.com/customsearch/v1', {
        params: {
          q: `${cleanPlaceName} ${locationContext} site:wikipedia.org OR site:flickr.com`,
          searchType: 'image',
          num: 1,
          key: process.env.GOOGLE_SEARCH_API_KEY,
          cx: process.env.GOOGLE_SEARCH_ENGINE_ID
        }
      });
      
      if (searchResponse.data && 
          searchResponse.data.items && 
          searchResponse.data.items.length > 0 && 
          searchResponse.data.items[0].link) {
        
        console.log(`Found image from web search for ${cleanPlaceName} (Strategy 4)`);
        return searchResponse.data.items[0].link;
      }
    } catch (error) {
      // Custom search might not be configured, so just log and continue
      console.error(`Error in strategy 4 for ${cleanPlaceName} (may be expected if search API not configured):`, error.message);
    }
    
    // FALLBACK STRATEGY: Use better Unsplash search terms specific to Indian landmarks
    // Create a more specific query for Unsplash 
    const words = cleanPlaceName.split(' ');
    const placeType = getPlaceType(cleanPlaceName);
    
    const searchTerms = `${words[0]},${placeType},Kerala,India,tourism`;
      
    console.warn(`No Google image found for place: ${cleanPlaceName}, using Unsplash with terms: ${searchTerms}`);
    return `https://source.unsplash.com/800x600/?${encodeURIComponent(searchTerms)}`;
  } catch (error) {
    console.error(`Error getting image for place ${placeName}:`, error);
    return `https://source.unsplash.com/800x600/?Kerala,India,tourism`;
  }
}

/**
 * Helper function to determine the type of place
 * 
 * @param {string} placeName - Name of the place
 * @returns {string} - Type of place (waterfall, beach, etc.)
 */
function getPlaceType(placeName) {
  const nameLower = placeName.toLowerCase();
  
  if (nameLower.includes('waterfall') || nameLower.includes('falls')) return 'waterfall';
  if (nameLower.includes('beach')) return 'beach';
  if (nameLower.includes('temple')) return 'temple';
  if (nameLower.includes('church')) return 'church';
  if (nameLower.includes('mosque') || nameLower.includes('masjid')) return 'mosque';
  if (nameLower.includes('dam')) return 'dam';
  if (nameLower.includes('sanctuary') || nameLower.includes('wildlife')) return 'wildlife';
  if (nameLower.includes('garden')) return 'garden';
  if (nameLower.includes('fort')) return 'fort';
  if (nameLower.includes('palace')) return 'palace';
  if (nameLower.includes('museum')) return 'museum';
  if (nameLower.includes('lake')) return 'lake';
  if (nameLower.includes('tea') || nameLower.includes('garden') || nameLower.includes('plantation')) return 'tea-plantation';
  if (nameLower.includes('hill') || nameLower.includes('peak') || nameLower.includes('mountain')) return 'mountain';
  
  // Default to tourist attraction
  return 'tourist-attraction';
}

/**
 * Get a route that includes specific waypoints between origin and destination
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getRouteWithWaypoints(req, res) {
  try {
    const { origin, destination, waypoints } = req.body;
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and destination are required' });
    }
    
    const route = await getOSRMRoute(origin, destination, waypoints || []);
    
    return res.status(200).json({
      success: true,
      route
    });
  } catch (error) {
    console.error('Error getting route with waypoints:', error);
    return res.status(500).json({ error: 'Failed to get route', details: error.message });
  }
}

/**
 * Geocode a place using multiple strategies including Gemini AI
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export async function getGeocodeCoordinates(req, res) {
  try {
    const { place } = req.query;
    
    if (!place) {
      return res.status(400).json({ 
        success: false, 
        error: 'Place parameter is required' 
      });
    }
    
    console.log(`Attempting to geocode place: "${place}"`);
    
    // STRATEGY 1: Try Google Maps Geocoding API first
    try {
      const geocodeResponse = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params: {
          address: place,
          key: GOOGLE_MAPS_API_KEY
        }
      });
      
      if (geocodeResponse.data.results && geocodeResponse.data.results.length > 0) {
        const location = geocodeResponse.data.results[0].geometry.location;
        console.log(`Successfully geocoded "${place}" using Google Maps API:`, location);
        
        return res.json({
          success: true,
          coordinates: {
            latitude: location.lat,
            longitude: location.lng
          },
          source: 'google',
          confidence: 'high'
        });
      }
    } catch (googleError) {
      console.error(`Error using Google Maps API to geocode "${place}":`, googleError.message);
    }
    
    // STRATEGY 2: Try Nominatim (OpenStreetMap) API
    try {
      const nominatimResponse = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: place,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'RouteWeaver App'
        }
      });
      
      if (nominatimResponse.data && nominatimResponse.data.length > 0) {
        const location = nominatimResponse.data[0];
        console.log(`Successfully geocoded "${place}" using Nominatim API:`, {
          lat: location.lat,
          lon: location.lon
        });
        
        return res.json({
          success: true,
          coordinates: {
            latitude: parseFloat(location.lat),
            longitude: parseFloat(location.lon)
          },
          source: 'nominatim',
          confidence: 'medium'
        });
      }
    } catch (nominatimError) {
      console.error(`Error using Nominatim API to geocode "${place}":`, nominatimError.message);
    }
    
    // STRATEGY 3: Try Gemini AI
    try {
      console.log(`Both traditional geocoding services failed, trying Gemini AI for "${place}"`);
      const geminiResult = await getGeminiGeocode(place);
      
      if (geminiResult && geminiResult.coordinates) {
        console.log(`Successfully geocoded "${place}" using Gemini AI:`, geminiResult.coordinates);
        
        return res.json({
          success: true,
          coordinates: {
            latitude: geminiResult.coordinates.latitude,
            longitude: geminiResult.coordinates.longitude
          },
          source: 'gemini',
          confidence: geminiResult.confidence || 'medium'
        });
      }
    } catch (geminiError) {
      console.error(`Error using Gemini AI to geocode "${place}":`, geminiError.message);
    }
    
    // If all strategies fail, return an error
    return res.status(404).json({
      success: false,
      error: `Could not find coordinates for "${place}" after trying multiple services`
    });
    
  } catch (error) {
    console.error(`Error in getGeocodeCoordinates for "${req.query.place}":`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to geocode place'
    });
  }
}