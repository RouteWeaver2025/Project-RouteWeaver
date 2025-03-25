import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

/**
 * Get places within a specific radius of a location using Google Places API
 * @param {Object} coords - Latitude and longitude coordinates 
 * @param {number} radius - Radius in meters (max 50000 for Places API)
 * @param {number} limit - Maximum number of results to return
 * @returns {Array} Array of places with name, photo reference, and distance
 */
async function getNearbyPlaces(coords, radius = 50000, limit = 8) {
  try {
    if (!coords || !coords.lat || !coords.lng) {
      console.error('Invalid coordinates provided');
      return { error: 'Invalid coordinates' };
    }

    if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'YOUR_API_KEY') {
      console.error('Google Places API key is missing or invalid');
      return { error: 'API key is missing or invalid' };
    }
    
    console.log('Fetching nearby places from Google Places API');
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/nearbysearch/json', {
      params: {
        location: `${coords.lat},${coords.lng}`,
        radius: radius,
        type: 'tourist_attraction',
        rankby: 'prominence',
        key: GOOGLE_PLACES_API_KEY
      }
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      const places = response.data.results
        .slice(0, limit)
        .map(place => {
          const distanceInMeters = calculateDistance(
            coords.lat, coords.lng, 
            place.geometry.location.lat, place.geometry.location.lng
          );
          
          return {
            name: place.name,
            photoRef: place.photos && place.photos.length > 0 ? place.photos[0].photo_reference : null,
            distance: Math.round(distanceInMeters / 1000), // Convert to km
            lat: place.geometry.location.lat,
            lng: place.geometry.location.lng,
            vicinity: place.vicinity || '',
            rating: place.rating || null
          };
        });
      
      return { places };
    } else {
      console.error('No places found or empty response from Google Places API');
      return { error: 'No places found', places: [] };
    }
  } catch (error) {
    console.error('Error fetching nearby places:', error);
    return { error: error.message || 'Error fetching nearby places', places: [] };
  }
}

/**
 * Get distant tourist attractions (80km - 1000km)
 * @param {Object} coords - Latitude and longitude coordinates 
 * @param {number} limit - Maximum number of results to return
 * @returns {Object} Object containing places
 */
async function getDistantPlaces(coords, limit = 8) {
  try {
    if (!coords || !coords.lat || !coords.lng) {
      console.error('Invalid coordinates provided');
      return { error: 'Invalid coordinates' };
    }

    if (!GOOGLE_PLACES_API_KEY || GOOGLE_PLACES_API_KEY === 'YOUR_API_KEY') {
      console.error('Google Places API key is missing or invalid');
      return { error: 'API key is missing or invalid' };
    }

    // For distant places, use a wider radius and filter by distance
    console.log('Fetching distant places from Google Places API');
    
    // We'll use the Places Text Search API to find popular tourist destinations 
    // in cities that are likely to be within 80-1000km
    const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', {
      params: {
        query: 'famous tourist attractions',
        location: `${coords.lat},${coords.lng}`,
        radius: 100000, // Max allowed is 50km, but we'll filter results manually
        key: GOOGLE_PLACES_API_KEY
      }
    });

    if (response.data && response.data.results && response.data.results.length > 0) {
      const allPlaces = response.data.results.map(place => {
        const distanceInMeters = calculateDistance(
          coords.lat, coords.lng, 
          place.geometry.location.lat, place.geometry.location.lng
        );
        
        return {
          name: place.name,
          photoRef: place.photos && place.photos.length > 0 ? place.photos[0].photo_reference : null,
          distance: Math.round(distanceInMeters / 1000), // Convert to km
          lat: place.geometry.location.lat,
          lng: place.geometry.location.lng,
          vicinity: place.formatted_address || '',
          rating: place.rating || null
        };
      });
      
      // Filter to get only places between 80km and 1000km away
      const distantPlaces = allPlaces
        .filter(place => place.distance > 80 && place.distance <= 1000)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, limit);
      
      if (distantPlaces.length === 0) {
        console.error('No places found between 80km and 1000km');
        return { error: 'No distant places found', places: [] };
      }
      
      return { places: distantPlaces };
    } else {
      console.error('No places found or empty response from Google Places API');
      return { error: 'No places found', places: [] };
    }
  } catch (error) {
    console.error('Error fetching distant places:', error);
    return { error: error.message || 'Error fetching distant places', places: [] };
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
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

  return R * c; // Distance in meters
}

export { getNearbyPlaces, getDistantPlaces };
