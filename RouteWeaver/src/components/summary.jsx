import React, { useState } from "react";
import "../design/summary.css";

const Summary = () => {
  const [waypoints, setWaypoints] = useState([
    "Waypoint 1",
    "Waypoint 2",
    "Waypoint 3",
  ]);

  const handleDelete = (index) => {
    setWaypoints(waypoints.filter((_, i) => i !== index));
  };

  const handleAddWaypoint = () => {
    setWaypoints([...waypoints, `Waypoint ${waypoints.length + 1}`]);
  };

  return (
    <div className="summary-page">
      {/* Starting Address */}
      <h2 className="start-address">Starting Address: New York, NY</h2>

      {/* Main Container (Now Full Screen) */}
      <div className="summary-container">
        {/* Waypoints List */}
        <div className="waypoints-list">
          {waypoints.map((waypoint, index) => (
            <div key={index} className="waypoint-tile">
              <span className="waypoint-text">{waypoint}</span>
              <button className="delete-btn" onClick={() => handleDelete(index)}>
                ❌
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Destination Address */}
      <h2 className="destination-address">Destination: Los Angeles, CA</h2>

      {/* Add Waypoint Button */}
      <button className="add-btn" onClick={handleAddWaypoint}>
        ➕ Add Waypoint
      </button>
    </div>
  );
};

export default Summary;
