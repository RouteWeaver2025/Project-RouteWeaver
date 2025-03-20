import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Polyline, useMap, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../design/suggest.css";
import fallbackImg from "../assets/homeimg.jpg"; // fallback image for places

/* ----------------- OSRM-BASED ROUTING ----------------- */

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

const routesCache = new Map();
async function getRoutes(originCoords, destCoords) {
  try {
    const cacheKey = `${originCoords.lon},${originCoords.lat}-${destCoords.lon},${destCoords.lat}`;
    if (routesCache.has(cacheKey)) return routesCache.get(cacheKey);
    const originStr = `${originCoords.lon.toFixed(6)},${originCoords.lat.toFixed(6)}`;
    const destStr = `${destCoords.lon.toFixed(6)},${destCoords.lat.toFixed(6)}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${originStr};${destStr}?overview=full&alternatives=true&steps=true&geometries=geojson`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`OSRM error: ${resp.status}`);
    const data = await resp.json();
    if (!data.routes || data.routes.length === 0) throw new Error("No routes found from OSRM");
    const routes = data.routes.slice(0, 4).map(r => ({
      timeTaken: formatDuration(r.duration),
      distance: formatDistance(r.distance),
      geometry: r.geometry.coordinates, // [lon, lat]
    }));
    routesCache.set(cacheKey, routes);
    return routes;
  } catch (err) {
    console.error("Error fetching routes:", err);
    return [];
  }
}

