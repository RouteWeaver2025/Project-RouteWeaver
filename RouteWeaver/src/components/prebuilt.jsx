import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FaUserCircle, FaArrowLeft, FaMapMarkerAlt, FaRoute, FaHome, FaDollarSign } from 'react-icons/fa';
import axios from 'axios';
import fallbackImg from "../assets/homeimg.jpg";
import { IoArrowBack, IoHome, IoSave } from "react-icons/io5";
import { FaUser } from "react-icons/fa";

// Custom Icon for Origin/Destination
const endpointIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Custom Icon for Waypoints
const waypointIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Custom Icon for Hovered Place Marker
const hoveredIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// Component to manage map view and update when route changes
function MapController({ route, originCoords, destCoords, selectedPlaces }) {
  const map = useMap();
  
  useEffect(() => {
    if (!originCoords || !destCoords) return;
    
    const bounds = L.latLngBounds([
      [originCoords.lat, originCoords.lng],
      [destCoords.lat, destCoords.lng]
    ]);
    
    // Add selected places to bounds
    if (selectedPlaces && selectedPlaces.length > 0) {
      selectedPlaces.forEach(place => {
        if (place.lat && place.lng) {
          bounds.extend([place.lat, place.lng]);
        }
      });
    }
    
    // Fit map to bounds with padding
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, route, originCoords, destCoords, selectedPlaces]);
  
  return null;
}

// Component to display route polyline
function RoutePolyline({ route }) {
  if (!route) {
    console.log("No route provided to RoutePolyline");
    return null;
  }
  
  if (!route.geometry) {
    console.error("Route has no geometry:", route);
    return null;
  }
  
  // OSRM returns coordinates as [lng, lat], Leaflet needs [lat, lng]
  let positions = [];
  
  try {
    console.log("RoutePolyline processing geometry type:", 
      Array.isArray(route.geometry) ? "Array" : 
      (route.geometry.coordinates ? "GeoJSON" : "Unknown"));
    
    // Check if this is a fallback route 
    if (route.isFallback) {
      console.log("Rendering fallback route (direct line)");
      // Fallback routes are already in [lng, lat] format
      positions = route.geometry.map(coord => [coord[1], coord[0]]);
    }
    // Standard array of coordinates from OSRM
    else if (Array.isArray(route.geometry)) {
      console.log(`Using array geometry format with ${route.geometry.length} points`);
      
      // Check the first coordinate to determine format
      const firstCoord = route.geometry[0];
      
      // Handle array format [lng, lat] from OSRM
      if (Array.isArray(firstCoord) && firstCoord.length >= 2) {
        positions = route.geometry.map(coord => {
          // OSRM returns [longitude, latitude]
          // Leaflet expects [latitude, longitude]
          return [coord[1], coord[0]];
        });
      } 
      // Handle object format {lat, lng} or {lat, lon}
      else if (firstCoord && (typeof firstCoord.lat === 'number' || typeof firstCoord.latitude === 'number')) {
        positions = route.geometry.map(coord => {
          const lat = coord.lat || coord.latitude;
          const lng = coord.lng || coord.lon || coord.longitude;
          return [lat, lng];
        });
      } else {
        console.error("Invalid coordinate format in geometry array:", firstCoord);
        return null;
      }
    } 
    // GeoJSON format from OSRM
    else if (route.geometry.coordinates && Array.isArray(route.geometry.coordinates)) {
      console.log(`Using GeoJSON geometry format with ${route.geometry.coordinates.length} points`);
      
      // GeoJSON coordinates are [longitude, latitude]
      positions = route.geometry.coordinates.map(coord => {
        if (Array.isArray(coord) && coord.length >= 2) {
          return [coord[1], coord[0]]; // Convert [lng, lat] to [lat, lng]
        } else {
          console.error("Invalid coordinate in GeoJSON:", coord);
          return null;
        }
      }).filter(Boolean);
    } else {
      console.error("Unsupported geometry format:", route.geometry);
      return null;
    }
    
    if (positions.length === 0) {
      console.error("No valid coordinates in route geometry");
      return null;
    }
    
    console.log(`RoutePolyline: Rendering route with ${positions.length} points`);
    
    // Log the first few positions for debugging
    if (positions.length > 0) {
      console.log("First position:", positions[0]);
      if (positions.length > 1) {
        console.log("Last position:", positions[positions.length - 1]);
      }
    }
    
    // Use different styling for fallback routes
    const pathOptions = route.isFallback ? {
      color: "#FF6B6B",
      weight: 4,
      opacity: 0.8,
      dashArray: "5,10"  // Dashed line for fallback
    } : {
      color: "#2196F3",
      weight: 5,
      opacity: 0.7
    };
    
    return (
      <Polyline
        positions={positions}
        pathOptions={pathOptions}
      />
    );
  } catch (err) {
    console.error("Error processing route geometry:", err);
    console.error("Route data:", route);
    return null;
  }
}

