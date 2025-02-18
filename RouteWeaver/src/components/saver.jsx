import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import axios from "axios"; 
import "../design/saver.css";

const SavedRoutes = () => {
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // Hook for navigation

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const response = await axios.get("http://localhost:5000/saved");
        console.log(response.data);
        setSavedRoutes(Object.values(response.data)); // Convert object to array
      } catch (err) {
        setError(err.message);
        console.error("Error fetching data:", err);
      }
    };

    fetchRoutes();
  }, []);

  // Function to handle tile click
  const handleTileClick = (index) => {
    navigate(`/summary/${index}`); // Navigate with index
  };

  return (
    <div className="saver-container">
      {error && <p className="error-message">Error: {error}</p>}
      <div className="routes-list">
        {savedRoutes.length > 0 ? (
          savedRoutes.map((route, index) => (
            <div 
              key={index} 
              className="route-tile"
              onClick={() => handleTileClick(index)} // Handle click event
              style={{ cursor: "pointer" }} // Indicate clickable item
            >
              <span className="start">{route.origin}</span>
              <span className="route-arrow">→</span>
              <span className="destination">{route.destination}</span>
            </div>
          ))
        ) : (
          <p className="no-routes">No saved routes available.</p>
        )}
      </div>
    </div>
  );
};

export default SavedRoutes;