function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours}hrs ${minutes}min` : `${minutes}min`;
}
function formatDistance(meters) {
  return `${Math.round(meters / 1000)}km`;
}

/* ----------------- GOOGLE PLACES VIA BACKEND ----------------- */

const keywordToTypeMap = {
  Lake: "natural_feature",
  Viewpoint: "tourist_attraction",
  Museum: "museum",
  Park: "park",
  Beach: "natural_feature",
};

async function fetchPlacesFromBackend(lat, lng, type, radius = 10000) {
  const url = new URL("http://localhost:5000/api/landmarks/places");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lng", lng);
  if (type) url.searchParams.set("type", type);
  url.searchParams.set("radius", radius);
  console.log("Fetching places from backend:", url.toString());
  const resp = await fetch(url.toString());
  if (!resp.ok) {
    console.error("Backend places fetch error:", resp.status);
    return [];
  }
  const data = await resp.json();
  return data.results || [];
}

async function getPlacesAlongRoute(geometry, keywords) {
  // Use fallback if no keywords are selected.
  const effectiveKeywords = keywords && keywords.length > 0 ? keywords : [""];
  if (geometry.length < 2) {
    console.warn("Route geometry too short to sample");
    return [];
  }
  // Sample at 20%, 40%, 60%, and 80% along the route for broader coverage.
  const samplePoints = [
      geometry[Math.floor(geometry.length * 0.1)], // 10%
      geometry[Math.floor(geometry.length * 0.3)], // 30%
      geometry[Math.floor(geometry.length * 0.5)], // 50%
      geometry[Math.floor(geometry.length * 0.7)], // 70%
      geometry[Math.floor(geometry.length * 0.9)]  // 90%
  ];
  let allPlaces = [];
  for (const point of samplePoints) {
    const [lon, lat] = point; // OSRM returns [lon, lat]
    for (const kw of effectiveKeywords) {
      // If keyword is empty, let backend return default "tourist_attraction"
      const type = kw ? (keywordToTypeMap[kw] || "tourist_attraction") : "";
      const places = await fetchPlacesFromBackend(lat, lon, type);
      allPlaces = allPlaces.concat(
        places.map(res => ({
          name: res.name || "Unnamed Place",
          lat: res.geometry?.location?.lat || lat,
          lon: res.geometry?.location?.lng || lon,
          rating: res.rating ? res.rating.toFixed(1) : (4 + Math.random()).toFixed(1),
          visitors: Math.floor(800 + Math.random() * 1200),
          photoRef: res.photos && res.photos.length > 0 ? res.photos[0].photo_reference : null,
          type: type || "tourist_attraction"
        }))
      );
    }
  }
  // Deduplicate by name.
  const uniqueMap = new Map();
  allPlaces.forEach(p => {
    const key = p.name.toLowerCase();
    if (!uniqueMap.has(key)) uniqueMap.set(key, p);
  });
  // Filter out places with rating below 4.0.
  const filtered = Array.from(uniqueMap.values()).filter(
    p => parseFloat(p.rating) >= 4.0
  );
  return filtered.slice(0, 20);
}

/* ----------------- LEAFLET POLYLINES COMPONENT ----------------- */
const RoutesPolylines = React.memo(({ routesData, selectedRouteIndex }) => {
  const map = useMap();
  useEffect(() => {
    if (routesData.length > 0) {
      const allCoords = routesData.flatMap(r => r.geometry || []);
      if (allCoords.length > 0) {
        const latLngs = allCoords.map(([lon, lat]) => [lat, lon]);
        const bounds = L.latLngBounds(latLngs);
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [routesData, map]);
  return routesData.map((route, idx) => {
    if (!route?.geometry) return null;
    const isSelected = idx === selectedRouteIndex;
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
});

/* ----------------- Custom Icon for Hovered Place Marker ----------------- */
const hoveredIcon = L.icon({
  iconUrl: "/src/assets/marker.png", // Ensure this file exists.
  iconSize: [60, 60],
  iconAnchor: [30, 60],
});

/* ----------------- MAIN COMPONENT ----------------- */
const SuggestPage = () => {
  const navigate = useNavigate();
  const [originCoords, setOriginCoords] = useState(null);
  const [destCoords, setDestCoords] = useState(null);
  const [routesData, setRoutesData] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [hoveredPlace, setHoveredPlace] = useState(null);

  const origin = sessionStorage.getItem("location") || "Kochi, Kerala";
  const destination = sessionStorage.getItem("destination") || "Thiruvananthapuram, Kerala";
  const selectedKeywords = useMemo(() => {
    const raw = sessionStorage.getItem("selectedKeywords");
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }, []);

  // Fetch OSRM routes on mount.
  useEffect(() => {
    async function fetchRoutes() {
      setIsLoadingRoutes(true);
      try {
        const oCoords = await getCoordinates(origin);
        const dCoords = await getCoordinates(destination);
        if (!oCoords || !dCoords) {
          console.error("Could not geocode origin/destination");
          return;
        }
        setOriginCoords(oCoords);
        setDestCoords(dCoords);
        const routes = await getRoutes(oCoords, dCoords);
        const routesWithPlaces = routes.map(r => ({ ...r, places: null }));
        setRoutesData(routesWithPlaces);
      } catch (err) {
        console.error("Error fetching OSRM routes:", err);
      } finally {
        setIsLoadingRoutes(false);
      }
    }
    fetchRoutes();
  }, [origin, destination]);

  // Fetch places for the selected route if not already fetched.
  useEffect(() => {
    async function fetchPlacesForRoute() {
      if (selectedRouteIndex == null || selectedRouteIndex >= routesData.length) return;
      const route = routesData[selectedRouteIndex];
      if (!route || !route.geometry) return;
      if (route.places !== null) return; // Already fetched.
      setIsLoadingPlaces(true);
      try {
        const newPlaces = await getPlacesAlongRoute(route.geometry, selectedKeywords);
        setRoutesData(prev =>
          prev.map((r, idx) =>
            idx === selectedRouteIndex ? { ...r, places: newPlaces } : r
          )
        );
      } catch (err) {
        console.error("Error fetching places:", err);
      } finally {
        setIsLoadingPlaces(false);
      }
    }
    fetchPlacesForRoute();
  }, [routesData, selectedRouteIndex, selectedKeywords]);

  function handleSelectRoute(idx) {
    setSelectedRouteIndex(idx);
  }

  return (
    <div className="suggest-container">
      <div className="top-bar">
        <button id="name" onClick={() => navigate("/home")}>
          RouteWeaver
        </button>
      </div>
      <div className="main-content">
        <div className="sidebar">
          <div className="routes">
            <div className="route-header">
              {isLoadingRoutes ? "Loading routes..." : `${origin} to ${destination}`}
            </div>
            <div className="route-list">
              {routesData.map((route, idx) => {
                const isSelected = idx === selectedRouteIndex;
                return (
                  <button
                    key={idx}
                    className={`route-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleSelectRoute(idx)}
                  >
                    <span className="route-number">{["1️⃣", "2️⃣", "3️⃣", "4️⃣"][idx]}</span>
                    <span className="route-time">{route.timeTaken}</span>
                    <span className="route-distance">{route.distance}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <hr />
          <div className="places">
            <div className="place-header">
              {isLoadingPlaces ? "Loading places..." : "Places to Visit"}
            </div>
            <div className="place-list">
              {isLoadingPlaces ? (
                <div className="loading-placeholder">
                  <span>Fetching places...</span>
                </div>
              ) : selectedRouteIndex == null || !routesData[selectedRouteIndex] ? (
                <div className="loading-placeholder">
                  <span>Select a route to see places</span>
                </div>
              ) : routesData[selectedRouteIndex].places === null ? (
                <div className="loading-placeholder">
                  <span>Fetching places...</span>
                </div>
              ) : routesData[selectedRouteIndex].places.length === 0 ? (
                <div className="loading-placeholder">
                  <span>No places found for this route</span>
                </div>
              ) : (
                routesData[selectedRouteIndex].places.map((p, i) => (
                  <button
                    key={i}
                    className="place-item"
                    onMouseEnter={() => setHoveredPlace(p)}
                    onMouseLeave={() => setHoveredPlace(null)}
                  >
                    <div className="place-info">
                      <span className="place-name">{p.name}</span>
                      <div className="place-details">
                        <span className="place-rating">⭐ {p.rating}</span>
                        <span className="place-visitors">👥 {p.visitors}/day</span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
          <hr />
          <div className="bottom-buttons">
            <button id="navigate-btn">Navigate</button>
            <button id="submit-btn">Submit</button>
          </div>
        </div>
        <div className="map-area">
          {originCoords && (
            <MapContainer
              center={[originCoords.lat, originCoords.lon]}
              zoom={7}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <RoutesPolylines
                routesData={routesData}
                selectedRouteIndex={selectedRouteIndex}
              />
              {originCoords && (
                <Marker position={[originCoords.lat, originCoords.lon]} />
              )}
              {destCoords && (
                <Marker position={[destCoords.lat, destCoords.lon]} />
              )}
              {hoveredPlace && (
                <Marker
                  position={[hoveredPlace.lat, hoveredPlace.lon]}
                  icon={hoveredIcon}
                />
              )}
            </MapContainer>
          )}
          {hoveredPlace && (
            <div className="hoverbox">
              <div className="hoverbox-image-container">
                {hoveredPlace.photoRef ? (
                  <img
                    src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${hoveredPlace.photoRef}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`}
                    alt={hoveredPlace.name}
                    onError={(e) => {
                      e.currentTarget.src = fallbackImg;
                    }}
                  />
                ) : (
                  <img src={fallbackImg} alt="Fallback" />
                )}
              </div>
              <div className="hoverbox-info">
                <p className="hoverbox-name">{hoveredPlace.name}</p>
                <p className="hoverbox-meta">
                  ⭐ {hoveredPlace.rating} | 👥 {hoveredPlace.visitors}/day
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuggestPage;
