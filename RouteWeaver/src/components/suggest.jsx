import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../design/suggest.css";
import fallbackImg from "../assets/homeimg.jpg";
import { FiRefreshCw, FiSearch } from 'react-icons/fi';
import { FaUserCircle } from 'react-icons/fa';
import { FaArrowLeft } from 'react-icons/fa';
import axios from 'axios';

// --------------------- GEOCODING ---------------------
const coordinatesCache = new Map();
async function getCoordinates(address) {
  try {
    if (coordinatesCache.has(address)) return coordinatesCache.get(address);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (!data || data.length === 0) throw new Error("No coordinates found");
    const coords = { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    coordinatesCache.set(address, coords);
    return coords;
  } catch (err) {
    console.error("Error fetching coordinates:", err);
    return null;
  }
}

// --------------------- GET PLACES USING GEMINI API ---------------------
async function getGeminiPlaces(origin, destination, keyword) {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    const response = await axios.post(`${baseUrl}/suggest/suggestions`, {
      origin,
      destination,
      keyword
    });
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Failed to get place suggestions');
    }
    
    // Process places to match the expected format
    const set1 = response.data.places.set1.map(place => ({
      id: `gemini-${place.name.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`,
      name: place.name,
      lat: place.coordinates.latitude,
      lon: place.coordinates.longitude,
      rating: "N/A", // Gemini doesn't provide ratings
      types: [], // Gemini doesn't provide types
      vicinity: place.description,
      photoRef: null, // We'll use imageUrl directly instead
      imageUrl: place.imageUrl,
      checked: false // Initialize as unchecked
    }));
    
    const set2 = response.data.places.set2.map(place => ({
      id: `gemini-${place.name.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).substr(2, 5)}`,
          name: place.name,
      lat: place.coordinates.latitude,
      lon: place.coordinates.longitude,
      rating: "N/A", // Gemini doesn't provide ratings
      types: [], // Gemini doesn't provide types
      vicinity: place.description,
      photoRef: null, // We'll use imageUrl directly instead
      imageUrl: place.imageUrl,
      checked: false // Initialize as unchecked
    }));
    
    return [...set1, ...set2];
  } catch (error) {
    console.error('Error fetching Gemini places:', error);
    return [];
  }
}

// --------------------- GET ROUTE USING OSRM API ---------------------
async function getOSRMRoute(origin, destination, waypoints = []) {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    
    const response = await axios.post(`${baseUrl}/suggest/route`, {
      origin: {
        latitude: origin.lat,
        longitude: origin.lon
      },
      destination: {
        latitude: destination.lat,
        longitude: destination.lon
      },
      waypoints: waypoints.map(wp => ({
        latitude: wp.lat,
        longitude: wp.lon
      }))
    });
    
    if (!response.data || !response.data.success) {
      throw new Error(response.data?.error || 'Failed to get route');
    }
    
    const route = response.data.route;
    
    // Calculate total route length
    let totalDistance = 0;
    for (let i = 0; i < route.geometry.length - 1; i++) {
      totalDistance += calculateDistance(
        route.geometry[i][1],
        route.geometry[i][0],
        route.geometry[i+1][1],
        route.geometry[i+1][0]
      );
    }
    
    console.log(`Total route distance: ${(totalDistance/1000).toFixed(1)}km`);
    
    // Process OSRM response to match expected format
    if (route && route.routes && route.routes.length > 0) {
      const routeData = route.routes[0];
      
      return {
        distance: routeData.distance,
        timeTaken: routeData.duration,
        geometry: routeData.geometry.coordinates,
        legs: routeData.legs || [],
        name: 'OSRM Route'
      };
    }
    
    throw new Error('No route found in OSRM response');
  } catch (error) {
    console.error("Error in findPositionAlongRoute:", error);
    return 0.5; // Default to middle
  }
}