// Utility function to geocode place names to coordinates with fallback mechanisms
const getCoordinates = async (placeName) => {
  try {
    // First check against our known accurate coordinates for important locations
    const knownLocations = {
      "kanjirappally": { lat: 9.5747, lng: 76.8376 },
      "kanjirappally, kerala": { lat: 9.5747, lng: 76.8376 },
      "thekkady": { lat: 9.5833, lng: 77.1667 },
      "thekkady, kerala": { lat: 9.5833, lng: 77.1667 },
      "kumily": { lat: 9.6028, lng: 77.1660 }, // Another name for Thekkady area
      "vagamon": { lat: 9.6867, lng: 76.9344 },
      "munnar": { lat: 10.0889, lng: 77.0595 },
      "alleppey": { lat: 9.4981, lng: 76.3388 },
      "alappuzha": { lat: 9.4981, lng: 76.3388 },
      "kottayam": { lat: 9.5916, lng: 76.5222 },
      "periyar": { lat: 9.5709, lng: 77.1333 }, // Periyar National Park near Thekkady
      "wayanad": { lat: 11.6854, lng: 76.1320 },
      "idukki": { lat: 9.9189, lng: 76.9726 },
      "kerala": { lat: 10.1632, lng: 76.6413 } // Center of Kerala
    };
    
    // Check if we have exact coordinates for this place
    const placeNameLower = placeName.toLowerCase();
    for (const [key, coords] of Object.entries(knownLocations)) {
      if (placeNameLower.includes(key)) {
        console.log(`Using known accurate coordinates for "${placeName}" (matched ${key}):`, coords);
        return coords;
      }
    }
    
    console.log("Geocoding attempt for:", placeName);
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    // Add region context if it's not already included
    const searchPlace = placeName.toLowerCase().includes('kerala') || 
                        placeName.toLowerCase().includes('india') ? 
                        placeName : `${placeName}, Kerala, India`;
    
    // Using backend geocoding service which tries multiple strategies including Gemini AI
    const response = await axios.get(`${baseUrl}/suggest/geocode`, {
      params: { place: searchPlace }
    });
    
    if (response.data && response.data.success && response.data.coordinates) {
      console.log(`Geocoding successful using ${response.data.source || 'backend service'}:`, response.data.coordinates);
      
      // Validate coordinates are within Kerala range
      const lat = response.data.coordinates.latitude;
      const lng = response.data.coordinates.longitude;
      
      // Check if coordinates make sense for Kerala region
      if (lat >= 8.0 && lat <= 13.0 && lng >= 74.0 && lng <= 78.0) {
      return {
          lat: lat,
          lng: lng
      };
      } else {
        console.warn("Geocoded coordinates outside Kerala range:", response.data.coordinates);
        throw new Error(`Invalid coordinates for ${placeName} - outside Kerala range`);
      }
    } else {
      console.error("Geocoding failed:", response.data);
      throw new Error(`No coordinates found for ${placeName}`);
    }
  } catch (err) {
    console.error(`Error geocoding "${placeName}":`, err);
    
    // Check one more time for known locations with different formatting
    const simplified = placeName.toLowerCase()
      .replace(/[,.]/g, '')
      .replace(/(kerala|india|kl)/g, '')
      .trim();
    
    const knownLocationsSimple = {
      "kanjirappally": { lat: 9.5747, lng: 76.8376 },
      "kanjira": { lat: 9.5747, lng: 76.8376 },
      "thekkady": { lat: 9.5833, lng: 77.1667 },
      "thekka": { lat: 9.5833, lng: 77.1667 },
      "kumily": { lat: 9.6028, lng: 77.1660 },
      "vagamon": { lat: 9.6867, lng: 76.9344 },
      "munnar": { lat: 10.0889, lng: 77.0595 },
      "alleppey": { lat: 9.4981, lng: 76.3388 },
      "alappuzha": { lat: 9.4981, lng: 76.3388 },
      "kottayam": { lat: 9.5916, lng: 76.5222 },
      "periyar": { lat: 9.5709, lng: 77.1333 },
    };
    
    for (const [key, coords] of Object.entries(knownLocationsSimple)) {
      if (simplified.includes(key)) {
        console.log(`Found known location "${key}" in simplified "${simplified}". Using its coordinates:`, coords);
        return coords;
      }
    }
    
    // Absolute emergency fallback for Kerala (when all API calls fail)
    if (placeName.toLowerCase().includes("kerala")) {
      console.warn("Using emergency default coordinates for Kerala");
      return {
        lat: 10.1632,  // Center of Kerala approximate
        lng: 76.6413
      };
    }
    
    // Last resort: if it contains Kanjirappally or Thekkady, use those coordinates
    if (placeName.toLowerCase().includes("kanjirappally") || 
        placeName.toLowerCase().includes("kanjira")) {
      return { lat: 9.5747, lng: 76.8376 };
    }
    
    if (placeName.toLowerCase().includes("thekkady") || 
        placeName.toLowerCase().includes("kumily") ||
        placeName.toLowerCase().includes("periyar")) {
      return { lat: 9.5833, lng: 77.1667 };
    }
    
    // If we get here, all attempts including backend strategies have failed
    throw new Error(`Failed to geocode "${placeName}" after all attempts`);
  }
};

// Function to extract proper route data from OSRM response
const processRouteResponse = (responseData) => {
  if (!responseData) {
    console.error("No response data provided to processRouteResponse");
    return null;
  }
  
  console.log("Raw response data:", JSON.stringify(responseData));
  
  // Case 1: Direct OSRM response format - the top level object itself is the route data
  if (responseData.code === "Ok" && responseData.routes && responseData.routes.length > 0) {
    console.log("Processing direct OSRM format - top level response");
    const osrmRoute = responseData.routes[0];
    
    // Extract key route information and standardize format
    const processedRoute = {
      distance: osrmRoute.distance || 0,
      timeTaken: osrmRoute.duration || 0,
    };
    
    // Handle potential geometry formats from OSRM
    if (osrmRoute.geometry) {
      if (typeof osrmRoute.geometry === 'string') {
        // Polyline encoded format - this would need decoding
        console.error("Polyline encoded geometry not supported");
        return null;
      } else if (osrmRoute.geometry.coordinates && Array.isArray(osrmRoute.geometry.coordinates)) {
        // GeoJSON format
        console.log("Using GeoJSON geometry format with", osrmRoute.geometry.coordinates.length, "points");
        processedRoute.geometry = osrmRoute.geometry.coordinates;
      } else if (Array.isArray(osrmRoute.geometry)) {
        // Direct array of coordinates
        console.log("Using array geometry format with", osrmRoute.geometry.length, "points");
        processedRoute.geometry = osrmRoute.geometry;
      }
    }
    
    // Check if we extracted valid geometry
    if (!processedRoute.geometry || processedRoute.geometry.length === 0) {
      console.error("Failed to extract valid geometry from OSRM response");
      return null;
    }
    
    return processedRoute;
  }
  
  // Case 2: Our backend success response with route object
  if (responseData.success && responseData.route) {
    console.log("Processing backend success response with route object");
    const routeData = responseData.route;
    
    // Check if the route object contains OSRM data directly
    if (routeData.code === "Ok" && routeData.routes && routeData.routes.length > 0) {
      console.log("Route object contains nested OSRM response");
      return processRouteResponse(routeData); // Process the nested OSRM response
    }
    
    // Check if route has valid geometry
    if (routeData.geometry) {
    // Handle GeoJSON format
      if (routeData.geometry.coordinates && Array.isArray(routeData.geometry.coordinates)) {
        console.log("Converting GeoJSON format with", routeData.geometry.coordinates.length, "points");
      return {
        ...routeData,
        geometry: routeData.geometry.coordinates
      };
    }
      
      // Handle array format directly
      if (Array.isArray(routeData.geometry)) {
        console.log("Using array geometry format with", routeData.geometry.length, "points");
    return routeData;
      }
    }
    
    console.error("Route data has unexpected geometry format:", routeData);
  }
  
  // Case 3: Success response with empty route - use nested route field if available
  if (responseData.success && responseData.route && Object.keys(responseData.route).length === 0) {
    console.log("Success response with empty route object, checking for nested data");
    
    // Check if the response itself contains OSRM data
    if (responseData.code === "Ok" && responseData.routes && responseData.routes.length > 0) {
      console.log("Found OSRM data at top level despite success flag");
      return processRouteResponse({ ...responseData, success: false }); // Process as OSRM data
    }
  }
  
  // If we reached here, we couldn't process the response
  console.error("Couldn't process route data, unsupported format:", responseData);
  return null;
};

