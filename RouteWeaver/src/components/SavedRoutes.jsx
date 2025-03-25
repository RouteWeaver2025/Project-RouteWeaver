import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import axios from "axios";
import "../design/saver.css";
import { FaBold, FaUserCircle } from 'react-icons/fa';

const SavedRoutes = () => {
  const [savedRoutes, setSavedRoutes] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate(); // Hook for navigation
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
      console.log("User not logged in, redirecting to login page");
      navigate('/', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    const fetchRoutes = async () => {
      setLoading(true);
      try {
        const userEmail = localStorage.getItem('userEmail');
        console.log("Fetching routes for user:", userEmail);
        
        if (!userEmail) {
          console.warn("No user email found in local storage");
          setError("You need to be logged in to view saved routes");
          setLoading(false);
          return;
        }
        
        const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/saved`, 
          { email: userEmail },
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        console.log("Saved routes response:", response.data);
        
        if (Object.keys(response.data).length === 0) {
          console.log("No saved routes found");
          setError("No saved routes found");
          setSavedRoutes([]);
          setLoading(false);
          return;
        }
        
        // Convert the object of routes to an array for rendering
        const routesArray = Object.entries(response.data).map(([id, route]) => ({
          id,
          origin: route.origin,
          destination: route.destination
        }));
        
        console.log("Processed routes array:", routesArray);
        setSavedRoutes(routesArray);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error("Error fetching saved routes:", err);
        setError(err.response?.data?.message || err.message);
        setSavedRoutes([]);
      } finally {
        setLoading(false);
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
  const handleTileClick = (routeId) => {
    // Navigate with the specific route ID
    navigate(`/summary/${routeId}`);
    console.log(`Navigating to route with ID: ${routeId}`);
  };

  // Handle sign out functionality
  const handleSignOut = () => {
    // Remove user data from localStorage and sessionStorage
    localStorage.removeItem('userEmail');
    sessionStorage.clear();
    // Navigate to login page
    navigate('/');
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
              <a href="#signout" onClick={handleSignOut}>Sign Out</a>
            </div>
          )}
        </div>
      </nav>
      <section id="hero">
      </section>
      <div className="listhead">
        <p>Saved Routes</p>
      </div>
      {loading ? (
        <div className="loading-indicator">
          <p>Loading your saved routes...</p>
        </div>
      ) : (
        <>
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
          <div className="routes-list">
            {savedRoutes.length > 0 ? (
              savedRoutes.map((route) => (
                <div
                  key={route.id}
                  className="route-tile"
                  onClick={() => handleTileClick(route.id)}
                  style={{ cursor: "pointer" }}
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
        </>
      )}
    </div>
  );
};

export default SavedRoutes;