// Distribute points evenly along the route (binning approach)
function distributePointsEvenly(places, maxPlaces) {
  // If we don't have enough places, return all of them
  if (places.length <= maxPlaces) return places;
  
  // If we have no places at all, return empty array
  if (places.length === 0) return [];
  
  console.log(`Distributing ${places.length} places into bins...`);
  
  // Sort places by position along route
  places.sort((a, b) => a.position - b.position);
  
  // Create bins along the route
  const numBins = Math.min(maxPlaces, 15);
  const result = [];
  
  for (let i = 0; i < numBins; i++) {
    // Define bin range
    const binStart = i / numBins;
    const binEnd = (i + 1) / numBins;
    
    // Find places in this bin
    const placesInBin = places.filter(p => 
      p.position >= binStart && p.position < binEnd
    );
    
    console.log(`Bin ${i+1}/${numBins} (${binStart.toFixed(2)}-${binEnd.toFixed(2)}): ${placesInBin.length} places`);
    
    if (placesInBin.length > 0) {
      // Sort by rating and distance to route
      placesInBin.sort((a, b) => {
        const ratingA = typeof a.rating === 'number' ? a.rating : 0;
        const ratingB = typeof b.rating === 'number' ? b.rating : 0;
        const ratingDiff = ratingB - ratingA;
        
        // Add a small random factor (between -0.5 and 0.5) to ensure variety
        const randomFactor = Math.random() - 0.5;
        
        // Prioritize rating unless the distance difference is significant
        if (Math.abs(ratingDiff) > 1) return ratingDiff + randomFactor;
        
        // Otherwise use distance to route with a random component
        return a.distanceToRoute - b.distanceToRoute + randomFactor * 1000; // Scale the random factor
      });
      
      // Take best place from this bin
      result.push(placesInBin[0]);
    }
  }
  
  // Safety check - if no places were selected from bins but we had input places
  // just return some of the original places to avoid returning nothing
  if (result.length === 0 && places.length > 0) {
    console.log("No places selected from bins - using original places");
    // Return a few of the original places sorted by rating
    const backupPlaces = [...places].sort((a, b) => {
      const ratingA = typeof a.rating === 'number' ? a.rating : 0;
      const ratingB = typeof b.rating === 'number' ? b.rating : 0;
      return ratingB - ratingA;
    }).slice(0, 5);
    return backupPlaces;
  }
  
  console.log(`Selected ${result.length} distributed places from ${places.length} total`);
  return result;
}

// Helper function to calculate minimum distance from a point to a route
function minDistanceToRoute(lat, lon, routeGeometry) {
  try {
    if (!routeGeometry || routeGeometry.length < 2) {
      return 20000; // Default large distance for invalid route
    }
    
    let minDistance = Infinity;
    
    for (let i = 0; i < routeGeometry.length - 1; i++) {
      const segmentStart = routeGeometry[i];
      const segmentEnd = routeGeometry[i + 1];
      
      const distance = distanceToLineSegment(
        lat, lon,
        segmentStart[1], segmentStart[0], // Route points are [lon, lat]
        segmentEnd[1], segmentEnd[0]
      );
      
      minDistance = Math.min(minDistance, distance);
    }
    
    return minDistance;
  } catch (error) {
    console.error("Error in minDistanceToRoute:", error);
    return 20000; // Default large distance
  }
}

// Calculate distance from point to line segment
function distanceToLineSegment(px, py, x1, y1, x2, y2) {
  try {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;
  
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    
    if (len_sq !== 0) param = dot / len_sq;
  
    let xx, yy;
  
    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;

    } else {
      throw new Error('No route found in OSRM response');
    }
  } catch (error) {
    console.error('Error fetching OSRM route:', error);
    throw error;
  }
}

// --------------------- Helper Functions ---------------------
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Haversine formula for calculating distances between coordinates
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // distance in meters
}

// --------------------- Custom Icon for Hovered Place Marker ---------------------
const hoveredIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// --------------------- Default Icon ---------------------
const defaultIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
  shadowSize: [41, 41]
});

