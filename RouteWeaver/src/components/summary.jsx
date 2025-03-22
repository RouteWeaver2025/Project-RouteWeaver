import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../design/summary.css";
import { FiRefreshCw } from 'react-icons/fi';
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

// Add a fallback icon with a different color
const fallbackIcon = new L.Icon({
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
        // Handle both array format and object format
        if (Array.isArray(coord)) {
          return [coord[0], coord[1]];
        } else if (coord.lat && coord.lng) {
          return [coord.lat, coord.lng];
        }
        return coord; // Already in correct format
      });
      
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
  
  return (
    <Polyline
      positions={routeGeometry}
      pathOptions={{
        color: "#2196F3",
        weight: 5,
        opacity: 1,
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
  
  // Authentication check
  useEffect(() => {
    const email = localStorage.getItem('email');
    if (!email) {
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
      setLoading(true);
      try {
        const email = localStorage.getItem('email');
        if (!email) {
          setError("You need to be logged in to view route details");
          setLoading(false);
          return;
        }
        
        console.log(`Fetching route ID: ${routeId} for user: ${email}`);
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        // Using try-catch here to handle potential axios failures
        try {
          const response = await axios.get(`${baseUrl}/saved/${email}/${routeId}`);
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
        
        setLoading(false);
      } catch (error) {
        console.error("Error in fetch routine:", error);
        setError("Failed to load route details. Please try again.");
        setLoading(false);
      }
    }
    
    if (routeId) {
      fetchRouteData();
    }
  }, [routeId]);
  
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
  
  // Fetch route geometry
  async function fetchRouteGeometry(origin, destination, places) {
    try {
      if (!origin || !destination) {
        console.warn("Missing origin or destination for route generation");
        setError("Origin or destination is missing");
        return;
      }
      
      // Get only checked places
      const checkedPlaces = places.filter(place => place.checked && place.name);
      console.log("Checked places for routing:", checkedPlaces);
      
      // Instead of sending coordinates, send place names that the backend will resolve
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      let url = new URL(`${baseUrl}/api/landmarks/routesByPlaceNames`);
      
      // Send text values rather than coordinates
      url.searchParams.set("origin", origin);
      url.searchParams.set("destination", destination);
      
      // Send place names as waypoints
      if (checkedPlaces.length > 0) {
        const waypointNames = checkedPlaces.map(place => place.name).join('|');
        url.searchParams.set("waypoints", waypointNames);
        // Also send the region for better geocoding
        url.searchParams.set("region", destination); // Use destination as region context
      }
      
      console.log("Fetching route URL:", url.toString());
      
      try {
        const response = await fetch(url.toString());
        
        if (response.ok) {
          const data = await response.json();
          processRouteData(data);
          
          // Also update the coordinates based on what the API returned
          if (data.waypoints && data.waypoints.length > 0) {
            // Update place coordinates based on the API result
            updatePlaceCoordinates(data.waypoints, checkedPlaces);
          }
          
          if (data.origin && data.origin.location) {
            setOriginCoords({
              lat: data.origin.location[1],
              lng: data.origin.location[0]
            });
          }
          
          if (data.destination && data.destination.location) {
            setDestCoords({
              lat: data.destination.location[1],
              lng: data.destination.location[0]
            });
          }
          
          return;
        } else {
          const errorText = await response.text();
          console.error(`API Error (${response.status}):`, errorText);
          
          // Fallback to using the original method with coordinates
          console.log("Falling back to original method with coordinates");
          await fallbackToCoordinateMethod(origin, destination, places);
        }
      } catch (error) {
        console.error("Network error fetching route:", error);
        await fallbackToCoordinateMethod(origin, destination, places);
      }
    } catch (error) {
      console.error("Error in fetchRouteGeometry:", error);
      setError("Failed to fetch route. Using approximate route.");
      createFallbackRoute();
    }
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
  
  // Create a fallback route when the API fails
  function createFallbackRoute() {
    console.log("Creating fallback route between origin and destination");
    
    if (!originCoords || !destCoords) {
      console.warn("Cannot create fallback route: missing coordinates. Attempting to use default values.");
      
      // If we still have origin/destination text but not coords, try to create approximate coords
      if (origin && destination) {
        // Try to set approximate coordinates based on known places in India
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
          "kochi": { lat: 9.9312, lng: 76.2673 }
        };
        
        // Try to match with known locations
        const originLower = origin.toLowerCase();
        const destLower = destination.toLowerCase();
        
        // Check for known cities in the addresses
        for (const [city, coords] of Object.entries(indiaCoords)) {
          if (originLower.includes(city) && !originCoords) {
            setOriginCoords(coords);
            console.log(`Set approximate origin coordinates for ${city}`);
          }
          if (destLower.includes(city) && !destCoords) {
            setDestCoords(coords);
            console.log(`Set approximate destination coordinates for ${city}`);
          }
        }
        
        // If still no coords, use center of India with some offset to show two points
        if (!originCoords) {
          setOriginCoords({ lat: 20.5937, lng: 78.9629 });
          console.log("Using default center of India for origin");
        }
        if (!destCoords) {
          setDestCoords({ lat: 21.5937, lng: 79.9629 }); // Slight offset
          console.log("Using default center of India (with offset) for destination");
        }
      } else {
        // If no origin/destination text, use center of India with offset
        setOriginCoords({ lat: 20.5937, lng: 78.9629 });
        setDestCoords({ lat: 21.5937, lng: 79.9629 }); // Slight offset
        console.log("Using default India coordinates due to missing origin/destination");
      }
    }
    
    // Double-check we have coordinates now
    const startLat = originCoords?.lat || 20.5937;
    const startLng = originCoords?.lng || 78.9629;
    const endLat = destCoords?.lat || 21.5937;
    const endLng = destCoords?.lng || 79.9629;
    
    // Create a more detailed route line with intermediate points
    const pointCount = 5; // Number of intermediate points
    const geometry = [];
    
    // Add start point
    geometry.push([startLat, startLng]);
    
    // Add intermediate points for a smoother line
    for (let i = 1; i < pointCount; i++) {
      const fraction = i / pointCount;
      const lat = startLat + (endLat - startLat) * fraction;
      const lng = startLng + (endLng - startLng) * fraction;
      geometry.push([lat, lng]);
    }
    
    // Add end point
    geometry.push([endLat, endLng]);
    
    console.log("Created fallback route with points:", geometry);
    
    // Estimate the distance using Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (endLat - startLat) * Math.PI / 180;
    const dLon = (endLng - startLng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(startLat * Math.PI / 180) * Math.cos(endLat * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    // Estimate time (assuming 60 km/h average speed)
    const time = distance / 60 * 60 * 60; // time in seconds
    
    setRoute({
      geometry,
      time: time,
      distance: distance * 1000 // convert to meters for consistency
    });
    
    setLoading(false);
    setError(null);
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
  
  // Toggle place selection
  function togglePlace(index) {
    setPlaces(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], checked: !updated[index].checked };
      return updated;
    });
  }
  
  // Handle navigate button click
  const handleNavigateClick = () => {
    setShowNavOptions(!showNavOptions);
  };

  const handleNavOptionSelect = (option) => {
    // Handle navigation option selection
    console.log(`Selected navigation option: ${option}`);
    
    // First check if we have valid coordinates
    if (!originCoords || !destCoords) {
      console.error("Missing coordinates for navigation");
      alert("Cannot navigate: missing location coordinates. Please try again later.");
      return;
    }
    
    try {
      let checkedPlaces = places.filter(place => place.checked);
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
          
        case 'waze':
          // Waze only supports navigating to one destination
          navUrl = `https://waze.com/ul?ll=${destCoords.lat},${destCoords.lng}&navigate=yes`;
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
  
  const submitCheckedPlaces = async () => {
    try {
      setLoading(true);
      const checkedPlaces = places.filter(place => place.checked);
      
      // Construct the route data to update
      const updatedRouteData = {
        email: localStorage.getItem('email'),
        routeId: routeId,
        origin: origin,
        destination: destination,
        places: checkedPlaces
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
        throw new Error('Failed to update route');
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
      setError('Failed to update the route. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="summary-container">
      <div className="top-bar">
        <button id="name" onClick={() => navigate("/home")}>RouteWeaver</button>
        <button className="reload-button" onClick={handleBack} aria-label="Back to saved routes">
          <FiRefreshCw size={20} />
        </button>
      </div>
      
      <div className="content-container">
        {loading ? (
          <>
            <div className="sidebar">
              <div className="route-header">
                <h3>Route Summary</h3>
              </div>
              <div className="loading-message">
                <p>Loading route data...</p>
              </div>
            </div>
            <div className="map-area">
              {/* Fallback map while loading */}
              <MapContainer
                center={[20.5937, 78.9629]} // India center
                zoom={4}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
              </MapContainer>
            </div>
          </>
        ) : (
          <>
            <div className="sidebar">
              <div className="route-header">
                <h3>Route Summary</h3>
              </div>
              
              {/* Always show route info section, even if there's an error */}
              <div className="route-info">
                <div className="origin-dest-item start-point">
                  <span>From: {origin || "Unknown Origin"}</span>
                </div>
                <div className="origin-dest-item end-point">
                  <span>To: {destination || "Unknown Destination"}</span>
                </div>
                {route && (
                  <div className="route-details">
                    <span>Time: {route.time ? (route.time / 60).toFixed(1) + ' min' : 'Calculating...'}</span>
                    <span>Distance: {route.distance ? (route.distance / 1000).toFixed(1) + ' km' : 'Calculating...'}</span>
                  </div>
                )}
              </div>
              
              {/* Show error message if any */}
              {error && (
                <div className="error-message">
                  <p>{error}</p>
                </div>
              )}
              
              {/* Places section */}
              <div className="places-header">
                <h4>Places to Visit</h4>
                <span>{places.filter(place => place.checked).length}/{places.length} selected</span>
              </div>
              
              <div className="place-list">
                {places.length === 0 ? (
                  <p>No waypoints for this route.</p>
                ) : (
                  <>
                    <div className="origin-dest-item">
                      <span className="start-point">Start: {origin || "Unknown Origin"}</span>
                    </div>
                    
                    {places.map((place, index) => (
                      <div
                        key={index}
                        className="place-item"
                        onMouseEnter={() => setHoveredPlace(place)}
                        onMouseLeave={() => setHoveredPlace(null)}
                      >
                        <div className="place-name">{place.name || `Waypoint ${index + 1}`}</div>
                        <input
                          type="checkbox"
                          checked={place.checked}
                          onChange={() => togglePlace(index)}
                        />
                      </div>
                    ))}
                    
                    <div className="origin-dest-item">
                      <span className="end-point">End: {destination || "Unknown Destination"}</span>
                    </div>
                  </>
                )}
              </div>
              
              {/* Always show action buttons */}
              <div className="bottom-buttons">
                <button id="navigate-btn" onClick={handleNavigateClick}>Navigate</button>
                <button id="submit-btn" onClick={submitCheckedPlaces}>Submit</button>
              </div>

              {showNavOptions && (
                <div className="nav-options">
                  <button onClick={() => handleNavOptionSelect('google')}>Google Maps</button>
                  <button onClick={() => handleNavOptionSelect('waze')}>Waze</button>
                  <button onClick={() => handleNavOptionSelect('apple')}>Apple Maps</button>
                </div>
              )}
            </div>
            
            <div className="map-area">
              {/* Always show the map */}
              <MapContainer
                center={originCoords ? [originCoords.lat, originCoords.lng] : [20.5937, 78.9629]}
                zoom={originCoords ? 7 : 4}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {/* Route line - only show if we have route data */}
                {route && route.geometry && route.geometry.length > 1 && (
                  <RoutePolylines routeGeometry={route.geometry} />
                )}
                
                {/* Origin marker */}
                {originCoords && (
                  <Marker position={[originCoords.lat, originCoords.lng]} icon={originIcon}>
                    <Popup>Origin: {origin}</Popup>
                  </Marker>
                )}
                
                {/* Destination marker */}
                {destCoords && (
                  <Marker position={[destCoords.lat, destCoords.lng]} icon={destinationIcon}>
                    <Popup>Destination: {destination}</Popup>
                  </Marker>
                )}

                {/* If we have origin and destination markers but no route, create a simple line */}
                {originCoords && destCoords && (!route || !route.geometry || route.geometry.length < 2) && (
                  <Polyline
                    positions={[
                      [originCoords.lat, originCoords.lng],
                      [destCoords.lat, destCoords.lng]
                    ]}
                    pathOptions={{
                      color: "#2196F3",
                      weight: 5,
                      opacity: 0.7,
                      dashArray: "10, 10" // Dashed line to indicate it's an approximation
                    }}
                  />
                )}
                
                {/* Place markers - only for checked places with valid coordinates */}
                {places.filter(p => p.checked && (p.lat || p.latitude) && (p.lng || p.longitude)).map((place, idx) => {
                  // Get coordinates using either format
                  const lat = place.lat || place.latitude;
                  const lng = place.lng || place.longitude;
                  
                  // Skip if coordinates are missing
                  if (!lat || !lng) return null;
                  
                  // Choose icon based on whether this is a fallback location
                  const icon = place.isFallback ? fallbackIcon : placeIcon;
                  
                  return (
                    <Marker 
                      key={`place-marker-${idx}`}
                      position={[lat, lng]} 
                      icon={icon}
                    >
                      <Popup>
                        <div>
                          <strong>{place.name || `Waypoint ${idx + 1}`}</strong>
                          {place.isFallback && (
                            <div style={{ color: 'orange', marginTop: '5px' }}>
                              Approximate location
                            </div>
                          )}
                          {place.formattedAddress && place.formattedAddress !== place.name && (
                            <div style={{ fontSize: '0.9em', marginTop: '5px' }}>
                              {place.formattedAddress}
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
              
              {/* Hover box for place details */}
              {hoveredPlace && (
                <div className="hoverbox">
                  <div className="hoverbox-info">
                    <p className="hoverbox-name">{hoveredPlace.name || "Waypoint"}</p>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}