// Helper function to verify and correct place coordinates
const verifyPlaceCoordinates = async (places) => {
  if (!places || !Array.isArray(places)) return places;
  
  console.log("Verifying coordinates for", places.length, "places");
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const correctedPlaces = [...places];
  
  for (let i = 0; i < correctedPlaces.length; i++) {
    const place = correctedPlaces[i];
    
    // Check if coordinates seem suspicious or potentially incorrect
    const isInvalidCoordinate = 
      !place.lat || !place.lng || 
      isNaN(place.lat) || isNaN(place.lng) ||
      // Check if coordinates are too close to zero (likely incorrect)
      (Math.abs(place.lat) < 0.1 && Math.abs(place.lng) < 0.1) ||
      // For Kerala, validate coordinates are in reasonable range
      (place.name.toLowerCase().includes("kerala") && 
       (place.lat < 8.0 || place.lat > 13.0 || 
        place.lng < 74.0 || place.lng > 78.0));
    
    if (isInvalidCoordinate) {
      try {
        console.log(`Coordinates for "${place.name}" appear invalid, attempting to fetch correct coordinates`);
        // Try to get better coordinates from backend service
        const response = await axios.get(`${baseUrl}/suggest/geocode`, {
          params: { place: place.name }
        });
        
        if (response.data && response.data.success && response.data.coordinates) {
          console.log(`Corrected coordinates for "${place.name}" using ${response.data.source}:`, response.data.coordinates);
          correctedPlaces[i] = {
            ...place,
            lat: response.data.coordinates.latitude,
            lng: response.data.coordinates.longitude
          };
        }
      } catch (error) {
        console.error(`Failed to correct coordinates for "${place.name}":`, error);
      }
    }
  }
  
  return correctedPlaces;
};