// --------------------- BASE ROUTES VIA BACKEND (Google Maps API) ---------------------
// Fetch multiple routes (time/distance info from Google Maps API) from your backend.
async function fetchBaseRoutes(origin, destination) {
  try {
    // Format coordinates properly, ensuring no extra spaces
    const originStr = `${origin.lat.toFixed(7)},${origin.lon.toFixed(7)}`;
    const destStr = `${destination.lat.toFixed(7)},${destination.lon.toFixed(7)}`;
    
  const url = new URL("http://localhost:5000/api/landmarks/routes");
    url.searchParams.set("origin", originStr);
    url.searchParams.set("destination", destStr);
    
    console.log("Fetching routes with coordinates:", {
      origin: originStr,
      destination: destStr
    });

  const resp = await fetch(url.toString());
  const data = await resp.json();

    if (!resp.ok) {
      console.error("Route fetch error:", data);
      throw new Error(data.error || `Failed to fetch routes: ${resp.status}`);
    }

    if (!data.routes || !Array.isArray(data.routes)) {
      console.error("Invalid routes response:", data);
      throw new Error("No routes found in response");
    }

    return data.routes.map(route => ({
      ...route,
      timeTaken: route.timeTaken || route.duration?.text,
      timeValue: route.timeValue || route.duration?.value,
      distance: route.distance,
      distanceValue: route.distanceValue || route.distance?.value,
      geometry: route.geometry,
      places: route.places || []
    }));
  } catch (error) {
    console.error("Error fetching base routes:", error);
    throw error;
  }
}

// --------------------- VIA ROUTE WITH PLACES VIA BACKEND ---------------------
// Fetch a single route (with via points) from the backend (using Google Maps API) 
// that returns time/distance info and OSRM geometry.
async function fetchRouteWithPlaces(origin, destination, selectedPlaces) {
  try {
  const url = new URL("http://localhost:5000/api/landmarks/routesWithPlaces");
  url.searchParams.set("origin", `${origin.lat},${origin.lon}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lon}`);
    
    if (selectedPlaces.length > 0) {
  const waypoints = selectedPlaces
        .map(p => `${p.location?.lat || p.lat},${p.location?.lng || p.lon}`)
    .join("|");
  url.searchParams.set("waypoints", waypoints);
    }

  console.log("Fetching via route from backend:", url.toString());
  const resp = await fetch(url.toString());
    if (!resp.ok) {
      const errorData = await resp.json();
      throw new Error(errorData.error || `Backend via route error: ${resp.status}`);
    }
  const data = await resp.json();
    return {
      ...data.route,
      timeTaken: data.route.timeTaken || data.route.duration?.text,
      distance: data.route.distance,
      geometry: data.route.geometry
    };
  } catch (error) {
    console.error("Error fetching route with places:", error);
    throw error;
  }
}

