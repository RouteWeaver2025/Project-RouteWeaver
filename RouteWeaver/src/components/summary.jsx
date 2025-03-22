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
function RoutePolylines({ route }) {
  const map = useMap();
  
  useEffect(() => {
    if (!route || !route.geometry || route.geometry.length === 0) return;
    
    try {
      // Get all coordinates from the route
      const allCoords = route.geometry;
      if (allCoords.length === 0) {
        console.warn("No coordinates found in route");
        return;
      }
      
      console.log(`Fitting map to ${allCoords.length} coordinates`);
      
      // Convert coordinates to Leaflet format and create bounds
      const latLngs = allCoords.map(([lat, lng]) => [lat, lng]);
      const bounds = L.latLngBounds(latLngs);
      
      // Fit the map to the bounds with padding
      map.fitBounds(bounds, { padding: [50, 50] });
    } catch (error) {
      console.error("Error fitting map to bounds:", error);
    }
  }, [route, map]);
  
  if (!route || !route.geometry || route.geometry.length < 2) return null;
  
  return (
    <Polyline
      positions={route.geometry}
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
        const response = await axios.get(`${baseUrl}/saved/${email}/${routeId}`);
        
        const data = response.data;
        console.log("Route data:", data);
        
        // Debug the places structure
        if (data.places && data.places.length > 0) {
          console.log("First place structure:", data.places[0]);
        }
        
        // Set route data
        setRouteData(data);
        setOrigin(data.origin);
        setDestination(data.destination);
        
        // Mark all places as checked by default and ensure they have lat/lng properties
        const placesWithChecked = data.places.map(place => {
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
        
        // Get coordinates for origin and destination
        await getCoordinatesFromAddresses(data.origin, data.destination);
        
        // If places have missing coordinates (longitude is null or undefined), try to look them up
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
                  
                  // If no coordinates found, use fallback coordinates near Shimla with specific offsets for each place
                  // This ensures they appear in different locations around Shimla
                  if (destCoords) {
                    // Shimla coordinates as fallback center
                    const shimlaLat = 31.1041526;
                    const shimlaLng = 77.1709729;
                    
                    // Create a distributed pattern of points around Shimla based on the place index
                    const angle = (index * 45) % 360; // Distribute in a circle
                    const distance = 0.02 + (index * 0.005); // Increasing distance from center
                    
                    // Calculate offset using trigonometry
                    const latOffset = distance * Math.cos(angle * Math.PI / 180);
                    const lngOffset = distance * Math.sin(angle * Math.PI / 180);
                    
                    return {
                      ...place,
                      lat: shimlaLat + latOffset,
                      lng: shimlaLng + lngOffset,
                      latitude: shimlaLat + latOffset,
                      longitude: shimlaLng + lngOffset
                    };
                  }
                }
              } catch (error) {
                console.error(`Error looking up coordinates for ${place.name}:`, error);
              }
            }
          }
          return place;
        }));
        
        console.log("Updated places with looked-up coordinates:", updatedPlaces);
        setPlaces(updatedPlaces);
        
        // Generate route geometry with the updated places
        await fetchRouteGeometry(data.origin, data.destination, updatedPlaces);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching route data:", error);
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
      if (!originCoords || !destCoords) {
        console.warn("Coordinates not available yet");
        return;
      }
      
      // Format coordinates for API
      const originStr = `${originCoords.lat},${originCoords.lng}`;
      const destStr = `${destCoords.lat},${destCoords.lng}`;
      
      // Debug places before filtering
      console.log("Places before filtering:", places);
      
      // Count places with valid coordinates
      const placesWithCoords = places.filter(place => {
        const lat = place.checked && (place.lat || place.latitude);
        const lng = place.checked && (place.lng || place.longitude);
        return place.checked && lat && lng;
      });
      console.log(`Places with valid coordinates: ${placesWithCoords.length} of ${places.length}`);
      
      // If no places have valid coordinates, use the fallback route
      if (placesWithCoords.length === 0 && places.filter(p => p.checked).length > 0) {
        console.warn("No places have valid coordinates, using fallback route");
        createFallbackRoute();
        return;
      }
      
      // Prepare waypoints from places - try different property names
      const waypoints = placesWithCoords
        .map(place => {
          // Try to get coordinates from either lat/lng or latitude/longitude format
          const lat = place.lat || place.latitude;
          const lng = place.lng || place.longitude;
          return `${lat},${lng}`;
        })
        .join('|');
      
      console.log("Fetching route with waypoints:", waypoints);
      
      // Fetch route from backend
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      let url = new URL(`${baseUrl}/api/landmarks/routesWithPlaces`);
      url.searchParams.set("origin", originStr);
      url.searchParams.set("destination", destStr);
      if (waypoints) {
        url.searchParams.set("waypoints", waypoints);
      }
      
      console.log("Fetching route URL:", url.toString());
      
      try {
        // First attempt with waypoints
        const response = await fetch(url.toString());
        
        // If successful, process the route data
        if (response.ok) {
          const data = await response.json();
          processRouteData(data);
          return;
        } else {
          // If failed with waypoints, log the error
          const errorText = await response.text();
          console.error(`API Error with waypoints (${response.status}):`, errorText);
          
          // Try again without waypoints as a fallback
          console.log("Retrying without waypoints for a direct route");
          url = new URL(`${baseUrl}/api/landmarks/routesWithPlaces`);
          url.searchParams.set("origin", originStr);
          url.searchParams.set("destination", destStr);
          
          const directResponse = await fetch(url.toString());
          if (directResponse.ok) {
            const directData = await directResponse.json();
            processRouteData(directData);
          } else {
            // If even the direct route fails, use our fallback
            const directErrorText = await directResponse.text();
            console.error(`API Error for direct route (${directResponse.status}):`, directErrorText);
            createFallbackRoute();
          }
        }
      } catch (error) {
        console.error("Error fetching route:", error);
        createFallbackRoute();
      }
    } catch (error) {
      console.error("Error fetching route geometry:", error);
      setError("Failed to fetch route. Please try again.");
      createFallbackRoute();
    }
  }
  
  // Process route data
  function processRouteData(data) {
    console.log("Received route data:", data);
    
    // Check if we have valid geometry data
    if (!data || !data.geometry || !Array.isArray(data.geometry) || data.geometry.length < 2) {
      console.warn("Invalid route geometry received:", data);
      createFallbackRoute();
      return;
    }
    
    // Convert to Leaflet format [lat, lng] as Leaflet expects
    const geometry = data.geometry.map(coord => [coord[1], coord[0]]);
    console.log(`Route has ${geometry.length} points`);
    
    // Set route data
    setRoute({
      geometry,
      time: data.time || 0,
      distance: data.distance || 0
    });
    
    // Route successfully loaded
    setLoading(false);
  }
  
  // Create a fallback route when the API fails
  function createFallbackRoute() {
    console.log("Creating fallback route between origin and destination");
    
    if (!originCoords || !destCoords) {
      console.warn("Cannot create fallback route: missing coordinates");
      setLoading(false);
      setError("Could not display route: missing location data");
      return;
    }
    
    // Create a simple straight line route
    const geometry = [
      [originCoords.lat, originCoords.lng],
      [destCoords.lat, destCoords.lng]
    ];
    
    // Estimate the distance using Haversine formula
    const R = 6371; // Earth radius in km
    const dLat = (destCoords.lat - originCoords.lat) * Math.PI / 180;
    const dLon = (destCoords.lng - originCoords.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(originCoords.lat * Math.PI / 180) * Math.cos(destCoords.lat * Math.PI / 180) * 
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
          // Google Maps URL in format that supports waypoints
          navUrl = 'https://www.google.com/maps/dir/';
          
          // Add origin coordinates to the path
          navUrl += `${originCoords.lat},${originCoords.lng}/`;
          console.log("Added origin to URL:", navUrl);
          
          // Add waypoints to the path
          if (checkedPlaces.length > 0) {
            // Google Maps web has a limit (we'll keep it to 10 to be safe)
            const limitedWaypoints = checkedPlaces.slice(0, 10);
            console.log("Selected waypoints:", limitedWaypoints.length);
            
            // Filter out invalid waypoints
            const validWaypoints = limitedWaypoints.filter(place => {
              const lat = place.lat || place.latitude;
              const lng = place.lng || place.longitude;
              return lat && lng && !isNaN(lat) && !isNaN(lng);
            });
            console.log("Valid waypoints:", validWaypoints.length);
            
            // Add each waypoint to the URL path
            validWaypoints.forEach((place, index) => {
              const lat = place.lat || place.latitude;
              const lng = place.lng || place.longitude;
              navUrl += `${lat},${lng}/`;
              console.log(`Added waypoint ${index+1}: ${place.name} at ${lat},${lng}`);
            });
          }
          
          // Add destination to the path
          navUrl += `${destCoords.lat},${destCoords.lng}`;
          console.log("Added destination to URL:", navUrl);
          
          // Add params for driving directions
          navUrl += '?travelmode=driving';
          
          break;
          
        case 'waze':
          // Waze only supports navigating to one destination
          navUrl = `https://waze.com/ul?ll=${destCoords.lat},${destCoords.lng}&navigate=yes`;
          break;
          
        case 'apple':
          // Apple Maps URL format
          navUrl = `http://maps.apple.com/?saddr=${originCoords.lat},${originCoords.lng}&daddr=${destCoords.lat},${destCoords.lng}`;
          // Apple Maps doesn't support waypoints in the same way
          break;
          
        default:
          navUrl = `https://www.google.com/maps/dir/?api=1&origin=${originCoords.lat},${originCoords.lng}&destination=${destCoords.lat},${destCoords.lng}`;
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
        {error ? (
          <>
            <div className="sidebar">
              <div className="route-header">
                <h3>Route Summary</h3>
              </div>
              <div className="error-message">
                <p>{error}</p>
              </div>
              <div className="bottom-buttons">
                <button id="navigate-btn" onClick={handleBack}>Back to Routes</button>
              </div>
            </div>
            <div className="map-area">
              {/* Fallback map */}
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
        ) : loading ? (
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
              
              {route && (
                <div className="route-info">
                  <div className="origin-dest-item start-point">
                    <span>From: {origin}</span>
                  </div>
                  <div className="origin-dest-item end-point">
                    <span>To: {destination}</span>
                  </div>
                  <div className="route-details">
                    <span>Time: {route.time ? (route.time / 60).toFixed(1) + ' min' : 'Calculating...'}</span>
                    <span>Distance: {route.distance ? (route.distance / 1000).toFixed(1) + ' km' : 'Calculating...'}</span>
                  </div>
                </div>
              )}
              
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
                      <span className="start-point">Start: {origin}</span>
                    </div>
                    
                    {places.map((place, index) => (
                      <div
                        key={index}
                        className="place-item"
                        onMouseEnter={() => setHoveredPlace(place)}
                        onMouseLeave={() => setHoveredPlace(null)}
                      >
                        <div className="place-name">{place.name}</div>
                        <input
                          type="checkbox"
                          checked={place.checked}
                          onChange={() => togglePlace(index)}
                        />
                      </div>
                    ))}
                    
                    <div className="origin-dest-item">
                      <span className="end-point">End: {destination}</span>
                    </div>
                  </>
                )}
              </div>
              
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
              {originCoords && destCoords && (
                <MapContainer
                  center={[originCoords.lat, originCoords.lng]}
                  zoom={7}
                  style={{ height: "100%", width: "100%" }}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Route line */}
                  {route && <RoutePolylines route={route} />}
                  
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
                  
                  {/* Place markers */}
                  {places.filter(p => p.checked).map((place, idx) => {
                    // Get coordinates using either format
                    const lat = place.lat || place.latitude;
                    const lng = place.lng || place.longitude;
                    
                    // Skip if coordinates are missing
                    if (!lat || !lng) return null;
                    
                    return (
                      <Marker 
                        key={`place-marker-${idx}`}
                        position={[lat, lng]} 
                        icon={placeIcon}
                      >
                        <Popup>{place.name}</Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              )}
              
              {/* Hover box for place details */}
              {hoveredPlace && (
                <div className="hoverbox">
                  <div className="hoverbox-info">
                    <p className="hoverbox-name">{hoveredPlace.name}</p>
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