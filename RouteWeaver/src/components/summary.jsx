import React, { useState } from "react";
import "../design/summary.css";
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const Summary = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const acceptedLocations = location.state?.acceptedLocations || [];

  const [waypoints, setWaypoints] = useState(acceptedLocations);

  const handleDelete = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const originString = sessionStorage.getItem('location');
    const destinationString = sessionStorage.getItem('destination');
    const index = "x";

    
  const originObject = {
    landmark: originString.split(",")[0].trim(),
    state: originString.split(",")[1].trim(),
    country: originString.split(",")[2].trim(),
  };

  const destinationObject = {
    landmark: destinationString.split(",")[0].trim(),
    state: destinationString.split(",")[1].trim(),
    country: destinationString.split(",")[2].trim(),
  };
    // Send the full waypoint objects
    const updatedWaypoints = [originObject, ...waypoints, destinationObject];

    const requestData = {
      email: sessionStorage.getItem('email'),
      id: index,
      waypoints: updatedWaypoints,
    };


    axios
      .post("http://localhost:5000/saved/save", requestData)
      .then(() => {
        navigate("/home");
      })
      .catch((error) => {
        console.error("Error saving route:", error);
      });
  };

  return (
    <div className="summary-container">
      <button id="name" onClick={() => navigate('/home')}>RouteWeaver</button>
      <button className="edit-btn" onClick={() => navigate('/suggestions')}>✏️ Edit</button>
      <h2 className="start-address">Starting Address: New York, NY</h2>
      <div className="waypoints-list">
        {waypoints.length > 0 ? (
          waypoints.map((waypoint, index) => (
            <div key={index} className="waypoint-tile">
              <span className="waypoint-text">{waypoint.name}</span> {/* Render name property */}
              <button className="delete-btn" onClick={() => handleDelete(index)}>
                ❌
              </button>
            </div>
          ))
        ) : (
          <p className="empty-message">No waypoints added yet.</p>
        )}
      </div>
      <h2 className="destination-address">Destination: Los Angeles, CA</h2>
      <div className="bottom-buttons">
        <button className="navigate-btn">📍 Navigate</button>
        <button className="save-btn" onClick={handleSave}>💾 Save</button>
      </div>
    </div>
  );
}

export default Summary;