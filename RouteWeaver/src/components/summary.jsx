import React, { useState } from "react";
import "../design/summary.css";
import { useNavigate, useLocation } from 'react-router-dom';

const Summary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const acceptedLocations = location.state?.acceptedLocations || []; // Retrieve accepted locations

  const [waypoints, setWaypoints] = useState(acceptedLocations); // Use accepted locations

  const handleDelete = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  return (
      <div className="summary-container">
        {/* RouteWeaver Button (Top Left) */}
        <button id="name" onClick={() => navigate('/home')}>RouteWeaver</button>
        
        {/* Edit Button (Top Right) */}
        <button className="edit-btn" onClick={() => navigate('/suggestions')}>✏️ Edit</button>

        {/* Starting Address */}
        <h2 className="start-address">Starting Address: New York, NY</h2>

        {/* Waypoints List */}
        <div className="waypoints-list">
          {waypoints.length > 0 ? (
            waypoints.map((waypoint, index) => (
              <div key={index} className="waypoint-tile">
                <span className="waypoint-text">{waypoint}</span>
                <button className="delete-btn" onClick={() => handleDelete(index)}>
                  ❌
                </button>
              </div>
            ))
          ) : (
            <p className="empty-message">No waypoints added yet.</p>
          )}
        </div>

        {/* Destination Address */}
        <h2 className="destination-address">Destination: Los Angeles, CA</h2>

        {/* Navigate & Save Buttons (Bottom Right) */}
        <div className="bottom-buttons">
          <button className="navigate-btn">📍 Navigate</button>
          <button className="save-btn">💾 Save</button>
        </div>

      </div>
  );
}

export default Summary;
