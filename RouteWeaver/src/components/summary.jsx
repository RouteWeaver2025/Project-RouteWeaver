import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../design/summary.css";
import { FiRefreshCw, FiX } from 'react-icons/fi';
import { FaUserCircle, FaArrowLeft, FaMapMarkerAlt, FaRoute, FaSave, FaGoogle, FaApple } from 'react-icons/fa';
import axios from 'axios';

// Icons for markers
const originIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const destinationIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const placeIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Define the missing selectedPlaceIcon
const selectedPlaceIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Define fallbackPlaceIcon (previously was fallbackIcon but referenced as fallbackPlaceIcon)
const fallbackPlaceIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
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

// Route polylines component for the map
function RoutePolylines({ routeGeometry }) {
  const map = useMap();
  
  useEffect(() => {
    if (!routeGeometry || routeGeometry.length === 0) return;
    
    try {
      // Get all coordinates from the route
      const allCoords = routeGeometry;
      if (allCoords.length === 0) {
        console.warn("No coordinates found in route");
        return;
      }
      
      console.log(`Fitting map to ${allCoords.length} coordinates`);
      
      // Convert coordinates to Leaflet format and create bounds
      const latLngs = allCoords.map(coord => {
        // Handle different coordinate formats
        if (Array.isArray(coord)) {
          // OSRM format [lon, lat] or our fallback [lat, lng]
          if (Math.abs(coord[0]) > 90) {
            // This is likely [lon, lat] format
            return [coord[1], coord[0]];
          }
          return [coord[0], coord[1]];
        } else if (coord.lat !== undefined && (coord.lng !== undefined || coord.lon !== undefined)) {
          // Object format with lat/lng or lat/lon
          return [coord.lat, coord.lng || coord.lon];
        }
        return coord; // Already in correct format
      });
      
      // Log the first few coordinates to check format
      console.log("First few coordinates for polyline:", latLngs.slice(0, 3));
      
      const bounds = L.latLngBounds(latLngs);
      
      // Fit the map to the bounds with padding
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (error) {
      console.error("Error fitting map to bounds:", error);
    }
  }, [routeGeometry, map]);
  
  if (!routeGeometry || routeGeometry.length < 2) {
    console.warn("Invalid route geometry for polyline:", routeGeometry);
    return null;
  }
  
  // Convert to format expected by Leaflet
  const positions = routeGeometry.map(coord => {
    if (Array.isArray(coord)) {
      // Check if this is [lon, lat] format from OSRM or [lat, lng] from our fallback
      if (Math.abs(coord[0]) > 90) {
        // This is likely [lon, lat] format from OSRM
        return [coord[1], coord[0]];
      }
      return coord;
    } else if (coord.lat !== undefined && (coord.lng !== undefined || coord.lon !== undefined)) {
      return [coord.lat, coord.lng || coord.lon];
    }
    return coord;
  });
  
  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: "#2196F3",
        weight: 5,
        opacity: 0.9,
      }}
    />
  );
}

