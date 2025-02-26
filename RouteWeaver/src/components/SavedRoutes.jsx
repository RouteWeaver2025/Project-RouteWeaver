import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import axios from "axios";
import "../design/saver.css";
import { FaBold, FaUserCircle } from 'react-icons/fa';

const SavedRoutes = () => {
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [error, setError] = useState(null);
  const navigate = useNavigate(); // Hook for navigation
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const user = sessionStorage.getItem('email');
        const response = await axios.post("http://localhost:5000/saved", 
          { email: user },
        );
        console.log(response.data);
        setSavedRoutes(Object.values(response.data)); // Convert object to array
      } catch (err) {
        setError(err.message);
        console.error("Error fetching data:", err);
      }
    };

    fetchRoutes();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Function to handle tile click
  const handleTileClick = (index) => {
    navigate(`/summary/${index}`); // Navigate with index
  };


  return (
    <div className="saver-container">
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div>
          <button id="name" onClick={() => navigate('/home')}>RouteWeaver</button>
        </div>
        <div className="nav-links">
          <a href="/home"><h4>Home</h4></a>
          <FaUserCircle
            size={24}
            className="profile-icon"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          />
          {showProfileMenu && (
            <div className="profile-dropdown">
              <a href="#profile">My Profile</a>
              <a href="#settings">Settings</a>
              <a href="#switch">Switch Account</a>
              <a href="#signout">Sign Out</a>
            </div>
          )}
        </div>
      </nav>
      <section id="hero">
      </section>
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
