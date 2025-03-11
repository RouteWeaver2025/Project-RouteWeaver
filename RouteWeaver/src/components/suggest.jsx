import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../design/suggest.css";

const SuggestPage = () => {
  const navigate = useNavigate();

  // State for routes, selected route index, hovered place
  const [routesData, setRoutesData] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [hoveredPlace, setHoveredPlace] = useState(null);

  // Retrieve origin, destination, and selectedKeywords from sessionStorage
  const origin = sessionStorage.getItem("location");
  const destination = sessionStorage.getItem("destination");
  const selectedKeywords = JSON.parse(sessionStorage.getItem("selectedKeywords") || "[]");

  // Number emojis to label routes 1, 2, 3, ...
  const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣"];

  // Fetch route data on mount
  useEffect(() => {
    axios
      .get("http://localhost:5000/create", {
        params: {
          origin,
          destination,
          // Convert the array to a JSON string to pass as query param
          selectedKeywords: JSON.stringify(selectedKeywords)
        }
      })
      .then(response => {
        if (response.data && response.data.routes) {
          setRoutesData(response.data.routes);
          setSelectedRouteIndex(0); // Default to first route
        }
      })
      .catch(error => {
        console.error("Error fetching routes:", error);
      });
  }, [origin, destination, selectedKeywords]);

  // The currently selected route’s data
  const selectedRouteData = routesData[selectedRouteIndex] || null;

  return (
    <div className="suggest-container">
      {/* Top Bar */}
      <div className="top-bar">
        <button id="name" onClick={() => navigate("/home")}>
          RouteWeaver
        </button>
      </div>

      <div className="sidebar">
        <div className="routes">
          <div className="route-header">
            {origin} to {destination}
          </div>
          <div className="route-list">
            {routesData.map((route, index) => (
              <button
                key={index}
                className={`route-item ${
                  selectedRouteIndex === index ? "selected" : ""
                }`}
                onClick={() => setSelectedRouteIndex(index)}
              >
                <span className="route-number">
                  {numberEmojis[index] || index + 1}
                </span>
                <span className="route-time">{route.timeTaken}</span>
                <span className="route-distance">{route.distance}</span>
              </button>
            ))}
          </div>
        </div>
        <hr />
        <div className="places">
          <div className="place-header">Places to Visit</div>
          <div className="place-list">
            {selectedRouteData && selectedRouteData.places ? (
              selectedRouteData.places.map((place, index) => (
                <button
                  key={index}
                  className="place-item"
                  onMouseEnter={() => setHoveredPlace(place)}
                  onMouseLeave={() => setHoveredPlace(null)}
                >
                  {place.name}
                </button>
              ))
            ) : (
              <p>Select a route to view places</p>
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
        Map Area (Blank for now)
        {hoveredPlace && (
          <div className="hoverbox">
            <div className="hoverbox-header">
              <span className="hoverbox-name">{hoveredPlace.name}</span>
              <span className="hoverbox-rating">
                {hoveredPlace.rating}⭐
              </span>
            </div>
            <img
              src={hoveredPlace.image}
              alt={hoveredPlace.name}
              className="hoverbox-image"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default SuggestPage;