// --------------------- OSRM Map Utilities (for displaying route geometry) ---------------------
function RoutePolylines({ routes, selectedIndex }) {
  const map = useMap();
  
  // Effect to fit the map to the route bounds when routes change
  useEffect(() => {
    if (!routes || routes.length === 0) return;
    
    try {
      // Get all coordinates from all routes to calculate bounds
      const allCoords = routes.flatMap(r => r?.geometry || []);
      if (allCoords.length === 0) {
        console.warn("No coordinates found in routes");
        return;
      }
      
      console.log(`Fitting map to ${allCoords.length} coordinates`);
      
      // Convert coordinates to Leaflet format and create bounds
      const latLngs = allCoords.map(([lon, lat]) => [lat, lon]);
      const bounds = L.latLngBounds(latLngs);
      
      // Fit the map to the bounds with padding
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (error) {
      console.error("Error fitting map to bounds:", error);
    }
  }, [routes, map]);
  
  // If no routes, don't render anything
  if (!routes || routes.length === 0) return null;
  
  return routes.map((route, idx) => {
    if (!route?.geometry || !Array.isArray(route.geometry) || route.geometry.length < 2) {
      console.warn(`Route ${idx} has invalid geometry`);
      return null;
    }
    
    const isSelected = idx === selectedIndex;
    const latlngs = route.geometry.map(([lon, lat]) => [lat, lon]);
    
    return (
      <Polyline
        key={idx}
        positions={latlngs}
        pathOptions={{
          color: isSelected ? "#2196F3" : "#9E9E9E",
          weight: isSelected ? 5 : 3,
          opacity: isSelected ? 1 : 0.7,
        }}
      />
    );
  });
}

// --------------------- MAIN COMPONENT ---------------------
export default function SuggestPage() {
  const navigate = useNavigate();
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  // Places from Gemini API
  const [places, setPlaces] = useState([]);
  // The route displayed on the map (initially direct route, then updated with waypoints)
  const [currentRoute, setCurrentRoute] = useState(null);
  // UI states
  const [hoveredPlace, setHoveredPlace] = useState(null);
  const [showNavOptions, setShowNavOptions] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(true);
  const [isLoadingRoute, setIsLoadingRoute] = useState(true);
  const [baseRoutes, setBaseRoutes] = useState([]);
  const [selectedBaseIndex, setSelectedBaseIndex] = useState(null);
  const [viaRoute, setViaRoute] = useState(null);
  const [costEstimate, setCostEstimate] = useState(null);
  const [isFetchingCost, setIsFetchingCost] = useState(false);

  // Handle sign out functionality
  const handleSignOut = () => {
    // Remove user data from localStorage and sessionStorage
    localStorage.removeItem('userEmail');
    sessionStorage.clear();
    // Navigate to login page
    navigate('/');
  };

  // Scrolling effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Read origin, destination, keywords from sessionStorage
  const originStr = sessionStorage.getItem("location") || "Kochi, Kerala";
  const destinationStr = sessionStorage.getItem("destination") || "Thiruvananthapuram, Kerala";

  const selectedKeywords = useMemo(() => {
    const raw = sessionStorage.getItem("selectedKeywords");
    if (!raw) {
      // Default tourist keywords if none provided
      return [
        'tourist_attraction',
        'natural_feature',
        'museum',
        'historic_site',
        'landmark',
        'park',
        'point_of_interest'
      ];
    }
    try {
      const parsed = JSON.parse(raw);
      return parsed.length > 0 ? parsed : [
        'tourist_attraction',
        'natural_feature',
        'museum',
        'historic_site',
        'landmark',
        'park',
        'point_of_interest'
      ];
    } catch {
      return [
        'tourist_attraction',
        'natural_feature',
        'museum',
        'historic_site',
        'landmark',
        'park',
        'point_of_interest'
      ];
    }
  }, []);

  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  
  // Check if user is logged in
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      console.log("User not logged in, redirecting to login page");
      navigate("/");
    }
  }, [navigate]);

  // 1) On mount, fetch coordinates
  useEffect(() => {
    (async () => {
      try {
        const oC = await getCoordinates(originStr);
        const dC = await getCoordinates(destinationStr);
        setOriginCoords(oC);
        setDestCoords(dC);
      } catch (err) {
        console.error("Error fetching coords:", err);
      }
    })();
  }, [originStr, destinationStr]);

  // 2) Once coordinates are available, fetch the direct route
  useEffect(() => {
    if (!originCoords || !destCoords) return;

    let isMounted = true;

    async function fetchInitialRoute() {
      if (!isMounted) return;
      
      setIsLoadingRoute(true);
      setIsLoadingRoutes(true);
      
      try {
        // Get direct route between origin and destination
        const route = await getOSRMRoute(originCoords, destCoords);
        if (isMounted) {
          setCurrentRoute(route);
          
          // Fetch base routes
          const routes = await fetchBaseRoutes(originCoords, destCoords);
          setBaseRoutes(routes);
          setSelectedBaseIndex(null);
          setPlaces([]);
          setViaRoute(null);
          setFetchedForIndex(null);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error in fetchInitialRoute:", err);
        }
      } finally {
        if (isMounted) {
          setIsLoadingRoute(false);
          setIsLoadingRoutes(false);
        }
      }
    }

    fetchInitialRoute();

    return () => {
      isMounted = false;
    };
  }, [originCoords, destCoords]);

  // 3) When a base route is selected, fetch places for that route's geometry.
  const [fetchedForIndex, setFetchedForIndex] = useState(null);
  useEffect(() => {
    if (selectedBaseIndex === null || selectedBaseIndex >= baseRoutes.length) return;
    if (fetchedForIndex === selectedBaseIndex) return; // already fetched for this route
    const chosen = baseRoutes[selectedBaseIndex];
    if (!chosen || !chosen.geometry) return;
    
    const fetchPlaces = async () => {
      setLoadingPlaces(true);
      try {
        const geminiPlaces = await getGeminiPlaces(originStr, destinationStr, selectedKeywords);
        setPlaces(geminiPlaces);
        setFetchedForIndex(selectedBaseIndex);
      } catch (err) {
        console.error("Error fetching places:", err);
      } finally {
        setLoadingPlaces(false);
      }
    };
    
    fetchPlaces();
  }, [selectedBaseIndex, baseRoutes, originStr, destinationStr, selectedKeywords, fetchedForIndex]);

  // 3) When places are toggled, update the route
  useEffect(() => {
    async function updateRouteWithSelectedPlaces() {
      if (!originCoords || !destCoords) return;
      
      const selectedPlaces = places.filter(p => p.checked);
      
      if (selectedPlaces.length === 0) {
        // If no places selected, get the direct route
        try {
          const directRoute = await getOSRMRoute(originCoords, destCoords);
          setCurrentRoute(directRoute);
        } catch (err) {
          console.error("Error fetching direct route:", err);
        }
      } else {
        // If places are selected, get route with waypoints
        try {
          // Sort places by distance from origin for more efficient routing
          const sortedPlaces = sortPlacesByDistanceFromOrigin(selectedPlaces, originCoords);
          console.log("Places sorted by distance from origin:", sortedPlaces.map(p => p.name));
          
          const routeWithWaypoints = await getOSRMRoute(
            originCoords, 
            destCoords, 
            sortedPlaces
          );
          setCurrentRoute(routeWithWaypoints);
        } catch (err) {
          console.error("Error fetching route with waypoints:", err);
        }
      }
    }
    
    updateRouteWithSelectedPlaces();
  }, [places, originCoords, destCoords]);

  // Helper function to sort places by distance from origin
  function sortPlacesByDistanceFromOrigin(places, originCoords) {
    if (!places || !places.length || !originCoords) return places;
    
    // Calculate distances from origin
    const placesWithDistances = places.map(place => {
      const distance = calculateDistance(
        originCoords.lat, 
        originCoords.lon, 
        place.lat, 
        place.lon
      );
      return { ...place, distanceFromOrigin: distance };
    });
    
    // Sort places by distance from origin
    placesWithDistances.sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin);
    
    return placesWithDistances;
  }

  // Handler for selecting a base route (phase 1 -> phase 2)
  function handleBaseRouteSelect(idx) {
    console.log(`Selecting route ${idx}`);
    // Prevent selecting the same route again
    if (idx === selectedBaseIndex) return;
    
    // Update selected route index first
    setSelectedBaseIndex(idx);
    // Clear existing places
    setPlaces([]);
    // Clear existing via route
    setViaRoute(null);
    // Reset fetch tracker to force fetching places
    setFetchedForIndex(null);
    // Show loading state for places
    setLoadingPlaces(true);
    
    console.log(`Route ${idx} selected, fetchedForIndex reset to null`);
  }

  // Toggle a place's checkbox.
  function handlePlaceToggle(index) {
    setPlaces(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], checked: !updated[index].checked };
      return updated;
    });
  }

  // Reload button: re-fetch places for the current route.
  function handleReload() {
    // Don't reset selectedBaseIndex, keep the same route
    setPlaces([]);
    setViaRoute(null);
    setFetchedForIndex(null); // This will trigger the useEffect to fetch places again
  }

  // Build URL for Google Maps navigation
  function buildGoogleMapsUrl() {
    try {
      // Default URL without waypoints
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
      originStr
    )}&destination=${encodeURIComponent(destinationStr)}&travelmode=driving`;
      
      // Get checked places
    const selected = places.filter(p => p.checked);
      
    if (selected.length > 0) {
        // Google Maps has a limit on the number of waypoints in the URL (generally 10)
        // We'll take the first 10 checkboxed places
        const limitedWaypoints = selected.slice(0, 10);
        console.log("Selected waypoints for navigation:", limitedWaypoints.map(p => p.name));
        
        // Google Maps expects waypoints formatted as: &waypoints=lat,lng|lat,lng|lat,lng
        const formattedWaypoints = limitedWaypoints
          .map(p => {
            // Ensure lat/lon are valid numbers and properly formatted
            const lat = typeof p.lat === 'number' ? p.lat : parseFloat(p.lat);
            const lon = typeof p.lon === 'number' ? p.lon : parseFloat(p.lon);
            
            if (isNaN(lat) || isNaN(lon)) {
              console.warn(`Invalid coordinates for place: ${p.name}`, p);
              return null;
            }
            
            return `${lat.toFixed(6)},${lon.toFixed(6)}`;
          })
          .filter(Boolean) // Remove any null values
          .join('|');
        
        // Only add waypoints if we have valid ones
        if (formattedWaypoints) {
          url += `&waypoints=${encodeURIComponent(formattedWaypoints)}`;
          console.log("Added waypoints to URL:", formattedWaypoints);
        }
      }
      
      console.log("Final Google Maps URL:", url);
      return url;
    } catch (error) {
      console.error("Error building Google Maps URL:", error);
      // Fallback to basic URL without waypoints
      return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(
        originStr
      )}&destination=${encodeURIComponent(destinationStr)}&travelmode=driving`;
    }
  }

  function buildAppleMapsUrl() {
    return `https://maps.apple.com/?saddr=${encodeURIComponent(
      originStr
    )}&daddr=${encodeURIComponent(destinationStr)}&dirflg=d`;
  }

  const handleNavigateClick = async () => {
    // When opening nav options, pre-generate URLs for debugging
    if (!showNavOptions) {
      console.log("Navigation options opened");
      console.log("Selected places:", places.filter(p => p.checked).map(p => p.name));
      
      // Fetch cost estimate if not already fetched
      if (!costEstimate && !isFetchingCost) {
        setIsFetchingCost(true);
        
        try {
          const selectedPlaces = places.filter(p => p.checked);
          const costData = await fetchTravelCost(
            originStr, 
            destinationStr,
            selectedPlaces,
            2 // Default to 2 people
          );
          
          setCostEstimate(costData);
        } catch (error) {
          console.error("Error fetching cost estimate:", error);
        } finally {
          setIsFetchingCost(false);
        }
      }
    }
    setShowNavOptions(!showNavOptions);
  };
  
  function handleSubmit() {
    try {
      const selectedPlaces = places.filter(p => p.checked);
      console.log("Submitting selected places:", selectedPlaces.map(p => p.name));
      
      // Get user email with correct key
      const userEmail = localStorage.getItem("userEmail") || sessionStorage.getItem("userEmail");
      
      if (!userEmail) {
        alert("You need to be logged in to save routes. Please log in and try again.");
        navigate("/login");
        return;
      }

      if (selectedPlaces.length === 0) {
        alert("Please select at least one place to visit before saving the route.");
        return;
      }
      
      // Save route to backend
      setIsSubmitting(true);
      
      // Format request EXACTLY as the backend expects in saveroute.js
      fetch('http://localhost:5000/saved/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail,
          id: "x", // "x" tells the backend this is a new route
          origin: originStr,
          destination: destinationStr,
          selectedPlaces: selectedPlaces.map(place => ({
            lat: place.lat,
            lng: place.lon,
            name: place.name
          }))
        })
      })
      .then(response => {
        // Log the full response for debugging
        console.log('Full response:', response);
        
        // Check response status and content type
        if (!response.ok) {
          return response.text().then(errorText => {
            console.error('Error response text:', errorText);
            throw new Error(`Server responded with ${response.status}: ${errorText}`);
          });
        }
        
        // Try to parse JSON
        return response.json();
      })
      .then(data => {
        console.log("Route saved successfully:", data);
        setIsSubmitting(false);
        
        // Show success message
        alert("Your route has been saved successfully!");
        
        // Navigate to saved routes page
        navigate("/saver");
      })
      .catch(error => {
        console.error("Detailed error saving route:", {
          message: error.message,
          stack: error.stack,
          userEmail: userEmail,
          originStr: originStr,
          destinationStr: destinationStr,
          selectedPlacesCount: selectedPlaces.length
        });
        
        setIsSubmitting(false);
        alert(`There was an error saving your route: ${error.message}`);
      });
    } catch (error) {
      console.error("Unexpected error in submit handler:", {
        message: error.message,
        stack: error.stack
      });
      alert("There was an unexpected error submitting your selection. Please try again.");
    }
  }

  function handleOptionClick(url) {
    console.log("Opening external navigation with URL:", url);
    window.open(url, "_blank");
    setShowNavOptions(false);
  }

  // Updated Back button handler that always navigates to queries page
  const handleBackButtonClick = () => {
    navigate('/queries');
  };

  // Helper function to get place image URL
  function getPlaceImageUrl(place) {
    if (place.imageUrl) return place.imageUrl;
    if (place.photoRef) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photoRef}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;
    }
    return fallbackImg;
  }

  // Helper function to fetch travel cost
  async function fetchTravelCost(origin, destination, places, numPeople) {
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await axios.post(`${baseUrl}/travel/cost`, {
        origin,
        destination,
        places: places.map(p => p.name),
        numPeople
      });
      
      return response.data;
    } catch (error) {
      console.error("Error fetching travel cost:", error);
      return { error: "Failed to estimate cost", totalCost: "Unknown" };
    }
  }

  return (
    <div className="suggest-container">
      <nav className="navbar">
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
      </nav>
      <div className="main-content">
        <div className="sidebar">
          <button className="back-button" onClick={handleBackButtonClick}>
            <FaArrowLeft className="back-icon" /> Back
          </button>
          <div className="route-info">
            <h2>
              {selectedBaseIndex !== null && baseRoutes[selectedBaseIndex] 
                ? `Chosen route: ${baseRoutes[selectedBaseIndex]?.timeTaken || "0 min"} | ${baseRoutes[selectedBaseIndex]?.distance || "0 km"}` 
                : `${originStr} to ${destinationStr}`
              }
            </h2>
          </div>
          <div className="place-header-container">
            <h3>{selectedBaseIndex === null ? "Available Routes" : "Places to Visit"}</h3>
            {selectedBaseIndex !== null && (
              <button className="reload-button" onClick={handleReload} aria-label="Reload places">
                <FiRefreshCw size={20} />
              </button>
            )}
          </div>
          <div className="place-list">
          {selectedBaseIndex === null ? (
            <>
              {/* Phase 1: Multi-route view */}
              <div className="routes">
                <div className="route-list">
                  {isLoadingRoutes ? (
                    <div className="loading-placeholder">
                      <span>Loading available routes...</span>
                    </div>
                  ) : baseRoutes.length === 0 ? (
                    <div className="loading-placeholder">
                      <span>No routes found</span>
                    </div>
                  ) : (
                    baseRoutes.map((r, i) => (
                      <button
                        key={i}
                        className={`route-item ${selectedBaseIndex === i ? 'selected' : ''}`}
                        onClick={() => handleBaseRouteSelect(i)}
                      >
                        <span className="route-number">{["1️⃣","2️⃣","3️⃣","4️⃣"][i]}</span>
                        <span className="route-time">{r.timeTaken}</span>
                        <span className="route-distance">{r.distance}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Phase 2: Single route with via waypoints */}
              <div className="routes">
                <button 
                  className="back-to-routes" 
                  onClick={() => {
                    setSelectedBaseIndex(null);
                    setPlaces([]);
                    console.log("Going back to route selection");
                  }}
                >
                  ← Back to route selection
                </button>
                <hr />
              </div>
              <div className="places">
                <div className="place-list">
                  {loadingPlaces ? (
                    <div className="loading-placeholder">
                      <span>Loading places...</span>
                    </div>
                  ) : places.length === 0 ? (
                    <div className="loading-placeholder">
                      <span>No places found</span>
                    </div>
                  ) : (
                    places.map((p, i) => (
                        <div
                        key={i}
                        className="place-item"
                        onMouseEnter={() => setHoveredPlace(p)}
                        onMouseLeave={() => setHoveredPlace(null)}
                      >
                          <div className="place-name">{p.name}</div>
                        <input
                          type="checkbox"
                          checked={p.checked}
                          onChange={() => handlePlaceToggle(i)}
                        />
                        </div>
                    ))
                  )}
                </div>
              </div>
                <div className="bottom-buttons">
                  <button id="navigate-btn" onClick={handleNavigateClick}>Navigate</button>
                  <button id="submit-btn" onClick={handleSubmit}>Submit</button>
                </div>
            </>
          )}
          </div>
        </div>
        <div className="map-area">
          {originCoords && destCoords && (
            currentRoute ? (
              <MapContainer
                center={[originCoords.lat, originCoords.lon]}
                zoom={7}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {currentRoute && (
                  <RoutePolylines routes={[currentRoute]} selectedIndex={0} />
                )}
                {originCoords && <Marker position={[originCoords.lat, originCoords.lon]} />}
                {destCoords && <Marker position={[destCoords.lat, destCoords.lon]} />}
                {hoveredPlace && (
                  <Marker position={[hoveredPlace.lat, hoveredPlace.lon]} icon={hoveredIcon} />
                )}
              </MapContainer>
            ) : (
              <MapContainer
                center={[originCoords.lat, originCoords.lon]}
                zoom={7}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {viaRoute ? (
                  <RoutePolylines routes={[viaRoute]} selectedIndex={0} />
                ) : baseRoutes[selectedBaseIndex] ? (
                  <RoutePolylines routes={[baseRoutes[selectedBaseIndex]]} selectedIndex={0} />
                ) : null}
                <Marker position={[originCoords.lat, originCoords.lon]} />
                {destCoords && <Marker position={[destCoords.lat, destCoords.lon]} />}
                {places.filter(p => p.checked).map((place, idx) => (
                  <Marker 
                    key={`place-marker-${idx}`}
                    position={[place.lat, place.lon]} 
                    icon={hoveredIcon}
                  />
                ))}
                {hoveredPlace && !places.find(p => p.id === hoveredPlace.id && p.checked) && (
                  <Marker position={[hoveredPlace.lat, hoveredPlace.lon]} icon={hoveredIcon} />
                )}
              </MapContainer>
            )
          )}
          {hoveredPlace && (
            <div className="hoverbox">
              <div className="hoverbox-image-container">
                <img
                  src={getPlaceImageUrl(hoveredPlace)}
                  alt={hoveredPlace.name}
                  onError={e => { e.currentTarget.src = fallbackImg; }}
                />
              </div>
              <div className="hoverbox-info">
                <p className="hoverbox-name">{hoveredPlace.name}</p>
                <p className="hoverbox-meta">
                  {hoveredPlace.vicinity || hoveredPlace.description || ""}
                </p>
              </div>
            </div>
          )}
          {showNavOptions && (
    <div className="navbox">
      <p className="navbox-title">Open in:</p>
      
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
      </div>
    </div>
  );
}

// Navigation Box Component
function NavBox({ buildGoogleMapsUrl, buildAppleMapsUrl, handleOptionClick }) {
  // Pre-generate URLs for better performance and debugging
  const googleMapsUrl = buildGoogleMapsUrl();
  const appleMapsUrl = buildAppleMapsUrl();
  
  return (
    <div className="navbox">
      <p className="navbox-title">Open in:</p>
      <div className="navbox-options">
        <button className="navbox-option" onClick={() => handleOptionClick(googleMapsUrl)}>
          Google Maps
        </button>
        <button className="navbox-option" onClick={() => handleOptionClick(appleMapsUrl)}>
          Apple Maps
        </button>
      </div>
    </div>
  );
}