const PrebuiltRoute = () => {
  const navigate = useNavigate();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [tripData, setTripData] = useState(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [places, setPlaces] = useState([]);
  const [selectedPlaces, setSelectedPlaces] = useState([]);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hoveredPlace, setHoveredPlace] = useState(null);
  const [tripCost, setTripCost] = useState(null);
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [showNavOptions, setShowNavOptions] = useState(false);

  // Handle sign out functionality
  const handleSignOut = () => {
    localStorage.removeItem('userEmail');
    sessionStorage.clear();
    navigate('/');
  };

  // Load trip data
  const loadTripData = () => {
    try {
      const packageTripJson = sessionStorage.getItem('packageTrip');
      if (!packageTripJson) {
        console.error("No trip data found in session storage");
        setError("No trip data found. Please select a route first.");
        setLoading(false);
        return;
      }
      
      const packageTrip = JSON.parse(packageTripJson);
      console.log("Loaded package trip data:", packageTrip);
      
      if (!packageTrip.origin || !packageTrip.destination) {
        console.error("Trip data is missing origin or destination");
        setError("Trip data is incomplete. Please go back and select a route again.");
        setLoading(false);
        return;
      }
      
      // Set basic trip data
      setOrigin(packageTrip.origin);
      setDestination(packageTrip.destination);
      setTripData(packageTrip);
      
      // Handle coordinate validation - standardize key names
      const validateCoordinates = (coords) => {
        if (!coords) return false;
        
        // Check if coordinates exist and are valid numbers
        if (!coords.lat || !coords.lng || 
            typeof coords.lat !== 'number' && isNaN(parseFloat(coords.lat)) || 
            typeof coords.lng !== 'number' && isNaN(parseFloat(coords.lng))) return false;
        
        // Convert string coordinates to numbers if needed
        if (typeof coords.lat === 'string') coords.lat = parseFloat(coords.lat);
        if (typeof coords.lng === 'string') coords.lng = parseFloat(coords.lng);
        
        // Check if coordinates are in a reasonable range (not near 0,0 or otherwise suspicious)
        if (Math.abs(coords.lat) < 0.1 && Math.abs(coords.lng) < 0.1) return false;
        
        // For Kerala, India coordinates should be roughly in this range
        if (coords.lat < 8.0 || coords.lat > 13.0 || coords.lng < 74.0 || coords.lng > 78.0) {
          console.warn("Coordinates outside expected Kerala range:", coords);
          // Still return true if we're clearly not at 0,0 - may be a valid location outside Kerala
          return (Math.abs(coords.lat) > 1.0 && Math.abs(coords.lng) > 1.0);
        }
        
        return true;
      };
      
      // Check and standardize origin coordinates
      let originCoordsValid = false;
      if (packageTrip.originCoords && validateCoordinates(packageTrip.originCoords)) {
        console.log("Using origin coordinates from session storage:", packageTrip.originCoords);
        setOriginCoords(packageTrip.originCoords);
        originCoordsValid = true;
      } else {
        console.warn("Origin coordinates invalid or missing, will geocode:", packageTrip.originCoords);
      }
      
      // Check and standardize destination coordinates - handle both destCoords and destinationCoords
      let destCoordsValid = false;
      let destinationCoordsObject = null;
      
      // First try destinationCoords (travelpackage.jsx format)
      if (packageTrip.destinationCoords && validateCoordinates(packageTrip.destinationCoords)) {
        console.log("Using destinationCoords from session storage:", packageTrip.destinationCoords);
        destinationCoordsObject = packageTrip.destinationCoords;
        destCoordsValid = true;
      } 
      // Then try destCoords (smartvacay.jsx old format)
      else if (packageTrip.destCoords && validateCoordinates(packageTrip.destCoords)) {
        console.log("Using destCoords from session storage:", packageTrip.destCoords);
        destinationCoordsObject = packageTrip.destCoords;
        destCoordsValid = true;
      } else {
        console.warn("Destination coordinates invalid or missing, will geocode");
      }
      
      // Set destination coordinates if valid
      if (destCoordsValid) {
        setDestCoords(destinationCoordsObject);
      }
      
      // Geocode origin if needed
      if (!originCoordsValid) {
        // Geocode with explicit place name + region for better accuracy
        const originWithRegion = packageTrip.origin.toLowerCase().includes("kerala") ? 
          packageTrip.origin : `${packageTrip.origin}, Kerala, India`;
        
        console.log("Geocoding origin:", originWithRegion);
        getCoordinates(originWithRegion)
          .then(coords => {
            console.log("Origin coordinates obtained:", coords);
            if (coords && coords.lat && coords.lng) {
              setOriginCoords({ lat: coords.lat, lng: coords.lng });
            } else {
              console.error("Failed to geocode origin:", originWithRegion);
              // Set fallback coordinates for Kerala
              setOriginCoords({ lat: 10.8505, lng: 76.2711 });
            }
          })
          .catch(err => {
            console.error("Error geocoding origin:", err);
            // Set fallback coordinates for Kerala
            setOriginCoords({ lat: 10.8505, lng: 76.2711 });
          });
      }
      
      // Geocode destination if needed
      if (!destCoordsValid) {
        // Geocode with explicit place name + region for better accuracy
        const destinationWithRegion = packageTrip.destination.toLowerCase().includes("kerala") ? 
          packageTrip.destination : `${packageTrip.destination}, Kerala, India`;
        
        console.log("Geocoding destination:", destinationWithRegion);
        getCoordinates(destinationWithRegion)
          .then(coords => {
            console.log("Destination coordinates obtained:", coords);
            if (coords && coords.lat && coords.lng) {
              setDestCoords({ lat: coords.lat, lng: coords.lng });
            } else {
              console.error("Failed to geocode destination:", destinationWithRegion);
              // Set fallback coordinates for a different part of Kerala
              setDestCoords({ lat: 9.9312, lng: 76.2673 });
            }
          })
          .catch(err => {
            console.error("Error geocoding destination:", err);
            // Set fallback coordinates for a different part of Kerala
            setDestCoords({ lat: 9.9312, lng: 76.2673 });
          });
      }
      
    } catch (error) {
      console.error("Error loading trip data:", error);
      setError("Error loading trip data. Please try again.");
      setLoading(false);
    }
  };

  // Effect to fetch places once coordinates are available
  useEffect(() => {
    if (originCoords && destCoords) {
      console.log("Both coordinates available, fetching places along route");
      fetchPlacesAlongRoute(originCoords, destCoords);
    } else {
      console.log("Waiting for coordinates before fetching places");
    }
  }, [originCoords, destCoords]);

  // Fetch places along the route from origin to destination
  const fetchPlacesAlongRoute = async (origCoords, destCoords) => {
    setLoading(true);
    try {
      // Create a cache key based on origin and destination
      const cacheKey = `placesCache_${origin}_${destination}`;
      
      // Check if we have cached places for this route
      const cachedPlaces = sessionStorage.getItem(cacheKey);
      
      if (cachedPlaces) {
        console.log("Using cached places from sessionStorage");
        const parsedPlaces = JSON.parse(cachedPlaces);
        
        // Verify and correct stored coordinates against known locations
        const correctedPlaces = await verifyPlaceCoordinates(parsedPlaces);
        setPlaces(correctedPlaces);
        
        // We still need to initialize the route
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const routeResponse = await axios.post(`${baseUrl}/suggest/route`, {
          origin: {
            latitude: origCoords.lat,
            longitude: origCoords.lng
          },
          destination: {
            latitude: destCoords.lat,
            longitude: destCoords.lng
          },
          waypoints: [] // Empty waypoints array
        });
        
        console.log("Initial route response (using cached places):", routeResponse.data);
        
        if (routeResponse.data.success || routeResponse.data.code === "Ok") {
          const processedRoute = processRouteResponse(routeResponse.data);
          if (processedRoute) {
            console.log("Initial route processed successfully");
            setRoute(processedRoute);
          } else {
            console.error("Failed to process initial route");
          }
        }
        
        setLoading(false);
        return;
      }
      
      console.log("No cached places found, fetching from API");
      console.log("Fetching places along route with coordinates:", {
        origin: origin,
        destination: destination,
        originCoords: origCoords,
        destCoords: destCoords
      });
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.get(`${baseUrl}/travel/routePlaces`, {
        params: {
          origin: origin,
          destination: destination,
          originLat: origCoords.lat,
          originLng: origCoords.lng,
          destLat: destCoords.lat,
          destLng: destCoords.lng
        }
      });

      if (response.data.success && response.data.places) {
        console.log("Successfully fetched places along route:", response.data.places.length, "places");
        const placesData = response.data.places;
        
        if (placesData.length === 0) {
          setError("No places found along this route. Try another destination.");
        } else {
          // Verify and correct coordinates before caching
          const correctedPlaces = await verifyPlaceCoordinates(placesData);
          
          // Cache the corrected places in sessionStorage
          sessionStorage.setItem(cacheKey, JSON.stringify(correctedPlaces));
          console.log("Places cached in sessionStorage");
          
          setPlaces(correctedPlaces);
          // Initialize the direct route between origin and destination
          const routeResponse = await axios.post(`${baseUrl}/suggest/route`, {
            origin: {
              latitude: origCoords.lat,
              longitude: origCoords.lng
            },
            destination: {
              latitude: destCoords.lat,
              longitude: destCoords.lng
            },
            waypoints: [] // Empty waypoints array
          });
          
          console.log("Initial route response:", routeResponse.data);
          
          if (routeResponse.data.success || routeResponse.data.code === "Ok") {
            const processedRoute = processRouteResponse(routeResponse.data);
            if (processedRoute) {
              console.log("Initial route processed successfully");
              setRoute(processedRoute);
            } else {
              console.error("Failed to process initial route");
            }
          }
        }
      } else {
        console.error("API response didn't contain places:", response.data);
        setError("Failed to load places. Please try again.");
      }
    } catch (err) {
      console.error("Error fetching places along route:", err);
      setError("Failed to load places. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Toggle place selection
  const togglePlaceSelection = (place) => {
    setSelectedPlaces(prevSelected => {
      const isSelected = prevSelected.some(p => p.name === place.name);
      
      let updatedPlaces;
      if (isSelected) {
        updatedPlaces = prevSelected.filter(p => p.name !== place.name);
      } else {
        updatedPlaces = [...prevSelected, place];
      }
      
      // Store selected places in sessionStorage
      const selectedPlacesKey = `selectedPlaces_${origin}_${destination}`;
      sessionStorage.setItem(selectedPlacesKey, JSON.stringify(updatedPlaces));
      console.log("Selected places saved to sessionStorage");
      
      return updatedPlaces;
    });
  };

  // Add a useEffect to load selected places from sessionStorage when component initializes
  useEffect(() => {
    if (origin && destination) {
      const selectedPlacesKey = `selectedPlaces_${origin}_${destination}`;
      const savedSelectedPlaces = sessionStorage.getItem(selectedPlacesKey);
      
      if (savedSelectedPlaces) {
        try {
          const parsedPlaces = JSON.parse(savedSelectedPlaces);
          console.log("Restored selected places from sessionStorage:", parsedPlaces.length);
          setSelectedPlaces(parsedPlaces);
        } catch (error) {
          console.error("Error parsing saved selected places:", error);
        }
      }
    }
  }, [origin, destination]);

  // Get photo URL from photo reference or direct URL
  const getPhotoUrl = (place) => {
    if (!place) return fallbackImg;
    
    // Check if we have a direct image URL
    if (place.imageUrl) {
      return place.imageUrl;
    }
    
    // Check if we have a photo reference and API key
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (place.photoRef && apiKey) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photoRef}&key=${apiKey}`;
    }
    
    // Fallback image
    return fallbackImg;
  };

  // Update the route with waypoints
  const updateRouteWithWaypoints = async () => {
    try {
      if (!originCoords || !destCoords) {
        console.error("Missing origin or destination coordinates for route calculation");
        return;
      }

      // Validate coordinates to ensure they're in the correct format
      const validateCoord = (coord, label) => {
        if (!coord || typeof coord !== 'number' || isNaN(coord)) {
          console.error(`Invalid ${label} coordinate: ${coord} (${typeof coord})`);
          return false;
        }
        
        // Check if coordinates are suspiciously close to zero
        if (Math.abs(coord) < 0.01) {
          console.error(`${label} coordinate suspiciously close to zero: ${coord}`);
          return false;
        }
        
        // For Kerala, India coordinates should be roughly in this range
        if ((label.includes('lat') && (coord < 8.0 || coord > 13.0)) || 
            (label.includes('lng') && (coord < 74.0 || coord > 78.0))) {
          console.warn(`${label} coordinate outside expected Kerala range: ${coord}`);
          // Still return true if we're clearly not at 0,0 - may be a valid location outside Kerala
          return (Math.abs(coord) > 1.0);
        }
        
        return true;
      };
      
      // Validate all coordinates
      const isOriginValid = validateCoord(originCoords.lat, 'origin lat') && 
                           validateCoord(originCoords.lng, 'origin lng');
      const isDestValid = validateCoord(destCoords.lat, 'destination lat') && 
                         validateCoord(destCoords.lng, 'destination lng');
      
      if (!isOriginValid || !isDestValid) {
        console.error("Invalid coordinates for route calculation", { originCoords, destCoords });
        
        // Try fallback route if coordinates are invalid
        const fallbackRoute = createFallbackRoute(originCoords, destCoords);
        if (fallbackRoute) {
          console.log("Using fallback route due to invalid coordinates");
          setRoute(fallbackRoute);
        } else {
          setError("Invalid coordinates for route calculation");
        }
        return;
      }
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Log the exact coordinates being sent
      console.log("Route calculation with coordinates:", {
        origin: { name: origin, lat: originCoords.lat, lng: originCoords.lng },
        destination: { name: destination, lat: destCoords.lat, lng: destCoords.lng },
        selectedPlaces: selectedPlaces.length
      });
      
      // First, validate all selected places have valid coordinates
      const validPlaces = selectedPlaces.filter(place => {
        return validateCoord(place.lat, `place ${place.name} lat`) && 
               validateCoord(place.lng, `place ${place.name} lng`);
      });
      
      if (validPlaces.length < selectedPlaces.length) {
        console.warn(`Filtered out ${selectedPlaces.length - validPlaces.length} places with invalid coordinates`);
      }
      
      // Sort places by distance from origin for optimal routing
      const sortedPlaces = sortPlacesByDistanceFromOrigin(validPlaces, originCoords);
      console.log("Places sorted by distance from origin:", sortedPlaces.map(p => p.name));
      
      if (sortedPlaces.length === 0) {
        // If no valid places or no places selected, get direct route
        const routeRequestPayload = {
          origin: {
            latitude: originCoords.lat,
            longitude: originCoords.lng
          },
          destination: {
            latitude: destCoords.lat,
            longitude: destCoords.lng
          },
          waypoints: [] // Empty waypoints array
        };
        
        console.log("Direct route request payload:", JSON.stringify(routeRequestPayload));
        
        try {
          const response = await axios.post(`${baseUrl}/suggest/route`, routeRequestPayload);
          
          if (response.data && (response.data.success || response.data.code === "Ok")) {
            const processedRoute = processRouteResponse(response.data);
            if (processedRoute) {
              console.log("Direct route processed successfully");
              setRoute(processedRoute);
            } else {
              throw new Error("Failed to process direct route response");
            }
          } else {
            throw new Error("OSRM API returned error status");
          }
        } catch (routeError) {
          console.error("Error fetching direct route:", routeError);
          
          // Use fallback route if OSRM API fails
          const fallbackRoute = createFallbackRoute(originCoords, destCoords);
          console.log("Using fallback route due to OSRM API error");
          setRoute(fallbackRoute);
        }
      } else {
        // If we have valid places, create route with waypoints
        const waypoints = sortedPlaces.map(place => ({
          latitude: place.lat,
          longitude: place.lng
        }));
        
        const routeRequestPayload = {
          origin: {
            latitude: originCoords.lat,
            longitude: originCoords.lng
          },
          destination: {
            latitude: destCoords.lat,
            longitude: destCoords.lng
          },
          waypoints: waypoints
        };
        
        console.log(`Route request with ${waypoints.length} waypoints:`, JSON.stringify(routeRequestPayload));
        
        try {
          const response = await axios.post(`${baseUrl}/suggest/route`, routeRequestPayload);
          
          if (response.data && (response.data.success || response.data.code === "Ok")) {
            const processedRoute = processRouteResponse(response.data);
            if (processedRoute) {
              console.log("Route with waypoints processed successfully");
              setRoute(processedRoute);
            } else {
              throw new Error("Failed to process route with waypoints");
            }
          } else {
            throw new Error("OSRM API returned error status for waypoint route");
          }
        } catch (routeError) {
          console.error("Error fetching route with waypoints:", routeError);
          
          // Use fallback route if OSRM API fails
          console.log("Attempting to create curved fallback route");
          const fallbackRoute = createCurvedRoute(originCoords, destCoords, sortedPlaces);
          setRoute(fallbackRoute);
        }
      }
    } catch (error) {
      console.error("Unexpected error in updateRouteWithWaypoints:", error);
      setError("Failed to calculate route. Please try again later.");
    }
  };

  // Add curved fallback route function
  const createCurvedRoute = (originCoords, destCoords, waypoints) => {
    if (!originCoords || !destCoords) return null;
    
    console.log("Creating curved fallback route with waypoints");
    
    try {
      // Generate a route with smooth curves between points
      const points = [
        [originCoords.lng, originCoords.lat],
        ...waypoints.map(wp => [wp.lng, wp.lat]),
        [destCoords.lng, destCoords.lat]
      ];
      
      // Calculate total distance along the path
      let totalDistance = 0;
      for (let i = 0; i < points.length - 1; i++) {
        const [lng1, lat1] = points[i];
        const [lng2, lat2] = points[i + 1];
        totalDistance += calculateDistance(lat1, lng1, lat2, lng2);
      }
      
      // Estimate time based on distance (assuming 60 km/h average speed)
      const averageSpeedMps = 60 * 1000 / 3600; // 60 km/h in meters per second
      const estimatedTime = totalDistance / averageSpeedMps;
      
      console.log(`Curved fallback route created: ${(totalDistance/1000).toFixed(1)} km, ${(estimatedTime/60).toFixed(1)} minutes`);
      
      return {
        distance: totalDistance,
        timeTaken: estimatedTime,
        geometry: points,
        isFallback: true
      };
    } catch (error) {
      console.error("Error creating curved fallback route:", error);
      // Fall back to simple direct route
      return createFallbackRoute(originCoords, destCoords);
    }
  };

  // Create a fallback route as direct line between two points
  const createFallbackRoute = (originCoords, destCoords) => {
    if (!originCoords || !destCoords) return null;
    
    console.log("Creating fallback route between:", originCoords, destCoords);
    
    // Generate a straight line route (just origin and destination points)
    const directLine = [
      [originCoords.lng, originCoords.lat],
      [destCoords.lng, destCoords.lat]
    ];
    
    // Calculate approximate distance using haversine formula
    const distance = calculateDistance(
      originCoords.lat, 
      originCoords.lng, 
      destCoords.lat, 
      destCoords.lng
    );
    
    // Estimate time based on distance (assuming 60 km/h average speed)
    const averageSpeedMps = 60 * 1000 / 3600; // 60 km/h in meters per second
    const estimatedTime = distance / averageSpeedMps;
    
    console.log(`Fallback route created: ${(distance/1000).toFixed(1)} km, ${(estimatedTime/60).toFixed(1)} minutes`);
    
    return {
      distance: distance,
      timeTaken: estimatedTime,
      geometry: directLine,
      isFallback: true // Mark as fallback route for UI
    };
  };

  // Helper function to sort places by distance from origin
  function sortPlacesByDistanceFromOrigin(places, originCoords) {
    if (!places || !places.length || !originCoords) return places;
    
    // Calculate distances from origin
    const placesWithDistances = places.map(place => {
      const distance = calculateDistance(
        originCoords.lat, 
        originCoords.lng, 
        place.lat, 
        place.lng
      );
      return { ...place, distanceFromOrigin: distance };
    });
    
    // Sort by distance from origin
    return placesWithDistances
      .sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
  }

  // Helper function to calculate distance between two points
  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // distance in meters
  }

  // Add buildAppleMapsUrl function
  const buildAppleMapsUrl = () => {
    if (!tripData) return "";
    
    return `https://maps.apple.com/?saddr=${encodeURIComponent(
      origin
    )}&daddr=${encodeURIComponent(destination)}&dirflg=d`;
  };

  // Update navigateToGoogleMaps function to handle the option click
  const handleOptionClick = (url) => {
    console.log("Opening external navigation with URL:", url);
    window.open(url, '_blank');
    setShowNavOptions(false);
  };

  // Modify the navigate button click handler
  const handleNavigateClick = async () => {
    // When opening nav options, pre-generate URLs for debugging
    if (!showNavOptions) {
      console.log("Navigation options opened");
      console.log("Selected places:", selectedPlaces.map(p => p.name));
      
      // Fetch cost estimate if not already fetched
      if (!tripCost) {
        fetchTripCost();
      }
    }
    setShowNavOptions(!showNavOptions);
  };

  // Calculate total distance and time
  const getTripSummary = () => {
    if (!route) {
      console.log("No route available for trip summary");
      return { distance: "0.0", duration: "0.0" };
    }
    
    try {
      // Check if distance and timeTaken exist and are numbers
      const distance = typeof route.distance === 'number' ? route.distance : 
                      (route.routes && route.routes[0] && typeof route.routes[0].distance === 'number' ? 
                       route.routes[0].distance : NaN);
                       
      const timeTaken = typeof route.timeTaken === 'number' ? route.timeTaken : 
                       (route.routes && route.routes[0] && typeof route.routes[0].duration === 'number' ? 
                        route.routes[0].duration : NaN);
      
      // Handle potential NaN values
      if (isNaN(distance) || isNaN(timeTaken)) {
        console.error("Invalid distance or duration values in route:", { distance, timeTaken });
        return { distance: "0.0", duration: "0.0" };
      }
      
      const distanceKm = distance / 1000; // Convert to km
      const durationHours = timeTaken / 3600; // Convert to hours
      
      console.log(`Trip summary calculated: ${distanceKm.toFixed(1)} km, ${durationHours.toFixed(1)} hours`);
      
      return {
        distance: distanceKm.toFixed(1),
        duration: durationHours.toFixed(1)
      };
    } catch (err) {
      console.error("Error calculating trip summary:", err);
      return { distance: "0.0", duration: "0.0" };
    }
  };

  // Add function to fetch trip cost
  const fetchTripCost = async () => {
    if (!origin || !destination || !selectedPlaces.length) return;
    
    try {
      console.log("Fetching trip cost estimation");
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Create list of place names for the cost calculation
      const placeNames = selectedPlaces.map(place => place.name);
      
      // Default to 2 people if not specified in trip data
      const numPeople = tripData?.numPeople || 2;
      
      console.log("Fetching cost estimate for:", {
        origin, 
        destination, 
        places: placeNames, 
        numPeople
      });

      // Try using the getCost endpoint which matches the function in gemini.js
      const response = await fetch(`${baseUrl}/api/getCost`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          origin,
          destination,
          placesVisiting: placeNames,
          numPeople: numPeople
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch cost estimate: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Cost estimate received:", data);
      setTripCost(data);
      
    } catch (error) {
      console.error("Error fetching trip cost:", error);
      
      // Create fallback cost estimate based on route data if it exists
      if (route && route.distance) {
        console.log("Creating local fallback cost estimate based on distance");
        
        const distanceKm = route.distance / 1000;
        
        // Calculate approximate costs
        const fuelCost = Math.round(distanceKm * 8); // Approximate ₹8 per km
        const foodCost = Math.round((distanceKm / 100) * 500); // ₹500 per 100km
        const accommodationCost = Math.round((route.timeTaken / 3600 / 10) * 2000); // ₹2000 per 10 hours of travel
        const attractionsCost = Math.round(selectedPlaces.length * 200); // ₹200 per attraction
        
        const totalCost = fuelCost + foodCost + accommodationCost + attractionsCost;
        
        setTripCost({
          totalCost: `₹${totalCost}`,
          breakdown: {
            fuel: `₹${fuelCost}`,
            food: `₹${foodCost}`,
            accommodation: `₹${accommodationCost}`,
            attractions: `₹${attractionsCost}`
          },
          note: "Estimated locally based on distance and time"
        });
      } else {
        // Return a simple fallback if no route data
        setTripCost({ 
          totalCost: "Unable to estimate",
          error: true 
        });
      }
    }
  };

  // Call fetchTripCost when selected places change
  useEffect(() => {
    if (selectedPlaces.length > 0) {
      fetchTripCost();
    } else {
      setTripCost(null);
    }
  }, [selectedPlaces, origin, destination]);

  // Save route to user's profile
  const saveRoute = async () => {
    try {
      if (!selectedPlaces || selectedPlaces.length === 0) {
        alert("Please select at least one place to visit before saving the route.");
        return;
      }
      
      // Sort places by distance from origin for optimal routing
      const sortedPlaces = sortPlacesByDistanceFromOrigin(selectedPlaces, originCoords);
      console.log("Sorted places for saving:", sortedPlaces.map(p => p.name));
      
      const userEmail = localStorage.getItem("userEmail");
      if (!userEmail) {
        alert("You need to be logged in to save routes. Please log in and try again.");
        navigate("/login");
        return;
      }
      
      setSaveStatus("Saving...");
      
      // Generate route name based on origin, destination and date
      const date = new Date();
      const dateStr = `${date.getDate()}-${date.getMonth() + 1}-${date.getFullYear()}`;
      const routeName = `${origin} to ${destination} (${dateStr})`;
      
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Format request payload according to backend expectations
      const response = await axios.post(`${baseUrl}/saved/save`, {
        email: userEmail,
        id: "x", // "x" tells the backend this is a new route
        origin: origin,
        destination: destination,
        selectedPlaces: sortedPlaces.map(place => ({
          lat: place.lat,
          lng: place.lng,
          name: place.name
        }))
      });
      
      if (response.data.success) {
        setSaveStatus("Saved successfully!");
        alert("Your route has been saved successfully!");
        navigate("/saver");
      } else {
        throw new Error(response.data.message || "Unknown error saving route");
      }
    } catch (error) {
      console.error("Error saving route:", error);
      setSaveStatus("Error saving");
      alert(`Error saving route: ${error.message}`);
    }
  };

  // Update route when selected places change
  useEffect(() => {
    if (!originCoords || !destCoords) return;
    
    console.log("Updating route with waypoints:", 
      selectedPlaces.length > 0 ? selectedPlaces.map(p => p.name).join(", ") : "No waypoints");
    
    updateRouteWithWaypoints();
  }, [selectedPlaces, originCoords, destCoords, origin, destination]);

  // Add the buildGoogleMapsUrl function back
  const buildGoogleMapsUrl = () => {
    if (!tripData) return "";
    
    try {
      // Get the selected places
      const selectedWaypoints = selectedPlaces;
      
      // Sort places by distance from origin for optimal routing
      const sortedPlaces = sortPlacesByDistanceFromOrigin(selectedWaypoints, originCoords);
      console.log("Sorted waypoints for Google Maps:", sortedPlaces.map(p => p.name));
      
      // Build URL with origin and destination
      let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
      
      // Add waypoints if there are any selected places
      if (sortedPlaces.length > 0) {
        // Google Maps has a limit on the number of waypoints in the URL (generally 10)
        const limitedWaypoints = sortedPlaces.slice(0, 10);
        
        // Google Maps expects waypoints formatted as: &waypoints=lat,lng|lat,lng|lat,lng
        const formattedWaypoints = limitedWaypoints
          .map(p => {
            // Ensure lat/lng are valid numbers
            const lat = typeof p.lat === 'number' ? p.lat : parseFloat(p.lat);
            const lng = typeof p.lng === 'number' ? p.lng : parseFloat(p.lng);
            
            if (isNaN(lat) || isNaN(lng)) {
              console.warn(`Invalid coordinates for place: ${p.name}`, p);
              return null;
            }
            
            return `${lat.toFixed(6)},${lng.toFixed(6)}`;
          })
          .filter(Boolean) // Remove any null values
          .join('|');
        
        // Only add waypoints if we have valid ones
        if (formattedWaypoints) {
          url += `&waypoints=${encodeURIComponent(formattedWaypoints)}`;
          console.log("Added sorted waypoints to URL:", formattedWaypoints);
        }
      }
      
      return url;
    } catch (error) {
      console.error("Error building Google Maps URL:", error);
      
      // Fallback to basic URL without waypoints
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
    }
  };

  // Add useEffect to call loadTripData when component mounts
  useEffect(() => {
    loadTripData();
  }, []);

  // Render loading state
  if (loading) {
    return (
      <div className="prebuilt-container loading-container">
        <div className="loading-spinner">Loading your trip...</div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="prebuilt-container error-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={() => navigate('/packages')}>
          Go Back
        </button>
      </div>
    );
  }

  const tripSummary = getTripSummary();

  return (
    <div className="prebuilt-container">
      <div className="navbar">
        <div className="nav-left">
          <button className="back-button" onClick={() => navigate('/packages')}>
            <IoArrowBack /> Back
          </button>
          <h2>{origin} to {destination}</h2>
        </div>
        <div className="nav-right">
          <button className="home-button" onClick={() => navigate("/")}>
            <IoHome />
          </button>
          <div className="profile-icon" onClick={() => setShowDropdown(!showDropdown)}>
            <FaUser size={20} />
          </div>
          {showDropdown && (
            <div className="profile-dropdown">
              <a href="/profile">Profile</a>
              <a href="/saved">Saved Routes</a>
              <a href="/settings">Settings</a>
              <a href="/logout">Logout</a>
            </div>
          )}
        </div>
      </div>

      <div className="prebuilt-content">
        <div className="sidebar">
          <div className="trip-summary">
            <h3>Trip Summary</h3>
            <div className="trip-details">
              <div>Total Distance: {tripSummary.distance ? `${tripSummary.distance} km` : "Calculating..."}</div>
              <div>
                Estimated Duration: {tripSummary.duration ? `${Math.floor(parseFloat(tripSummary.duration))} hr ${Math.floor((parseFloat(tripSummary.duration) % 1) * 60)} min` : "Calculating..."}
              </div>
              {saveStatus && <div className="save-status">{saveStatus}</div>}
            </div>
            
            <div className="action-buttons">
              <button className="action-button" onClick={handleNavigateClick}>
                <FaRoute className="button-icon" /> Navigate
              </button>
              <button className="save-button" onClick={saveRoute}>
                <IoSave /> Save
              </button>
            </div>
          </div>

          <div className="places-list">
            <h3>Places to Visit</h3>
            <div className="places-container">
              {places.length > 0 ? (
                places.map((place, index) => (
                  <div 
                    key={index} 
                    className={`place-item ${selectedPlaces.some(p => p.name === place.name) ? 'selected' : ''}`}
                    onMouseEnter={() => setHoveredPlace(place)}
                    onMouseLeave={() => setHoveredPlace(null)}
                    onClick={() => togglePlaceSelection(place)}
                  >
                    <div className="place-checkbox">
                      <input 
                        type="checkbox" 
                        checked={selectedPlaces.some(p => p.name === place.name)}
                        onChange={() => togglePlaceSelection(place)}
                      />
                    </div>
                    <div className="place-info">
                      <h4>{place.name}</h4>
                      <p>{place.description || "Tourist attraction"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-places">
                  <p>No places found along this route.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="map-container">
          {originCoords && destCoords && (
            <MapContainer
              center={[
                (originCoords.lat + destCoords.lat) / 2,
                (originCoords.lng + destCoords.lng) / 2
              ]}
              zoom={10}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              <MapController 
                route={route} 
                originCoords={originCoords} 
                destCoords={destCoords} 
                selectedPlaces={selectedPlaces}
              />
              
              {/* Origin Marker */}
              <Marker 
                position={[originCoords.lat, originCoords.lng]} 
                icon={endpointIcon}
              >
                <Popup>Origin: {tripData?.origin}</Popup>
              </Marker>
              
              {/* Destination Marker */}
              <Marker 
                position={[destCoords.lat, destCoords.lng]} 
                icon={endpointIcon}
              >
                <Popup>Destination: {tripData?.destination}</Popup>
              </Marker>
              
              {/* Selected Places Markers */}
              {selectedPlaces.map((place, index) => (
                <Marker 
                  key={`selected-${index}`}
                  position={[place.lat, place.lng]} 
                  icon={waypointIcon}
                >
                  <Popup>{place.name}</Popup>
                </Marker>
              ))}
              
              {/* Hovered Place Marker */}
              {hoveredPlace && !selectedPlaces.some(p => p.name === hoveredPlace.name) && (
                <Marker 
                  position={[hoveredPlace.lat, hoveredPlace.lng]} 
                  icon={hoveredIcon}
                >
                  <Popup>{hoveredPlace.name}</Popup>
                </Marker>
              )}
              
              {/* Route Polyline */}
              {route && <RoutePolyline route={route} />}
            </MapContainer>
          )}
          
          {/* Hovered Place Info */}
          {hoveredPlace && (
            <div className="place-hover-info">
              <div className="hover-image">
                <img 
                  src={getPhotoUrl(hoveredPlace)} 
                  alt={hoveredPlace.name}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = fallbackImg;
                  }}
                />
              </div>
              <div className="hover-content">
                <h4>{hoveredPlace.name}</h4>
                <p>{hoveredPlace.description || "Tourist attraction"}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Box */}
      {showNavOptions && (
        <div className="navbox">
          <p className="navbox-title">Open in:</p>
          
          {/* Cost estimate section */}
          <div className="cost-estimate">
            <p>Approximate Cost</p>
            {tripCost ? (
              <div className="cost-value">
                {tripCost.totalCost || "Unable to estimate"}
                {tripCost.note && <p className="cost-note">{tripCost.note}</p>}
              </div>
            ) : (
              <p>Calculating...</p>
            )}
          </div>
          
          <div className="navbox-options">
            <button className="navbox-option" onClick={() => handleOptionClick(buildGoogleMapsUrl())}>
              Google Maps
            </button>
            <button className="navbox-option" onClick={() => handleOptionClick(buildAppleMapsUrl())}>
              Apple Maps
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrebuiltRoute;
