import React from "react";
import { useLocation } from "react-router-dom";
import axios from 'axios';
import "../design/homescreen.css"


const HomePage = () => {
  // const location = useLocation(); // Hook to access the location object
  // const email = location.state?.email || "Guest"; // Access email from state, fallback to "Guest"

  const name="Ryan";

  return (
    <div className="main1">
      <div className="greeting">
        <h3 >Hello {name}</h3> {/* Display the email here */}
      </div>
      <div className="box">
        <div className="NewR"></div>
        <div className="SavedR"></div>
      </div>
      <div className="SmartV"></div>
    </div>
  );
};

export default HomePage;
