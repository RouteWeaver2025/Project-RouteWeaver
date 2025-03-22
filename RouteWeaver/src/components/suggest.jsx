import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, useMap, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../design/suggest.css";
import fallbackImg from "../assets/homeimg.jpg";
import { FiRefreshCw } from 'react-icons/fi';

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

// --------------------- PLACES ALONG ROUTE ---------------------
async function getPlacesAlongRoute(geometry, keywords = []) {
  try {
    // Ensure we have a valid geometry
    if (!geometry || geometry.length < 2) {
      console.warn("Invalid route geometry for place fetching");
      return [];
    }
    
    // Calculate total route length
    let totalDistance = 0;
    for (let i = 0; i < geometry.length - 1; i++) {
      totalDistance += calculateDistance(
        geometry[i][1], geometry[i][0],
        geometry[i+1][1], geometry[i+1][0]
      );
    }
    
    console.log(`Total route distance: ${(totalDistance/1000).toFixed(1)}km`);
    
    // Adjust sampling strategy based on route length
    // For longer routes, sample more points and space them more evenly
    const routeLengthKm = totalDistance / 1000;
    
    // Get strategic points along the route - start, middle segments, and end
    // For longer routes, sample more points
    const numSamplePoints = routeLengthKm > 250 ? 7 : 
                           routeLengthKm > 150 ? 5 : 
                           routeLengthKm > 50 ? 4 : 3;
    
    console.log(`Using ${numSamplePoints} sampling points for ${routeLengthKm.toFixed(1)}km route`);
    
    // Create evenly distributed points along the route
    const sampledPoints = [];
    
    // Calculate segment length
    const segmentLength = (geometry.length - 1) / (numSamplePoints - 1);
    
    // Sample points at even intervals
    for (let i = 0; i < numSamplePoints; i++) {
      // Calculate index
      const index = Math.min(Math.round(i * segmentLength), geometry.length - 1);
      sampledPoints.push(geometry[index]);
    }
    
    console.log(`Sampling ${sampledPoints.length} evenly spaced points along the route`);
    
    // Add delay between requests to avoid rate limiting
    const placesPromises = sampledPoints.map(async ([lon, lat], index) => {
      // Add a small delay between requests
      if (index > 0) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      try {
        console.log(`Fetching places at point ${index + 1}/${sampledPoints.length}: [${lat}, ${lon}]`);
        const response = await fetch(`http://localhost:5000/api/landmarks/places?lat=${lat}&lng=${lon}&keywords=${keywords.join(',')}`);
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
          photoRef: place.photos?.[0]?.photo_reference
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
    
    // Calculate distance to route for each place
    places = places.map(place => {
      try {
        const distanceToRoute = minDistanceToRoute(place.lat, place.lon, geometry);
        const position = findPositionAlongRoute(place.lat, place.lon, geometry);
        return { 
          ...place, 
          distanceToRoute: isNaN(distanceToRoute) ? 20000 : distanceToRoute,
          position: isNaN(position) ? 0.5 : position 
        };
      } catch (error) {
        console.error("Error calculating place metrics:", error);
        // Default values if calculation fails
        return { ...place, distanceToRoute: 20000, position: 0.5 };
      }
    });
    
    // Remove places that are too far from the route (more than 20km)
    const nearbyPlaces = places.filter(place => place.distanceToRoute < 20000);
    console.log(`Filtered to ${nearbyPlaces.length} places within 20km of route`);
    
    // Use the bin distribution approach to ensure even coverage
    const distributedPlaces = distributePointsEvenly(nearbyPlaces, 15);
    
    console.log(`Final list: ${distributedPlaces.length} unique places distributed along the route`);
    return distributedPlaces;
  } catch (error) {
    console.error('Error fetching places along route:', error);
    // Return empty array on error
    return [];
  }
}

// Find approximate position along route (0-1)
function findPositionAlongRoute(lat, lon, routeGeometry) {
  try {
    if (!routeGeometry || routeGeometry.length < 2) {
      return 0.5; // Default to middle if route is invalid
    }
    
    let minDist = Infinity;
    let closestPointIndex = 0;
    
    // Find closest point on route
    for (let i = 0; i < routeGeometry.length; i++) {
      const routeLat = routeGeometry[i][1]; // Route points are [lon, lat]
      const routeLon = routeGeometry[i][0];
      
      const dist = calculateDistance(lat, lon, routeLat, routeLon);
      
      if (dist < minDist) {
        minDist = dist;
        closestPointIndex = i;
      }
    }
    
    // Return position as percentage along route
    return closestPointIndex / Math.max(1, routeGeometry.length - 1);
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
        
        // Prioritize rating unless the distance difference is significant
        if (Math.abs(ratingDiff) > 1) return ratingDiff;
        
        // Otherwise use distance to route
        return a.distanceToRoute - b.distanceToRoute;
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
      xx = x1 + param * C;
      yy = y1 + param * D;
    }
  
    // Convert to meters using haversine
    return calculateDistance(px, py, xx, yy);
  } catch (error) {
    console.error("Error in distanceToLineSegment:", error);
    return Infinity;
  }
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
  // Handle different input formats (coordinate pairs or separate arguments)
  if (Array.isArray(lat1)) {
    // Format: calculateDistance([lat1, lon1], [lat2, lon2])
    lon2 = lat2[1];
    lat2 = lat2[0];
    lon1 = lat1[1];
    lat1 = lat1[0];
  }
  
  // Convert to numbers if they're strings
  lat1 = parseFloat(lat1);
  lon1 = parseFloat(lon1);
  lat2 = parseFloat(lat2);
  lon2 = parseFloat(lon2);
  
  // Validate coordinates
  if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.warn("Invalid coordinates in distance calculation:", { lat1, lon1, lat2, lon2 });
    return Infinity;
  }
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180; // lat1 in radians
  const φ2 = lat2 * Math.PI / 180; // lat2 in radians
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

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

// --------------------- Custom Icon for Hovered Place Marker ---------------------
const hoveredIcon = L.icon({
  iconUrl: "/src/assets/marker.png",
  iconSize: [60, 60],
  iconAnchor: [30, 60],
});

// --------------------- MAIN COMPONENT ---------------------
export default function SuggestPage() {
  const navigate = useNavigate();
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  // Base routes from backend (multi-route view)
  const [baseRoutes, setBaseRoutes] = useState([]);
  // When a base route is selected, we fetch places and then recalc viaRoute (single route)
  const [selectedBaseIndex, setSelectedBaseIndex] = useState(null);
  // POIs available from the selected base route (rendered as checkboxes)
  const [places, setPlaces] = useState([]);
  // The via route built from selected (checked) places
  const [viaRoute, setViaRoute] = useState(null);
  // UI states
  const [hoveredPlace, setHoveredPlace] = useState(null);
  const [showNavOptions, setShowNavOptions] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Read origin, destination, keywords from sessionStorage
  const originStr = sessionStorage.getItem("location") || "Kochi, Kerala";
  const destinationStr = sessionStorage.getItem("destination") || "Thiruvananthapuram, Kerala";
  const selectedKeywords = useMemo(() => {
    const raw = sessionStorage.getItem("selectedKeywords");
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, []);

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

  // 2) Once coordinates are available, fetch base routes (using Google Maps API from backend)
  useEffect(() => {
    if (!originCoords || !destCoords) return;
    (async () => {
      try {
        const routes = await fetchBaseRoutes(originCoords, destCoords);
        setBaseRoutes(routes);
      } catch (err) {
        console.error("Error fetching base routes:", err);
      }
    })();
  }, [originCoords, destCoords]);

  // 3) When a base route is selected, fetch places for that route's geometry.
  const [fetchedForIndex, setFetchedForIndex] = useState(null);
  useEffect(() => {
    if (selectedBaseIndex === null || selectedBaseIndex >= baseRoutes.length) return;
    if (fetchedForIndex === selectedBaseIndex) return; // already fetched for this route
    const chosen = baseRoutes[selectedBaseIndex];
    if (!chosen || !chosen.geometry) return;
    (async () => {
      setLoadingPlaces(true);
      try {
        const foundPlaces = await getPlacesAlongRoute(chosen.geometry, selectedKeywords);
        // Set each fetched place to unchecked by default
        const placesWithCheck = foundPlaces.map(p => ({ ...p, checked: false }));
        setPlaces(placesWithCheck);
        setFetchedForIndex(selectedBaseIndex);
      } catch (err) {
        console.error("Error fetching places:", err);
      } finally {
        setLoadingPlaces(false);
      }
    })();
  }, [selectedBaseIndex, baseRoutes, selectedKeywords, fetchedForIndex]);

  // 4) When the user toggles place checkboxes, recalc the final route (via route).
  useEffect(() => {
    async function updateRoute() {
      if (!originCoords || !destCoords) return;
      if (selectedBaseIndex === null || selectedBaseIndex >= baseRoutes.length) return;
      const chosen = baseRoutes[selectedBaseIndex];
      if (!chosen) return;
      const selectedPlaces = places.filter(p => p.checked);
      if (selectedPlaces.length === 0) {
        setViaRoute({
          timeTaken: chosen.timeTaken,
          distance: chosen.distance,
          geometry: chosen.geometry
        });
      } else {
        try {
          const single = await fetchRouteWithPlaces(originCoords, destCoords, selectedPlaces);
          setViaRoute(single);
        } catch (err) {
          console.error("Error fetching route with places:", err);
          setViaRoute(null);
        }
      }
    }
    updateRoute();
  }, [originCoords, destCoords, baseRoutes, selectedBaseIndex, places]);

  // Handler for selecting a base route (phase 1 -> phase 2)
  function handleBaseRouteSelect(idx) {
    setSelectedBaseIndex(idx);
    setPlaces([]);
    setViaRoute(null);
    setFetchedForIndex(null);
  }

  // Toggle a place's checkbox.
  function handlePlaceToggle(index) {
    setPlaces(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], checked: !updated[index].checked };
      return updated;
    });
  }

  // Reload button: revert to multi‑route view.
  function handleReload() {
    setSelectedBaseIndex(null);
    setPlaces([]);
    setViaRoute(null);
    setFetchedForIndex(null);
  }

  // Navigation options: Build external map URLs including waypoints from checked places.
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
  function buildWazeUrl() {
    if (destCoords)
      return `https://waze.com/ul?ll=${destCoords.lat},${destCoords.lon}&navigate=yes`;
    return "https://waze.com";
  }
  const handleNavigateClick = () => {
    // When opening nav options, pre-generate URLs for debugging
    if (!showNavOptions) {
      console.log("Navigation options opened");
      console.log("Selected places:", places.filter(p => p.checked).map(p => p.name));
    }
    setShowNavOptions(!showNavOptions);
  };
  
  function handleSubmit() {
    try {
      const selectedPlaces = places.filter(p => p.checked);
      console.log("Submitting selected places:", selectedPlaces.map(p => p.name));
      
      // Debug session storage contents
      console.log("Session storage contents:", Object.entries(sessionStorage));
      
      // Get user email with correct check for 'email' in sessionStorage
      const userEmail = localStorage.getItem("email") || 
                       sessionStorage.getItem("email") || 
                       localStorage.getItem("userEmail") || 
                       sessionStorage.getItem("userEmail");
      
      if (!userEmail) {
        alert("You need to be logged in to save routes. Please log in and try again.");
        navigate("/login");
        return;
      }
      
      // Save route to backend
      setIsSubmitting(true);
      
      fetch('http://localhost:5000/saved/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userEmail,
          id: "x", // For new route
          origin: originStr,
          destination: destinationStr,
          selectedPlaces: selectedPlaces.map(place => ({
            lat: place.lat,
            lng: place.lng,
            name: place.name
          }))
        })
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        console.log("Route saved successfully:", data);
        setIsSubmitting(false);
        
        // Show success message
        alert("Your route has been saved successfully!");
        
        // Navigate to saved routes page with correct path
        navigate("/saver");
      })
      .catch(error => {
        console.error("Error saving route:", error);
        setIsSubmitting(false);
        alert("There was an error saving your route. Please try again.");
      });
    } catch (error) {
      console.error("Error in submit handler:", error);
      alert("There was an error submitting your selection. Please try again.");
    }
  }

  function handleOptionClick(url) {
    console.log("Opening external navigation with URL:", url);
    window.open(url, "_blank");
  }

  return (
    <div className="suggest-container">
      <div className="top-bar">
        <button id="name" onClick={() => navigate("/home")}>RouteWeaver</button>
        {selectedBaseIndex !== null && (
          <button className="reload-button" onClick={handleReload} aria-label="Reload routes">
            <FiRefreshCw size={20} />
          </button>
        )}
      </div>
      <div className="main-content">
        <div className="sidebar">
          <div className="route-info">
            <h2>Chosen route: {selectedBaseIndex !== null && baseRoutes[selectedBaseIndex] ? 
              `${baseRoutes[selectedBaseIndex]?.timeTaken || "0 min"} | ${baseRoutes[selectedBaseIndex]?.distance || "0 km"}` 
              : baseRoutes[0] ? `${baseRoutes[0]?.timeTaken || "0 min"} | ${baseRoutes[0]?.distance || "0 km"}` : "0 min | 0 km"}</h2>
          </div>
          <h3>Places to Visit</h3>
          <div className="place-list">
            {selectedBaseIndex === null ? (
              <>
                {/* Phase 1: Multi-route view */}
                <div className="routes">
                  <div className="route-header">{originStr} to {destinationStr}</div>
                  <div className="route-list">
                    {baseRoutes.length === 0 ? (
                      <div className="loading-placeholder">
                        <span>No routes found or still fetching</span>
                      </div>
                    ) : (
                      baseRoutes.map((r, i) => (
                        <button
                          key={i}
                          className="route-item"
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
                <hr />
                <div className="places">
                  <div className="place-header">Places to Visit</div>
                  <div className="place-list">
                    <div className="loading-placeholder">
                      <span>Select a route to see places</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Phase 2: Single route with via waypoints */}
                <div className="routes">
                  <div className="route-header">
                    <p>
                      <strong>Chosen route:</strong>{" "}
                      {baseRoutes[selectedBaseIndex]?.timeTaken} |{" "}
                      {baseRoutes[selectedBaseIndex]?.distance}
                    </p>
                  </div>
                </div>
                <hr />
                <div className="places">
                  <div className="place-header">
                    {loadingPlaces ? "Fetching places..." : "Places to Visit"}
                  </div>
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
            selectedBaseIndex === null ? (
              // Phase 1: Multi-route view (baseRoutes)
              <MapContainer
                center={[originCoords.lat, originCoords.lon]}
                zoom={7}
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RoutePolylines routes={baseRoutes} selectedIndex={0} />
                {originCoords && <Marker position={[originCoords.lat, originCoords.lon]} />}
                {destCoords && <Marker position={[destCoords.lat, destCoords.lon]} />}
                {hoveredPlace && (
                  <Marker position={[hoveredPlace.lat, hoveredPlace.lon]} icon={hoveredIcon} />
                )}
              </MapContainer>
            ) : (
              // Phase 2: Single route (viaRoute)
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
                {hoveredPlace.photoRef ? (
                  <img
                    src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${hoveredPlace.photoRef}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                    alt={hoveredPlace.name}
                    onError={e => { e.currentTarget.src = fallbackImg; }}
                  />
                ) : (
                  <img src={fallbackImg} alt="Fallback" />
                )}
              </div>
              <div className="hoverbox-info">
                <p className="hoverbox-name">{hoveredPlace.name}</p>
                <p className="hoverbox-meta">
                  ⭐ {hoveredPlace.rating} | 📍 {hoveredPlace.vicinity || ""}
                </p>
              </div>
            </div>
          )}
          {showNavOptions && (
            <NavBox
              origin={originStr}
              destination={destinationStr}
              destCoords={destCoords}
              places={places}
              buildGoogleMapsUrl={buildGoogleMapsUrl}
              buildAppleMapsUrl={buildAppleMapsUrl}
              buildWazeUrl={buildWazeUrl}
              handleOptionClick={handleOptionClick}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Navigation Box Component
function NavBox({ buildGoogleMapsUrl, buildAppleMapsUrl, buildWazeUrl, handleOptionClick }) {
  // Pre-generate URLs for better performance and debugging
  const googleMapsUrl = buildGoogleMapsUrl();
  const appleMapsUrl = buildAppleMapsUrl();
  const wazeUrl = buildWazeUrl();
  
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
        <button className="navbox-option" onClick={() => handleOptionClick(wazeUrl)}>
          Waze
        </button>
      </div>
    </div>
  );
}

