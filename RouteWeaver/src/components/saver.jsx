import React from "react";
import "../design/saver.css";

const SavedRoutes = () => {
  const savedRoutes = [
    { start: "New York, NY", destination: "Los Angeles, CA" },
    { start: "Chicago, IL", destination: "Houston, TX" },
    { start: "San Francisco, CA", destination: "Seattle, WA" },
    { start: "Miami, FL", destination: "Atlanta, GA" },
    { start: "Dallas, TX", destination: "Denver, CO" },
    { start: "Boston, MA", destination: "Washington, DC" },
    { start: "Las Vegas, NV", destination: "Phoenix, AZ" },
    { start: "San Diego, CA", destination: "Portland, OR" },
    { start: "Austin, TX", destination: "Nashville, TN" },
    { start: "Philadelphia, PA", destination: "Charlotte, NC" },
    { start: "Orlando, FL", destination: "Tampa, FL" },
    { start: "Cleveland, OH", destination: "Indianapolis, IN" },
    { start: "Minneapolis, MN", destination: "St. Louis, MO" },
    { start: "Salt Lake City, UT", destination: "Boise, ID" }
  ];

  return (
    <div className="saver-container"> 
      <div className="routes-list"> 
        {savedRoutes.map((route, index) => (
          <div key={index} className="route-tile">
            <span className="start">{route.start}</span>
            <span className="route-arrow">→</span>
            <span className="destination">{route.destination}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SavedRoutes;