// Main component
export default function Summary() {
  const { routeId } = useParams();
  const navigate = useNavigate();
  const [route, setRoute] = useState(null);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [routeGeometry, setRouteGeometry] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [showNavOptions, setShowNavOptions] = useState(false);
  const [hoveredPlace, setHoveredPlace] = useState(null);
  const [isVacayRoute, setIsVacayRoute] = useState(false);
  const [isPackageRoute, setIsPackageRoute] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  // Authentication check
  useEffect(() => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      console.log("User not logged in, redirecting to login page");
      navigate('/', { replace: true });
    }
  }, [navigate]);
  
  // Update route geometry when places or coordinates change
  useEffect(() => {
    if (originCoords && destCoords && places.length > 0) {
      fetchRouteGeometry(origin, destination, places);
    }
  }, [places, originCoords, destCoords]);
  
  // Fetch route data based on routeId
  useEffect(() => {
    async function fetchRouteData() {
      try {
        setError("");
        setLoading(true);
        
        const userEmail = localStorage.getItem('userEmail');
        if (!userEmail) {
          setError("You need to be logged in to view route details");
          setLoading(false);
          return;
        }
        
        // Check if this is a SmartVacay route
        if (routeId === 'vacay') {
          setIsVacayRoute(true);
          await handleVacayRoute();
        } 
        // Check if this is a Travel Package route
        else if (routeId === 'packages') {
          setIsPackageRoute(true);
          await handlePackageRoute();
        }
        else {
          console.log(`Fetching route ID: ${routeId} for user: ${userEmail}`);
          const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          
          // Using try-catch here to handle potential axios failures
          try {
            const response = await axios.get(`${baseUrl}/saved/${userEmail}/${routeId}`);
            const data = response.data;
            console.log("Route data:", data);
            
            // Debug the places structure
            if (data.places && data.places.length > 0) {
              console.log("First place structure:", data.places[0]);
            }
            
            // Set route data - ensure we have the necessary fields
            setRouteData(data);
            setOrigin(data.origin || "");
            setDestination(data.destination || "");
            
            // Ensure we have a places array, even if empty
            const placesData = data.places || [];
            
            // Mark all places as checked by default and ensure they have lat/lng properties
            const placesWithChecked = placesData.map(place => {
              // Check if place already has lat/lng or needs conversion from latitude/longitude
              const placeWithCoords = {
                ...place,
                checked: true,
                // Ensure we have both formats available to handle different API requirements
                lat: place.lat || place.latitude,
                lng: place.lng || place.longitude,
                latitude: place.latitude || place.lat,
                longitude: place.longitude || place.lng
              };
              return placeWithCoords;
            });
            
            console.log("Places with coords:", placesWithChecked);
            setPlaces(placesWithChecked);
            
            // Get coordinates for origin and destination - this should always happen
            await getCoordinatesFromAddresses(data.origin, data.destination);
            
            // If places have missing coordinates, look them up
            if (placesWithChecked.length > 0) {
              const updatedPlaces = await Promise.all(placesWithChecked.map(async (place, index) => {
                if (!place.longitude || !place.lng) {
                  // If we have a place name, try to get coordinates from it
                  if (place.name) {
                    try {
                      // Add the destination to make the search more specific to that region
                      const searchQuery = `${place.name} near ${data.destination}`;
                      console.log(`Looking up coordinates for place: ${searchQuery}`);
                      
                      const placeResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
                      const placeData = await placeResponse.json();
                      
                      if (placeData && placeData.length > 0) {
                        console.log(`Found coordinates for ${place.name}:`, placeData[0]);
                        
                        // Update the place with the looked-up coordinates
                        return {
                          ...place,
                          lat: parseFloat(placeData[0].lat),
                          lng: parseFloat(placeData[0].lon),
                          latitude: parseFloat(placeData[0].lat),
                          longitude: parseFloat(placeData[0].lon)
                        };
                      } else {
                        console.warn(`No coordinates found for ${place.name}, using fallback near destination`);
                        
                        // Use fallback coordinates
                        return createFallbackPlaceCoordinates(place, index, data.destination);
                      }
                    } catch (error) {
                      console.error(`Error looking up coordinates for ${place.name}:`, error);
                      return createFallbackPlaceCoordinates(place, index, data.destination);
                    }
                  } else {
                    return createFallbackPlaceCoordinates(place, index, data.destination);
                  }
                }
                return place;
              }));
              
              console.log("Updated places with looked-up coordinates:", updatedPlaces);
              setPlaces(updatedPlaces);
              
              // Generate route geometry with the updated places
              await fetchRouteGeometry(data.origin, data.destination, updatedPlaces);
            } else {
              // Even if no places, still create a direct route
              await fetchRouteGeometry(data.origin, data.destination, []);
            }
          } catch (error) {
            console.error("Error fetching route data:", error);
            setError(`Failed to load route: ${error.message}`);
            
            // Still try to get basic origin/destination data from URL params or other sources if possible
            if (!origin && !destination && routeId) {
              // Try to parse routeId for origin/destination if it contains this information
              const parts = routeId.split('_');
              if (parts.length >= 2) {
                setOrigin(parts[0] || "Unknown Origin");
                setDestination(parts[1] || "Unknown Destination");
                await getCoordinatesFromAddresses(parts[0], parts[1]);
              }
            }
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error in fetch routine:", error);
        setError("Failed to load route details, but map is still available. Please try again later.");
        
        // Even in case of a complete failure, create a fallback route so there's something to display
        const fallbackResult = createAndReturnFallbackRoute();
        if (fallbackResult) {
          setRoute(fallbackResult);
        }
        
        setLoading(false);
      }
    }
    
    if (routeId) {
      fetchRouteData();
    }
  }, [routeId]);
  
  // Add this function to fetch places along route (similar to suggest.jsx but with rate limiting)
  async function fetchPlacesAlongRoute(routeGeometry, keywords = []) {
    try {
      // Ensure we have a valid geometry
      if (!routeGeometry || routeGeometry.length < 2) {
        console.warn("Invalid route geometry for place fetching");
        return [];
      }
      
      // Calculate total route length
      let totalDistance = 0;
      for (let i = 0; i < routeGeometry.length - 1; i++) {
        totalDistance += calculateDistance(
          routeGeometry[i][1], routeGeometry[i][0],
          routeGeometry[i+1][1], routeGeometry[i+1][0]
        );
      }
      
      console.log(`Total route distance: ${(totalDistance/1000).toFixed(1)}km`);
      
      // Adjust sampling strategy based on route length
      // For longer routes, sample more points and space them more evenly
      // BUT limit to fewer points than suggest.jsx to reduce API calls
      const routeLengthKm = totalDistance / 1000;
      
      // Use fewer sampling points to reduce API calls
      const numSamplePoints = routeLengthKm > 500 ? 4 : 
                             routeLengthKm > 200 ? 3 : 
                             routeLengthKm > 50 ? 2 : 1;
      
      console.log(`Using ${numSamplePoints} sampling points for ${routeLengthKm.toFixed(1)}km route`);
      
      // Create evenly distributed points along the route
      const sampledPoints = [];
      
      // Calculate segment length
      const segmentLength = (routeGeometry.length - 1) / (numSamplePoints - 1 || 1);
      
      // Sample points at even intervals
      for (let i = 0; i < numSamplePoints; i++) {
        // Calculate index
        const index = Math.min(Math.round(i * segmentLength), routeGeometry.length - 1);
        sampledPoints.push(routeGeometry[index]);
      }
      
      console.log(`Sampling ${sampledPoints.length} evenly spaced points along the route`);
      
      // Add significant delay between requests to avoid rate limiting (500ms instead of 300ms)
      const placesPromises = sampledPoints.map(async ([lon, lat], index) => {
        // Add a delay between requests
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        try {
          console.log(`Fetching places at point ${index + 1}/${sampledPoints.length}: [${lat}, ${lon}]`);
          const response = await fetch(`http://localhost:5000/api/landmarks/places?lat=${lat}&lng=${lon}&keywords=${keywords.join(',')}`);
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          const data = await response.json();
          console.log(`Places found at point ${index + 1}/${sampledPoints.length}: ${data.results?.length || 0}`);
          return data.results || [];
        } catch (err) {
          console.error(`Error fetching places at point ${index + 1}/${sampledPoints.length}:`, err);
          return [];
        }
      });
      
      const allPlacesArrays = await Promise.all(placesPromises);
      
      // Combine all places and remove duplicates using place_id
      const uniquePlaces = new Map();
      allPlacesArrays.flat().forEach(place => {
        if (!uniquePlaces.has(place.place_id)) {
          uniquePlaces.set(place.place_id, {
            id: place.place_id,
            name: place.name,
            lat: place.geometry.location.lat,
            lon: place.geometry.location.lng,
            rating: place.rating || "N/A",
            types: place.types || [],
            vicinity: place.vicinity || "",
            photoRef: place.photos?.[0]?.photo_reference,
            checked: false // Initially unchecked
          });
        }
      });
      
      // Convert to array
      let places = Array.from(uniquePlaces.values());
      
      console.log(`Found ${places.length} unique places before filtering`);
      
      if (places.length === 0) {
        console.warn("No places found from any sampling point");
        return [];
      }
      
      // Filter to max 10 places (fewer than suggest.jsx) to keep the interface clean
      if (places.length > 10) {
        // Sort by rating first
        places.sort((a, b) => {
          const ratingA = typeof a.rating === 'number' ? a.rating : 0;
          const ratingB = typeof b.rating === 'number' ? b.rating : 0;
          return ratingB - ratingA;
        });
        
        // Take top 10
        places = places.slice(0, 10);
      }
      
      return places;
    } catch (error) {
      console.error('Error fetching places along route:', error);
      // Return empty array on error
      return [];
    }
  }

  // Handle SmartVacay route data
  async function handleVacayRoute() {
    try {
      // Get vacation trip data from sessionStorage
      const vacayTripJSON = sessionStorage.getItem('vacayTrip');
      if (!vacayTripJSON) {
        setError("No vacation trip data found. Please select a vacation from the home page.");
        setLoading(false);
        return;
      }
      
      const vacayTrip = JSON.parse(vacayTripJSON);
      console.log("Vacation trip data:", vacayTrip);
      
      // Validate required fields
      if (!vacayTrip.destination) {
        console.error("Vacation trip data is missing destination");
        setError("Invalid vacation data: missing destination. Please select a destination from the home page.");
        setLoading(false);
        
        // Create a fallback route
        createFallbackRoute();
        return;
      }
      
      // Set basic route information
      setOrigin(vacayTrip.origin || "");
      setDestination(vacayTrip.destination || "");
      
      // Set approximate route details
      setRoute({
        time: vacayTrip.days * 24 * 60 * 60, // convert days to seconds
        distance: vacayTrip.distance * 1000, // convert km to meters
      });
      
      // Check if we have coordinates already from SmartVacay
      let coordsFound = false;
      if (vacayTrip.coords) {
        console.log("Using coordinates from SmartVacay:", vacayTrip.coords);
        setDestCoords(vacayTrip.coords);
        
        // Only the destination has coordinates from SmartVacay
        // We still need to get origin coordinates
        const originResult = await getOriginCoordinates(vacayTrip.origin);
        
        if (originResult) {
          coordsFound = true;
          
          // Try to create a route with the existing coordinates using OSRM
          if (originResult && vacayTrip.coords) {
            // Create an OSRM compatible origin/destination
            const osrmOrigin = { lat: originResult.lat, lng: originResult.lng };
            const osrmDest = { lat: vacayTrip.coords.lat, lng: vacayTrip.coords.lng };
            
            console.log("Fetching OSRM route between:", osrmOrigin, osrmDest);
            
            // Fetch the route with OSRM
            const routeData = await fetchRouteGeometry(osrmOrigin, osrmDest, []);
            
            if (routeData && routeData.geometry && routeData.geometry.length > 1) {
              // Use the OSRM route
              setRoute(routeData);
              
              // Get keywords for place search from sessionStorage, if any
              const keywordsJSON = sessionStorage.getItem("selectedKeywords");
              const keywords = keywordsJSON ? JSON.parse(keywordsJSON) : [];
              
              // Fetch places along this route
              console.log("Fetching places along OSRM route with keywords:", keywords);
              const routePlaces = await fetchPlacesAlongRoute(routeData.geometry, keywords);
              
              if (routePlaces && routePlaces.length > 0) {
                setPlaces(routePlaces);
                console.log("Found places along route:", routePlaces.length);
              } else {
                console.log("No places found along route, getting top tourist attractions");
                // Fallback to original tourist attractions method
                await fetchTopTouristAttractions(vacayTrip.destination);
              }
            } else {
              console.warn("OSRM returned invalid route geometry, using fallback");
              // Create a curved route
              const geometry = createCurvedRoute(
                originResult.lat, originResult.lng, 
                vacayTrip.coords.lat, vacayTrip.coords.lng
              );
              
              setRoute(prev => ({
                ...prev,
                geometry
              }));
              
              // Fallback to tourist attractions
              await fetchTopTouristAttractions(vacayTrip.destination);
            }
          }
        }
      }
      
      // If we don't have coordinates from SmartVacay or couldn't get origin coords
      if (!coordsFound) {
        // Get coordinates for origin and destination FIRST and wait for them to be set
        await getCoordinatesFromAddressesAndWait(vacayTrip.origin, vacayTrip.destination);
        
        // Now that we have coordinates, fetch tourist attractions
        if (destCoords) {
          await fetchTopTouristAttractions(vacayTrip.destination);
        } else {
          setError("Failed to get coordinates for destination. Using direct route.");
          setPlaces([]);
          
          // Create a fallback route
          createFallbackRoute();
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error("Error handling vacation route:", error);
      setError("Failed to load vacation route details.");
      setLoading(false);
      
      createFallbackRoute();
    }
  }
  
  // Handle Travel Package route data
  async function handlePackageRoute() {
    try {
      // Get package trip data from sessionStorage
      const packageTripJSON = sessionStorage.getItem('packageTrip');
      if (!packageTripJSON) {
        console.error("No package trip data found in sessionStorage");
        setError("Package trip data not found. Please try selecting a destination again.");
        setLoading(false);
        return;
      }
      
      const packageTrip = JSON.parse(packageTripJSON);
      console.log("Package trip data:", packageTrip);
      
      // Validate destination
      if (!packageTrip.destination) {
        console.error("No destination found in package trip data");
        setError("No destination found in package data");
        setLoading(false);
        return;
      }
      
      // Set origin and destination fields
      setOrigin(packageTrip.origin || "");
      setDestination(packageTrip.destination || "");
      
      // Set route summary info (estimate)
      setRoute({
        time: (packageTrip.distance * 60 * 60) / 50, // rough estimate: distance / 50 km/h * 3600 seconds
        distance: packageTrip.distance * 1000, // convert km to meters
      });
      
      // Check if we have coordinates for both origin and destination
      if (packageTrip.originCoords && packageTrip.destinationCoords) {
        console.log("Using coordinates from package data:", packageTrip.originCoords, packageTrip.destinationCoords);
        setOriginCoords(packageTrip.originCoords);
        setDestCoords(packageTrip.destinationCoords);
        
        // Fetch route using OSRM
        const osrmOrigin = { lat: packageTrip.originCoords.lat, lng: packageTrip.originCoords.lng };
        const osrmDest = { lat: packageTrip.destinationCoords.lat, lng: packageTrip.destinationCoords.lng };
        
        try {
          const routeData = await fetchRouteGeometry(osrmOrigin, osrmDest, []);
          if (routeData) {
            setRouteGeometry(routeData.geometry);
            setRoute({
              geometry: routeData.geometry,
              time: routeData.time,
              distance: routeData.distance
            });
            
            // Fetch tourist attractions for destination
            try {
              await fetchTopTouristAttractions(packageTrip.destination);
            } catch (attractionError) {
              console.error("Error fetching tourist attractions:", attractionError);
              // This is non-fatal, so we continue
            }
          }
        } catch (routeError) {
          console.error("Could not fetch route using coordinates:", routeError);
          // Try fallback method with straight line route
          createFallbackRoute();
          
          // Still try to fetch tourist attractions
          try {
            await fetchTopTouristAttractions(packageTrip.destination);
          } catch (attractionError) {
            console.error("Error fetching tourist attractions:", attractionError);
          }
        }
      } else {
        // If we don't have coordinates, use addresses to geocode
        console.log("No coordinates found in package data, geocoding addresses...");
        try {
          const result = await getCoordinatesFromAddressesAndWait(packageTrip.origin, packageTrip.destination);
          if (!result) {
            throw new Error("Failed to geocode addresses");
          }
          
          // Try to fetch tourist attractions
          try {
            await fetchTopTouristAttractions(packageTrip.destination);
          } catch (attractionError) {
            console.error("Error fetching tourist attractions:", attractionError);
          }
        } catch (geocodeError) {
          console.error("Error geocoding addresses:", geocodeError);
          setError("Could not find coordinates for the entered locations. Please try again with more specific addresses.");
          // Create a fallback route if possible
          createFallbackRoute();
        }
      }
    } catch (error) {
      console.error("Error handling package route:", error);
      setError("Error processing package data: " + error.message);
    } finally {
      setLoading(false);
    }
  }
  
  // Helper function to get just origin coordinates
  async function getOriginCoordinates(originAddr) {
    if (!originAddr) return null;
    
    try {
      const formattedOrigin = formatAddressForGeocoding(originAddr);
      
      // First try direct geocoding
      const originResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formattedOrigin)}&countrycodes=in&limit=1`);
      const originData = await originResponse.json();
      
      if (originData && originData.length > 0) {
        const originCoords = {
          lat: parseFloat(originData[0].lat),
          lng: parseFloat(originData[0].lon)
        };
        setOriginCoords(originCoords);
        return originCoords;
      }
      
      // If direct geocoding fails, try fallback
      const fallbackCoords = await tryFallbackGeocoding(originAddr);
      if (fallbackCoords) {
        setOriginCoords(fallbackCoords);
        return fallbackCoords;
      }
      
      // If all attempts fail
      return null;
    } catch (error) {
      console.error("Error getting origin coordinates:", error);
      return null;
    }
  }
  
  // Create a curved route between two points
  function createCurvedRoute(startLat, startLng, endLat, endLng) {
    const pointCount = 20; // Number of points including start and end
    
    // Calculate the distance between start and end
    const dLat = endLat - startLat;
    const dLng = endLng - startLng;
    const straightLineDistance = Math.sqrt(dLat * dLat + dLng * dLng);
    
    // Create a curve by adding some variance depending on the distance
    // For very short routes, use less curvature
    const curveFactor = Math.min(0.3, straightLineDistance * 0.5);
    
    const geometry = [];
    
    // Add points along a curve
    for (let i = 0; i < pointCount; i++) {
      const fraction = i / (pointCount - 1);
      
      // Base position on the direct line
      const baseLat = startLat + dLat * fraction;
      const baseLng = startLng + dLng * fraction;
      
      // Add some curve to the line (perpendicular to the direct line)
      // Maximum deviation in the middle, declining towards the ends
      const deviation = Math.sin(fraction * Math.PI) * curveFactor;
      
      // Calculate perpendicular direction
      const perpLat = -dLng; // Perpendicular to (dLat, dLng)
      const perpLng = dLat;
      const perpLength = Math.sqrt(perpLat * perpLat + perpLng * perpLng);
      
      // Normalize and apply deviation (avoid division by zero)
      if (perpLength > 0) {
      const normPerpLat = perpLat / perpLength * deviation;
      const normPerpLng = perpLng / perpLength * deviation;
      
        // Add the point with curve deviation
      geometry.push([baseLat + normPerpLat, baseLng + normPerpLng]);
      } else {
        // Fallback if perpendicular length is zero
        geometry.push([baseLat, baseLng]);
      }
    }
    
    return geometry;
  }
  
  // Get coordinates and wait for state to update
  async function getCoordinatesFromAddressesAndWait(originAddr, destAddr) {
    try {
      console.log("Getting coordinates for:", { origin: originAddr, destination: destAddr });
      
      // Format addresses to improve geocoding success
      const formattedOrigin = formatAddressForGeocoding(originAddr);
      const formattedDest = formatAddressForGeocoding(destAddr);
      
      // Get origin coordinates
      let originCoordsLocal = null;
      try {
        const originResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formattedOrigin)}&countrycodes=in&limit=1`);
        const originData = await originResponse.json();
        
        if (originData && originData.length > 0) {
          originCoordsLocal = {
            lat: parseFloat(originData[0].lat),
            lng: parseFloat(originData[0].lon)
          };
          console.log("Successfully geocoded origin:", originCoordsLocal);
          setOriginCoords(originCoordsLocal);
        } else {
          console.warn("Failed to geocode origin directly:", formattedOrigin);
          // Try with simplified address
          originCoordsLocal = await tryFallbackGeocoding(originAddr);
          if (originCoordsLocal) {
            setOriginCoords(originCoordsLocal);
          }
        }
      } catch (error) {
        console.error("Error geocoding origin:", error);
        originCoordsLocal = await tryFallbackGeocoding(originAddr);
        if (originCoordsLocal) {
          setOriginCoords(originCoordsLocal);
        }
      }
      
      // Add a small delay to ensure any state updates have time to process
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get destination coordinates
      let destCoordsLocal = null;
      try {
        const destResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formattedDest)}&countrycodes=in&limit=1`);
        const destData = await destResponse.json();
        
        if (destData && destData.length > 0) {
          destCoordsLocal = {
            lat: parseFloat(destData[0].lat),
            lng: parseFloat(destData[0].lon)
          };
          console.log("Successfully geocoded destination:", destCoordsLocal);
          setDestCoords(destCoordsLocal);
        } else {
          console.warn("Failed to geocode destination directly:", formattedDest);
          // Try with simplified address
          destCoordsLocal = await tryFallbackGeocoding(destAddr);
          if (destCoordsLocal) {
            setDestCoords(destCoordsLocal);
          }
        }
      } catch (error) {
        console.error("Error geocoding destination:", error);
        destCoordsLocal = await tryFallbackGeocoding(destAddr);
        if (destCoordsLocal) {
          setDestCoords(destCoordsLocal);
        }
      }
      
      // Add another small delay to ensure state updates
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Return the coordinates directly to use them immediately
      return { originCoords: originCoordsLocal, destCoords: destCoordsLocal };
    } catch (error) {
      console.error("Error in coordinate fetching process:", error);
      return { originCoords: null, destCoords: null };
    }
  }
  
  // Format address specifically for geocoding
  function formatAddressForGeocoding(address) {
    if (!address) return '';
    
    // Remove any excess whitespace
    let formatted = address.trim();
    
    // If it's already a short address, just return it
    if (formatted.split(',').length <= 2) return formatted;
    
    // For Indian addresses, try to format more specifically by focusing on the important parts
    const parts = formatted.split(',').map(part => part.trim());
    
    // Check if we have enough parts to work with
    if (parts.length >= 3) {
      // For complex addresses, focus on the most significant parts
      // Usually the first part (locality) and last parts (city/state) are most useful
      return `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
    }
    
    return formatted;
  }
  
  // Try fallback geocoding methods when direct geocoding fails
  async function tryFallbackGeocoding(address) {
    if (!address) return null;
    
    // Common tourist destinations in India with approximate coordinates
    const indiaCoords = {
      "delhi": { lat: 28.7041, lng: 77.1025 },
      "mumbai": { lat: 19.0760, lng: 72.8777 },
      "bangalore": { lat: 12.9716, lng: 77.5946 },
      "chennai": { lat: 13.0827, lng: 80.2707 },
      "kolkata": { lat: 22.5726, lng: 88.3639 },
      "hyderabad": { lat: 17.3850, lng: 78.4867 },
      "pune": { lat: 18.5204, lng: 73.8567 },
      "shimla": { lat: 31.1048, lng: 77.1734 },
      "jaipur": { lat: 26.9124, lng: 75.7873 },
      "goa": { lat: 15.2993, lng: 74.1240 },
      "agra": { lat: 27.1767, lng: 78.0081 },
      "kochi": { lat: 9.9312, lng: 76.2673 },
      "munnar": { lat: 10.0889, lng: 77.0595 },
      "ooty": { lat: 11.4102, lng: 76.6950 },
      "coorg": { lat: 12.4244, lng: 75.7382 },
      "varanasi": { lat: 25.3176, lng: 82.9739 },
      "pondicherry": { lat: 11.9416, lng: 79.8083 },
      "manali": { lat: 32.2432, lng: 77.1892 },
      "kerala": { lat: 10.8505, lng: 76.2711 }, // Central Kerala
      "thirumarady": { lat: 10.0237, lng: 76.5432 }, // Approximate for Thirumarady
      "muvattupuzha": { lat: 9.9894, lng: 76.5790 }, // Muvattupuzha, Kerala
      "ernakulam": { lat: 9.9816, lng: 76.2999 }, // Ernakulam, Kerala
      "tamil": { lat: 11.1271, lng: 78.6569 }, // Central Tamil Nadu
      "nadu": { lat: 11.1271, lng: 78.6569 }, // Same as Tamil
      "uttar": { lat: 27.5706, lng: 80.0982 }, // Central Uttar Pradesh
      "pradesh": { lat: 27.5706, lng: 80.0982 }, // Same as Uttar
      "karnataka": { lat: 15.3173, lng: 75.7139 }, // Central Karnataka
      "himachal": { lat: 31.8043, lng: 77.4332 }, // Central Himachal Pradesh
      "rajasthan": { lat: 27.0238, lng: 74.2179 } // Central Rajasthan
    };
    
    // Try to match with known locations
    const addressLower = address.toLowerCase();
    
    // First check for exact matches of destination names
    for (const [city, coords] of Object.entries(indiaCoords)) {
      if (addressLower === city || addressLower.includes(`, ${city}`) || 
          addressLower.includes(`, ${city},`) || addressLower.endsWith(`, ${city}`)) {
        console.log(`Found exact match for ${city} in address`);
        return coords;
      }
    }
    
    // Then check for partial matches in the address
    for (const [city, coords] of Object.entries(indiaCoords)) {
      if (addressLower.includes(city)) {
        console.log(`Found partial match for ${city} in address: ${address}`);
        return coords;
      }
    }
    
    // If we reach here, we couldn't find any matches
    console.warn(`No matches found for address: ${address}`);
    return null;
  }
  
  // Fetch top tourist attractions for a destination
  async function fetchTopTouristAttractions(destination) {
    try {
      if (!destination) {
        throw new Error("Destination is required");
      }
      
      // Check if we have destination coordinates, they're required for this API
      if (!destCoords || !destCoords.lat || !destCoords.lng) {
        console.error("Error fetching tourist attractions: Destination coordinates are not available");
        
        // Create fallback places around the destination area
        const fallbackPlaces = createFallbackAttractions(destination);
        setPlaces(fallbackPlaces);
        return;
      }
      
      console.log(`Fetching tourist attractions for ${destination} at coordinates:`, destCoords);
      
      // Using local API endpoint
      const response = await fetch(`http://localhost:5000/api/landmarks/touristAttractions?location=${encodeURIComponent(destination)}&lat=${destCoords.lat}&lng=${destCoords.lng}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tourist attractions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data || !data.results || !Array.isArray(data.results)) {
        throw new Error("Invalid response format for tourist attractions");
      }
      
      // Format places for the UI
      const formattedPlaces = data.results.map(place => ({
        id: place.place_id,
        name: place.name,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        vicinity: place.vicinity || "",
        rating: place.rating || "N/A",
        isFallback: false,
        checked: false
      }));
      
      console.log(`Found ${formattedPlaces.length} tourist attractions`);
      
      // Update state with fetched places
      setPlaces(formattedPlaces);
    } catch (error) {
      console.error("Error fetching tourist attractions:", error);
      
      // Create and use fallback places if API fails
      const fallbackPlaces = createFallbackAttractions(destination);
      setPlaces(fallbackPlaces);
    }
  }
  
  // Function to create fallback tourist attractions around a destination
  function createFallbackAttractions(destination) {
    // Number of fallback places to create
    const numPlaces = 5;
    
    // Popular attraction types to use in names
    const attractionTypes = [
      "Temple", "Museum", "Park", "Lake", "Garden",
      "Fort", "Palace", "Beach", "Market", "Monument"
    ];
    
    // Create a center point - use destCoords if available, otherwise use center of India
    const centerLat = destCoords?.lat || 20.5937;
    const centerLng = destCoords?.lng || 78.9629;
    
    // Create fallback places around the center
    const fallbackPlaces = [];
    
    for (let i = 0; i < numPlaces; i++) {
      // Create a random offset (up to 0.05 degrees, roughly 5km)
      const latOffset = (Math.random() * 0.1 - 0.05);
      const lngOffset = (Math.random() * 0.1 - 0.05);
      
      // Get destination name without state/country parts if possible
      let placeName = destination;
      if (destination.includes(',')) {
        placeName = destination.split(',')[0].trim();
      }
      
      // Choose a random attraction type
      const attractionType = attractionTypes[Math.floor(Math.random() * attractionTypes.length)];
      
      // Create a plausible name
      const name = `${placeName} ${attractionType}`;
      
      fallbackPlaces.push({
        id: `fallback-${i}`,
        name: name,
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset,
        vicinity: `Near ${placeName}`,
        rating: (3 + Math.random() * 2).toFixed(1), // Random rating between 3 and 5
        isFallback: true,
        checked: false
      });
    }
    
    console.log(`Created ${fallbackPlaces.length} fallback attractions near ${destination}`);
    return fallbackPlaces;
  }
  
  // Helper function to get coordinates from addresses
  async function getCoordinatesFromAddresses(originAddr, destAddr) {
    try {
      // Get origin coordinates
      const originResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(originAddr)}`);
      const originData = await originResponse.json();
      if (originData && originData.length > 0) {
        setOriginCoords({
          lat: parseFloat(originData[0].lat),
          lng: parseFloat(originData[0].lon)
        });
      }
      
      // Get destination coordinates
      const destResponse = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destAddr)}`);
      const destData = await destResponse.json();
      if (destData && destData.length > 0) {
        setDestCoords({
          lat: parseFloat(destData[0].lat),
          lng: parseFloat(destData[0].lon)
        });
      }
    } catch (error) {
      console.error("Error getting coordinates:", error);
    }
  }
  
  // Helper function to sort places by distance from origin 
  function sortPlacesByDistanceFromOrigin(places, originCoords) {
    if (!places || !places.length || !originCoords) return places;
    
    console.log("Sorting places by distance from origin:", originCoords);
    
    // Calculate distances from origin
    const placesWithDistances = places.map(place => {
      const lat = place.lat || place.latitude;
      const lng = place.lng || place.longitude || place.lon;
      
      const distance = calculateDistance(
        originCoords.lat, 
        originCoords.lng, 
        lat, 
        lng
      );
      return { ...place, distanceFromOrigin: distance };
    });
    
    // Sort by distance from origin
    const sortedPlaces = placesWithDistances
      .sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
      
    console.log("Places sorted by distance:", sortedPlaces.map(p => p.name));
    
    return sortedPlaces;
  }
  
  // Fetch route geometry
  async function fetchRouteGeometry(origin, destination, places) {
    try {
      // Check that we have valid coordinates for origin and destination
      if (!origin || !destination) {
        console.warn("Missing origin or destination in fetchRouteGeometry");
        // Create a fallback route instead of returning null
        return createAndReturnFallbackRoute();
      }
      
      // Convert origin/destination to the format expected by the API
      const originCoord = typeof origin === 'string' 
        ? origin 
        : `${origin.lat},${origin.lng}`;
        
      const destCoord = typeof destination === 'string' 
        ? destination 
        : `${destination.lat},${destination.lng}`;
      
      // Format waypoints (places to visit)
      let waypoints = '';
      if (places && places.length > 0) {
        const checkedPlaces = places.filter(place => place.checked);
        if (checkedPlaces.length > 0) {
          // Sort places by distance from origin for more efficient routing
          const sortedPlaces = sortPlacesByDistanceFromOrigin(checkedPlaces, originCoords);
          
          waypoints = sortedPlaces
          .filter(place => {
            // Ensure place has valid coordinates
            const hasCoords = (place.lat || place.latitude) && (place.lng || place.longitude || place.lon);
            if (!hasCoords) {
              console.warn(`Place missing coordinates, skipping: ${place.name}`);
            }
            return hasCoords;
          })
          .map(place => {
            const lat = place.lat || place.latitude;
            const lng = place.lng || place.longitude || place.lon;
            return `${lat},${lng}`;
          })
          .join('|');
        }
      }
      
      // Create a direct point-to-point fallback route first, before even trying the API
      // This ensures we always have something to display even if the API call fails
      const fallbackRoute = createAndReturnFallbackRoute();
      
      try {
      // Construct the URL with waypoints if present
      let url = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/landmarks/osrm?origin=${encodeURIComponent(originCoord)}&destination=${encodeURIComponent(destCoord)}`;
      
      if (waypoints) {
        url += `&waypoints=${encodeURIComponent(waypoints)}`;
      }
      
        console.log(`Attempting to fetch route from OSRM API: ${url}`);
        
        // Make the API request with timeout to prevent long waiting
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
      
      // Handle non-200 responses
      if (!response.ok) {
          console.error("OSRM API error:", response.status, response.statusText);
          console.log("Using fallback route instead");
          return fallbackRoute;
      }
      
      // Parse the response
      const data = await response.json();
      
      // Validate the route geometry
      if (!data.geometry || !Array.isArray(data.geometry) || data.geometry.length < 2) {
        console.warn("OSRM returned invalid route geometry, using fallback");
          return fallbackRoute;
      }
      
      console.log(`OSRM route received with ${data.geometry.length} points`);
      
      // Process the route data
      return {
        geometry: data.geometry,
        time: data.duration * 1000, // Convert to milliseconds
        distance: data.distance
      };
      } catch (apiError) {
        console.error("OSRM API error:", apiError);
        return fallbackRoute; // Return the fallback route we created earlier
      }
    } catch (error) {
      console.error("Error in fetchRouteGeometry:", error);
      return createAndReturnFallbackRoute();
    }
  }
  
  // Helper function to create and return a fallback route
  function createAndReturnFallbackRoute() {
    console.log("Creating fallback route with curved line");
    
    // Extract coordinates for fallback route
    let originLat, originLng, destLat, destLng;
    
    // Use existing coordinates if available
    if (originCoords && destCoords) {
      originLat = originCoords.lat;
      originLng = originCoords.lng;
      destLat = destCoords.lat;
      destLng = destCoords.lng;
    } else {
      // Default to central India if no coordinates are available
      originLat = 20.5937;
      originLng = 78.9629;
      destLat = 28.7041;
      destLng = 77.1025;
    }
    
    // Create a curved route between the points for better visualization
    const geometry = createCurvedRoute(originLat, originLng, destLat, destLng);
        
        // Calculate approximate distance using Haversine formula
        const R = 6371; // Radius of the Earth in km
        const dLat = (destLat - originLat) * Math.PI / 180;
        const dLon = (destLng - originLng) * Math.PI / 180;
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) * 
          Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c * 1000; // Convert to meters
        
        // Estimate time (assuming 60 km/h average speed)
        const timeInSeconds = (distance / 1000) / 60 * 60 * 60; // Convert to seconds
        
        return {
          geometry,
          distance,
      time: timeInSeconds,
      isFallback: true
        };
  }
  
  // Update place coordinates based on API response
  function updatePlaceCoordinates(apiWaypoints, originalPlaces) {
    if (!apiWaypoints || apiWaypoints.length === 0) {
      console.log("No waypoints received from API to update coordinates");
      return;
    }
    
    console.log("Updating place coordinates with API data:", apiWaypoints);
    
    // Map the API waypoints to our places by name
    const updatedPlaces = [...places];
    
    apiWaypoints.forEach((apiWaypoint) => {
      if (!apiWaypoint.name || !apiWaypoint.location) {
        console.warn("Invalid waypoint data:", apiWaypoint);
        return;
      }
      
      // Find matching place by name - check multiple ways
      let placeIndex = -1;
      
      // First try exact match
      placeIndex = updatedPlaces.findIndex(p => 
        p.name && p.name.toLowerCase() === apiWaypoint.name.toLowerCase());
      
      // If no match, try partial match
      if (placeIndex === -1) {
        placeIndex = updatedPlaces.findIndex(p => 
          p.name && apiWaypoint.name.toLowerCase().includes(p.name.toLowerCase()));
      }
      
      // If still no match, try the reverse (API name in place name)
      if (placeIndex === -1) {
        placeIndex = updatedPlaces.findIndex(p => 
          p.name && p.name.toLowerCase().includes(apiWaypoint.name.toLowerCase().split(',')[0]));
      }
      
      if (placeIndex >= 0) {
        console.log(`Updating coordinates for ${updatedPlaces[placeIndex].name} with data from ${apiWaypoint.name}`);
        
        // Update coordinates - API returns [lon, lat] format, we need lat/lng
        updatedPlaces[placeIndex] = {
          ...updatedPlaces[placeIndex],
          lat: apiWaypoint.location[1],
          lng: apiWaypoint.location[0],
          latitude: apiWaypoint.location[1],
          longitude: apiWaypoint.location[0],
          formattedAddress: apiWaypoint.formattedAddress || updatedPlaces[placeIndex].name,
          // Check if this is an approximate location based on the formatted address
          isFallback: apiWaypoint.formattedAddress && apiWaypoint.formattedAddress.includes("(near ")
        };
      } else {
        console.warn(`Could not find matching place for waypoint: ${apiWaypoint.name}`);
      }
    });
    
    console.log("Places after coordinate update:", updatedPlaces);
    setPlaces(updatedPlaces);
  }
  
  // Fallback to the original method using coordinates
  async function fallbackToCoordinateMethod(origin, destination, places) {
    // Make sure we have coordinates for origin and destination
    if (!originCoords || !destCoords) {
      await getCoordinatesFromAddresses(origin, destination);
      
      if (!originCoords || !destCoords) {
        createFallbackRoute();
        return;
      }
    }
    
    // Format coordinates for API
    const originStr = `${originCoords.lat},${originCoords.lng}`;
    const destStr = `${destCoords.lat},${destCoords.lng}`;
    
    // Count places with valid coordinates
    const placesWithCoords = places.filter(place => {
      const lat = place.checked && (place.lat || place.latitude);
      const lng = place.checked && (place.lng || place.longitude);
      return place.checked && lat && lng;
    });
    
    // Prepare waypoints from places with coordinates
    const waypoints = placesWithCoords
      .map(place => {
        const lat = place.lat || place.latitude;
        const lng = place.lng || place.longitude;
        return `${lat},${lng}`;
      })
      .join('|');
    
    try {
      // Fetch route from backend
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      let url = new URL(`${baseUrl}/api/landmarks/routesWithPlaces`);
      url.searchParams.set("origin", originStr);
      url.searchParams.set("destination", destStr);
      if (waypoints) {
        url.searchParams.set("waypoints", waypoints);
      }
      
      const response = await fetch(url.toString());
      
      if (response.ok) {
        const data = await response.json();
        processRouteData(data);
      } else {
        // Try without waypoints
        url = new URL(`${baseUrl}/api/landmarks/routesWithPlaces`);
        url.searchParams.set("origin", originStr);
        url.searchParams.set("destination", destStr);
        
        const directResponse = await fetch(url.toString());
        if (directResponse.ok) {
          const directData = await directResponse.json();
          processRouteData(directData);
        } else {
          createFallbackRoute();
        }
      }
    } catch (error) {
      console.error("Error in fallback method:", error);
      createFallbackRoute();
    }
  }
  
  // Process route data
  function processRouteData(data) {
    console.log("Received route data:", data);
    
    // Check if we have the new API format or the old one
    if (data.route && data.route.geometry) {
      // New API format (/routesByPlaceNames)
      console.log(`Route has ${data.route.geometry.length} points`);
      
      // Convert to Leaflet format if needed (API returns [lon, lat], Leaflet wants [lat, lng])
      const geometry = data.route.geometry.map(coord => [coord[1], coord[0]]);
      
      // Set route data
      setRoute({
        geometry,
        time: data.route.timeValue || 0,
        distance: data.route.distanceValue || 0
      });
    } 
    else if (data.geometry && Array.isArray(data.geometry)) {
      // Check if we have valid geometry data
      if (data.geometry.length < 2) {
        console.warn("Invalid route geometry received (less than 2 points):", data.geometry);
        createFallbackRoute();
        return;
      }
      
      // Old API format with array of coordinates
      console.log(`Route has ${data.geometry.length} points`);
      
      // Convert to Leaflet format [lat, lng] as Leaflet expects
      const geometry = data.geometry.map(coord => [coord[1], coord[0]]);
      
      // Set route data
      setRoute({
        geometry,
        time: data.time || 0,
        distance: data.distance || 0
      });
    }
    else {
      console.warn("Invalid route data format received:", data);
      createFallbackRoute();
      return;
    }
    
    // Route successfully loaded
    setLoading(false);
  }
  
  // Creates a fallback route when all else fails
  function createFallbackRoute() {
    console.log("Creating fallback route");
    
    // Use any available coordinates, or fallback to center of India
    const startLat = originCoords?.lat || 20.5937;
    const startLng = originCoords?.lng || 78.9629;
    const endLat = destCoords?.lat || 28.7041;
    const endLng = destCoords?.lng || 77.1025;
    
    // Create a curved route with available coordinates
    const geometry = createCurvedRoute(startLat, startLng, endLat, endLng);
    
    // Set the route with default values
    setRoute({
      time: 3600 * 5, // 5 hours in seconds
      distance: 500 * 1000, // 500 km in meters
      geometry: geometry,
      isFallback: true
    });
    
    console.log("Fallback route created with geometry points:", geometry.length);
  }
  
  // Helper function to create fallback coordinates for a place
  function createFallbackPlaceCoordinates(place, index, destination) {
    // If destination coordinates exist, use them as a reference
    if (destCoords) {
      // Use destination as center
      const centerLat = destCoords.lat;
      const centerLng = destCoords.lng;
      
      // Create a distributed pattern of points based on the place index
      const angle = (index * 45) % 360; // Distribute in a circle
      const distance = 0.02 + (index * 0.005); // Increasing distance from center
      
      // Calculate offset using trigonometry
      const latOffset = distance * Math.cos(angle * Math.PI / 180);
      const lngOffset = distance * Math.sin(angle * Math.PI / 180);
      
      return {
        ...place,
        lat: centerLat + latOffset,
        lng: centerLng + lngOffset,
        latitude: centerLat + latOffset,
        longitude: centerLng + lngOffset
      };
    }
    
    // Default fallback - use center of India if we don't have destCoords
    return {
      ...place,
      lat: 20.5937 + (index * 0.01),
      lng: 78.9629 + (index * 0.01),
      latitude: 20.5937 + (index * 0.01),
      longitude: 78.9629 + (index * 0.01)
    };
  }
  
  // Toggle a place's checked status
  function togglePlace(index) {
    // Make sure index is within range
    if (index < 0 || index >= places.length) {
      console.warn(`Invalid place index: ${index}`);
      return;
    }
    
    setPlaces(prev => {
      const updated = [...prev];
      // Toggle the checked property
      updated[index] = { 
        ...updated[index], 
        checked: !updated[index].checked 
      };
      
      // Log the place that was toggled
      console.log(`${updated[index].checked ? 'Added' : 'Removed'} place: ${updated[index].name}`);
      
      // When selecting a place, if we have route data, update the route
      if (originCoords && destCoords) {
        // Schedule an async update to the route (don't block the UI)
        setTimeout(async () => {
          // Get all checked places
          const checkedPlaces = updated.filter(p => p.checked);
          
          if (checkedPlaces.length > 0) {
            // Sort places by distance from origin for more efficient routing
            const sortedPlaces = sortPlacesByDistanceFromOrigin(checkedPlaces, originCoords);
            console.log("Updating route with sorted places:", sortedPlaces.map(p => p.name));
            
            // Try to update the route with the new waypoints
            try {
              // Fetch updated route
              const routeResult = await fetchRouteGeometry(
                { lat: originCoords.lat, lng: originCoords.lng },
                { lat: destCoords.lat, lng: destCoords.lng },
                sortedPlaces
              );
              
              if (routeResult) {
                setRoute(routeResult);
              }
            } catch (error) {
              console.error("Error updating route with places:", error);
              // Keep the existing route
            }
          } else {
            // If no places are selected, revert to the original route
            try {
              const routeResult = await fetchRouteGeometry(
                { lat: originCoords.lat, lng: originCoords.lng },
                { lat: destCoords.lat, lng: destCoords.lng },
                []
              );
              
              if (routeResult) {
                setRoute(routeResult);
              }
            } catch (error) {
              console.error("Error reverting to original route:", error);
            }
          }
        }, 100);
      }
      
      return updated;
    });
  }
  
  // Handle navigate button click
  const handleNavigateClick = async () => {
    setShowNavOptions(true);
    
    // Fetch cost estimate if not already fetched
    if (!costEstimate && !isFetchingCost) {
      setIsFetchingCost(true);
      
      try {
        // First check if we have valid coordinates and origin/destination
        if (origin && destination) {
          const costData = await fetchTravelCost(
            origin, 
            destination,
            places,
            2 // Default to 2 people
          );
          
          setCostEstimate(costData);
        } else {
          // Fallback cost estimation based on route data if API fails
          if (route && route.distance) {
            // Create a simple cost estimate based on distance
            const distanceKm = route.distance / 1000;
            const fuelCost = Math.round(distanceKm * 8); // Rough estimate: ₹8 per km
            const foodCost = Math.round(distanceKm / 100 * 500); // ₹500 per 100km
            const totalCost = `₹${fuelCost + foodCost}`;
            
            setCostEstimate({
              totalCost,
              details: {
                fuel: `₹${fuelCost}`,
                food: `₹${foodCost}`
              }
            });
          } else {
            setCostEstimate({ 
              totalCost: "Unable to calculate",
              error: true 
            });
          }
        }
      } catch (error) {
        console.error("Error fetching cost estimate:", error);
        
        // Fallback cost estimation when API call fails
        if (route && route.distance) {
          const distanceKm = route.distance / 1000;
          const estimatedCost = `₹${Math.round(distanceKm * 10)}`; // Simple estimate: ₹10 per km
          
          setCostEstimate({
            totalCost: estimatedCost,
            note: "Estimated based on distance only"
          });
        } else {
          setCostEstimate({ 
            totalCost: "Unable to calculate",
            error: true 
          });
        }
      } finally {
        setIsFetchingCost(false);
      }
    }
  };

  // Handle navigation option selection
  const handleNavOptionSelect = (option) => {
    // Handle navigation option selection
    console.log(`Selected navigation option: ${option}`);
    
    // First check if we have valid information
    if (!origin || !destination) {
      console.error("Missing origin or destination for navigation");
      alert("Cannot navigate: missing origin or destination. Please try again later.");
      return;
    }
    
    try {
      let checkedPlaces = places.filter(place => place.checked);
      // Sort places by distance for more efficient routing
      if (checkedPlaces.length > 0 && originCoords) {
        checkedPlaces = sortPlacesByDistanceFromOrigin(checkedPlaces, originCoords);
      }
      
      let navUrl = '';
      
      switch(option) {
        case 'google':
          // Build URL with search terms instead of coordinates for better reliability
          navUrl = 'https://www.google.com/maps/dir/';
          
          // Add origin as a search term (more reliable than coordinates)
          navUrl += encodeURIComponent(origin) + '/';
          
          // Add each waypoint by name
          if (checkedPlaces.length > 0) {
            // Google Maps has a limit of around 10 waypoints
            const limitedWaypoints = checkedPlaces.slice(0, 10);
            console.log("Selected waypoints for navigation:", limitedWaypoints.map(p => p.name));
            
            limitedWaypoints.forEach(place => {
              // Use the place name which is more reliable than coordinates
              if (place.name) {
                navUrl += encodeURIComponent(place.name) + '/';
              }
            });
          }
          
          // Add destination
          navUrl += encodeURIComponent(destination);
          
          // Add additional parameters for directions
          navUrl += '/data=!4m2!4m1!3e0';  // 3e0 = driving mode
          
          break;
          
        case 'apple':
          // Apple Maps URL format
          navUrl = `http://maps.apple.com/?saddr=${encodeURIComponent(origin)}&daddr=${encodeURIComponent(destination)}`;
          break;
          
        default:
          navUrl = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
      }
      
      console.log("Navigation URL:", navUrl);
      
      // Open navigation in a new tab
      window.open(navUrl, '_blank');
    } catch (error) {
      console.error("Error creating navigation URL:", error);
      alert("There was a problem opening the navigation app. Please try again.");
    }
    
    setShowNavOptions(false);
  };
  
  // Return to saved routes list
  const handleBack = () => {
    navigate("/saver");
  };
  
  // Handle sign out functionality
  const handleSignOut = () => {
    // Remove user data from localStorage and sessionStorage
    localStorage.removeItem('userEmail');
    sessionStorage.clear();
    // Navigate to login page
    navigate('/');
  };
  
  // Add scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Update the fetchTravelCost function to fix the API endpoint issue and implement fallback
  async function fetchTravelCost(origin, destination, places, numPeople = 2) {
    try {
      setLoading(true);
      const checkedPlaces = places.filter(place => place.checked);
      
      // For vacation routes, check if we want to save this as a new route
      if (isVacayRoute) {
        // Get data from session storage
        const vacayTripJSON = sessionStorage.getItem('vacayTrip');
        if (!vacayTripJSON) {
          throw new Error("Vacation trip data not found");
        }
        
        const vacayTrip = JSON.parse(vacayTripJSON);
        
        // Create a new route entry - use the format expected by addRoute in saveroute.js
        const newRouteData = {
          email: localStorage.getItem('userEmail'),
          id: "x", // Special marker for new routes that triggers proper ID generation
          origin: origin,
          destination: destination,
          selectedPlaces: checkedPlaces.map(place => ({
            lat: place.lat,
            lng: place.lng || place.lon, // Handle different property naming
            name: place.name
          })),
          startDate: vacayTrip.startDate,
          endDate: vacayTrip.endDate
        };
        
        // Save as a new route
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const response = await fetch(`${baseUrl}/saved/save`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
        body: JSON.stringify({
          origin,
          destination,
          placesVisiting: checkedPlaces,
          numPeople: 2 // Hard-coded to 2 as suggested
        })
        });
        
        if (!response.ok) {
          const errorData = await response.text();
          console.error("Error response from server:", errorData);
          throw new Error(`Failed to save route: ${errorData}`);
        }
        
        const data = await response.json();
        alert('Vacation route saved successfully!');
        
        // Navigate to saved routes
        navigate('/saver');
        return;
      }
      
      // For regular saved routes, update the existing route
      // Construct the route data to update
      const updatedRouteData = {
        email: localStorage.getItem('userEmail'),
        routeId: routeId,
        origin: origin,
        destination: destination,
        selectedPlaces: checkedPlaces.map(place => ({
          lat: place.lat,
          lng: place.lng || place.lon, // Handle different property naming
          name: place.name
        }))
      };
      
      // Call the API to update the route
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${baseUrl}/saved/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedRouteData)
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error("Error response from server:", errorData);
        throw new Error(`Failed to update route: ${errorData}`);
      }
      
      const data = await response.json();
      alert('Route updated successfully!');
      
      // Update local state with the checked places only
      setPlaces(checkedPlaces);
      
      // Re-fetch the route geometry with only checked places
      if (originCoords && destCoords) {
        fetchRouteGeometry(origin, destination, checkedPlaces);
      }
      
    } catch (error) {
      console.error('Error updating route:', error);
      setError(`Failed to update the route: ${error.message}`);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Add this function to fetch places from Google Maps API as a backup
  async function fetchPlaceCoordinatesFromGoogle(placeName) {
    try {
      if (!placeName) return null;
      
      // Try to get coordinates from Nominatim first (avoid API costs)
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(placeName)}&limit=1`;
      const nominatimResponse = await fetch(nominatimUrl);
      
      if (nominatimResponse.ok) {
        const data = await nominatimResponse.json();
        if (data && data.length > 0) {
          return {
            name: placeName,
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          };
        }
      }
      
      // If no results from Nominatim, try a simple geocoding approach
      // This is a fallback that doesn't require API keys but is less accurate
      // In a production app, you would use Google Maps, Mapbox, or other geocoding API with keys
      
      // For now, create an approximate location based on pattern matching
      // with some common locations in India
      return tryFallbackGeocoding(placeName);
      
    } catch (error) {
      console.error(`Error fetching coordinates for ${placeName}:`, error);
      return null;
    }
  }

  return (
    <div className="summary-container">
      <div className="top-bar">
        <div className="nav-links">
          <a href="/home"><h4>Home</h4></a>
          <FaUserCircle
            size={24}
            className="profile-icon"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          />
          {showProfileMenu && (
            <div className="profile-dropdown">
              <a href="#profile">My Profile</a>
              <a href="#settings">Settings</a>
              <a href="#switch">Switch Account</a>
              <a href="#signout" onClick={handleSignOut}>Sign Out</a>
            </div>
        )}
      </div>
      </div>
      
      <div className="content-container">
        <div className="sidebar">
          <button className="back-button" onClick={handleBack}>
            <FaArrowLeft className="back-icon" /> Back
          </button>
          <div className="route-header">
            <h3>Route Summary</h3>
          </div>
          {loading ? (
          <div className="loading-message">
            <p>Loading route data...</p>
          </div>
          ) : error ? (
            <div className="error-message">
              <p>{error}</p>
        </div>
          ) : (
            <>
              <div className="route-info">
                <div className="route-stats">
                  <p><strong>Distance:</strong> {route?.distance ? `${(route.distance / 1000).toFixed(1)} km` : 'N/A'}</p>
                  <p><strong>Estimated time:</strong> {route?.time ? `${Math.floor(route.time / 3600)} hr ${Math.floor((route.time % 3600) / 60)} min` : 'N/A'}</p>
                </div>
              </div>
              
              <div className="places-header">
                <h4>Places along the route</h4>
                <span>{places.filter(p => p.checked).length} selected</span>
              </div>
              
              <div className="place-list">
                {places.length > 0 ? (
                  places.map((place, index) => (
                    <div 
                      key={place.id || `place-${index}`} 
                      className="place-item"
                      onMouseEnter={() => setHoveredPlace(place)}
                      onMouseLeave={() => setHoveredPlace(null)}
                    >
                      <div className="place-name">{place.name}</div>
                      <input 
                        type="checkbox" 
                        checked={place.checked || false}
                        onChange={() => togglePlace(index)}
                      />
                    </div>
                  ))
                ) : (
                  <p>No places found along this route.</p>
                )}
              </div>
              
              <div className="bottom-buttons">
                <button id="navigate-btn" onClick={handleNavigateClick}>
                  <FaRoute /> Navigate
                </button>
              </div>
            </>
          )}
        </div>
        
        <div className="map-area">
          {loading ? (
            <div className="loading-message">
              <p>Loading route data...</p>
            </div>
          ) : (
            <MapContainer
              center={originCoords ? [originCoords.lat, originCoords.lng] : [20.5937, 78.9629]}
              zoom={originCoords && destCoords ? 8 : 4}
              style={{ height: "100%", width: "100%" }}
              className="map-container"
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* Origin marker */}
              {originCoords && (
                <Marker position={[originCoords.lat, originCoords.lng]} icon={originIcon}>
                  <Popup>{origin}</Popup>
                </Marker>
              )}
              
              {/* Destination marker */}
              {destCoords && (
                <Marker position={[destCoords.lat, destCoords.lng]} icon={destinationIcon}>
                  <Popup>{destination}</Popup>
                </Marker>
              )}
              
              {/* Place markers */}
              {places.map((place, index) => (
                <Marker 
                  key={`marker-${place.id || index}`}
                  position={[place.lat, place.lng || place.lon || place.longitude]}
                  icon={place.checked ? selectedPlaceIcon : place.isFallback ? fallbackPlaceIcon : placeIcon}
                >
                  <Popup>
                    <div className="place-popup">
                      <h3>{place.name}</h3>
                      {place.vicinity && <p>{place.vicinity}</p>}
                      {place.rating && <p>Rating: {place.rating}</p>}
                      <button 
                        className={`place-toggle-btn ${place.checked ? 'selected' : ''}`}
                        onClick={() => togglePlace(index)}
                      >
                        {place.checked ? 'Remove from route' : 'Add to route'}
                      </button>
        </div>
                  </Popup>
                </Marker>
              ))}
              
              {/* Route polyline */}
              {route && route.geometry && route.geometry.length > 1 && (
                <RoutePolylines routeGeometry={route.geometry} />
              )}
            </MapContainer>
          )}
          
          {/* Hovered place info */}
          {hoveredPlace && (
            <div className="hoverbox">
              <div className="hoverbox-info">
                <div className="hoverbox-name">{hoveredPlace.name}</div>
                {hoveredPlace.vicinity && <p>{hoveredPlace.vicinity}</p>}
                {hoveredPlace.rating && <p>Rating: {hoveredPlace.rating}</p>}
              </div>
            </div>
          )}
        </div>
        
        {/* Navigation options dialog */}
        {showNavOptions && (
          <div className="nav-options">
            <button className="nav-options-close" onClick={() => setShowNavOptions(false)}>
              <FiX />
            </button>
            <div className="nav-options-header">Choose Navigation App</div>
            
            {/* Cost estimate section */}
            <div className="cost-estimate">
              <p>Approximate Cost</p>
              {isFetchingCost ? (
                <p>Calculating...</p>
              ) : costEstimate ? (
                <div className="cost-value">
                  {costEstimate.error ? 'Unable to calculate' : costEstimate.totalCost}
                  {costEstimate.note && <p className="cost-note">{costEstimate.note}</p>}
                </div>
              ) : (
                <p>Not available</p>
              )}
            </div>
            
            {/* Show error if we have invalid data */}
            {(!origin || !destination) ? (
              <div className="nav-error">
                <p>Cannot start navigation: missing origin or destination</p>
                <button 
                  className="retry-btn"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </button>
              </div>
            ) : (
              <>
                <button 
                  className="google-maps-btn"
                  onClick={() => handleNavOptionSelect('google')}
                >
                  <FaGoogle /> Google Maps
                </button>
                <button 
                  className="apple-maps-btn"
                  onClick={() => handleNavOptionSelect('apple')}
                >
                  <FaApple /> Apple Maps
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}