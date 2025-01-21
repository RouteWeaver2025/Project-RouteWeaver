import React from "react";
import { useLocation } from "react-router-dom";

const HomePage = () => {
  const location = useLocation(); // Hook to access the location object
  const email = location.state?.email || "Guest"; // Access email from state, fallback to "Guest"

  return (
    <div className="main">
      <div className="greeting">
        <h3>Hello! {email}</h3> {/* Display the email here */}
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
