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
      <div className="homeTop">
        <div class="menuicon">
          <div class="bar1"></div>
          <div class="bar2"></div>
          <div class="bar3"></div>
        </div>
      </div>
      <div className="greeting">
        <h3 >Hello {name}</h3> {/* Display the email here */}
      </div>
      <div className="box">
        <div role="button" className="NewR"></div>
        <div role="button" className="SavedR"></div>
      </div>
      <div role="button" className="SmartV">
        <h4>hello</h4>
      </div>
    </div>
  );
};

export default HomePage;
