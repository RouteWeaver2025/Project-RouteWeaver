import React, { useEffect, useState } from "react";
import axios from "axios"; // Import axios
import "../design/saver.css";

const SavedRoutes = () => {
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
         const response = await axios.get("http://localhost:5000/saved",/*{
         params: {  },}*/);
         console.log(response.data);
        //  setSavedRoutes(response.data);
      } catch (err) {
        setError(err.message);
        console.error("Error fetching data:", err);
      }
    };

    fetchRoutes();
  }, []);

  return (
    <div className="saver-container">
      {error && <p className="error-message">Error: {error}</p>}
      <div className="routes-list">
        {savedRoutes.length > 0 ? (
          savedRoutes.map((route, index) => (
            <div key={index} className="route-tile">
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
