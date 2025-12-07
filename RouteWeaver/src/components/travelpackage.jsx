import React, { useState, useEffect, useRef } from "react";
import { FaUserCircle } from 'react-icons/fa';
import { IoLocationSharp } from 'react-icons/io5';
import axios from 'axios';
import '../design/travelpackage.css';
import { useNavigate } from 'react-router-dom';

import fallbackImage from '../assets/homeimg.jpg';

const TravelPackage = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [distantPlaces, setDistantPlaces] = useState([]);
  const [userCoords, setUserCoords] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const locationTimeoutRef = useRef(null);
  const searchInputRef = useRef(null);

  // Handle sign out functionality
  const handleSignOut = () => {
    // Remove user data from localStorage and sessionStorage
    localStorage.removeItem('userEmail');
    sessionStorage.clear();
    // Navigate to login page
    navigate('/');
  };

  // Check if user is logged in
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      console.log("User not logged in, redirecting to login page");
      navigate("/");
    }
  }, [navigate]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // When clicking on search input, show suggestions if we have any
  const handleSearchInputFocus = () => {
    if (suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  // Handle location input changes with OSRM autocomplete
  useEffect(() => {
    // Clear previous timeout to avoid multiple API calls
    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current);
    }

    // Only make API call if there's something to search for
    if (searchQuery.length > 2) {
      locationTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=5`
          );
          setSuggestions(response.data);
          setShowSuggestions(true);
        } catch (error) {
          console.error('Error fetching location suggestions:', error);
        }
      }, 500);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  // Get user location from storage or geolocation
  useEffect(() => {
    const getUserCoordinates = async () => {
      setLoading(true);
      try {
        // First try to get location from session storage
        const storedLocation = sessionStorage.getItem("location");
        
        if (storedLocation) {
          // Convert stored location (which is likely an address) to coordinates
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(storedLocation)}&limit=1`
          );
          
          if (response.data && response.data.length > 0) {
            const coords = {
              lat: parseFloat(response.data[0].lat),
              lng: parseFloat(response.data[0].lon)
            };
            setUserCoords(coords);
            setSearchQuery(storedLocation); // Set the search query to show the current location
            fetchPlaces(coords);
          } else {
            throw new Error("Could not geocode stored location");
          }
        } else {
          // If no stored location, try browser geolocation
    if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const coords = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                };
                setUserCoords(coords);
                
                // Reverse geocode to get location name
                try {
                  const response = await axios.get(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10`
                  );
                  if (response.data && response.data.display_name) {
                    setSearchQuery(response.data.display_name);
                    sessionStorage.setItem("location", response.data.display_name);
                  }
                } catch (err) {
                  console.error("Error reverse geocoding:", err);
                }
                
                fetchPlaces(coords);
              },
              (err) => {
                console.error("Geolocation error:", err);
                setError("Unable to get your location. Please enter a location in the search box.");
                setLoading(false);
              }
            );
          } else {
            setError("Geolocation is not supported by your browser. Please enter a location in the search box.");
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Error getting user coordinates:", err);
        setError("Error determining your location. Please try again.");
        setLoading(false);
      }
    };

    getUserCoordinates();
  }, []);

  // Fetch places from backend with the coordinates
  const fetchPlaces = async (coords) => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      
      // Fetch nearby places (within 80km)
      const nearbyResponse = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/travel/nearby`, {
        params: {
          lat: coords.lat,
          lng: coords.lng
        }
      });
      
      if (nearbyResponse.data.error) {
        console.error(`Error fetching nearby places: ${nearbyResponse.data.error}`);
        setError(`Error fetching nearby places: ${nearbyResponse.data.error}`);
        setNearbyPlaces([]);
      } else if (nearbyResponse.data && nearbyResponse.data.places) {
        setNearbyPlaces(nearbyResponse.data.places);
      } else {
        setNearbyPlaces([]);
      }
      
      // Fetch distant places (80km-1000km)
      const distantResponse = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/travel/distant`, {
        params: {
          lat: coords.lat,
          lng: coords.lng
        }
      });
      
      if (distantResponse.data.error) {
        console.error(`Error fetching distant places: ${distantResponse.data.error}`);
        if (!nearbyResponse.data.error) { // Only set error if not already set
          setError(`Error fetching distant places: ${distantResponse.data.error}`);
        }
        setDistantPlaces([]);
      } else if (distantResponse.data && distantResponse.data.places) {
        setDistantPlaces(distantResponse.data.places);
      } else {
        setDistantPlaces([]);
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error fetching places:", err);
      setError(err.response?.data?.error || "Unable to fetch places. Please try again later.");
      setNearbyPlaces([]);
      setDistantPlaces([]);
      setLoading(false);
    }
  };

  const handleLocationSelect = (suggestion) => {
    const locationName = suggestion.display_name;
    setSearchQuery(locationName);
    setShowSuggestions(false);
    
    const coords = {
      lat: parseFloat(suggestion.lat),
      lng: parseFloat(suggestion.lon)
    };
    
    setUserCoords(coords);
    sessionStorage.setItem("location", locationName);
    fetchPlaces(coords);
  };

  const handleLocationSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    try {
      setLoading(true);
      setShowSuggestions(false); // Hide suggestions when search is initiated
      
      // Geocode the search query to get coordinates
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`
      );
      
      if (response.data && response.data.length > 0) {
        const coords = {
          lat: parseFloat(response.data[0].lat),
          lng: parseFloat(response.data[0].lon)
        };
        setUserCoords(coords);
        fetchPlaces(coords);
        
        // Save to session storage
        sessionStorage.setItem("location", searchQuery);
      } else {
        setError("Location not found. Please try a different search term.");
        setLoading(false);
      }
    } catch (err) {
      console.error("Error searching location:", err);
      setError("Error searching for location. Please try again.");
      setLoading(false);
    }
  };

  // Get photo URL from photo reference or use imageUrl directly
  const getPhotoUrl = (place) => {
    // Check if the Google Places API key is available
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("Google Maps API key not found in environment variables. Make sure VITE_GOOGLE_MAPS_API_KEY is set in your .env file");
      return fallbackImage;
    }
    
    // If the place has a photo reference, use Google Places API
    if (place && place.photoRef) {
      return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${place.photoRef}&key=${apiKey}`;
    }
    
    // Fallback for places with direct imageUrl (if any)
    if (place && place.imageUrl) {
      return place.imageUrl;
    }
    
    // Default fallback image
    return fallbackImage;
  };

  // Preload images to ensure they're cached and ready to display
  useEffect(() => {
    // Preload images for nearby places
    if (nearbyPlaces && nearbyPlaces.length > 0) {
      nearbyPlaces.forEach(place => {
        if (place.imageUrl) {
          const img = new Image();
          img.src = place.imageUrl;
        }
      });
    }
    
    // Preload images for distant places
    if (distantPlaces && distantPlaces.length > 0) {
      distantPlaces.forEach(place => {
        if (place.imageUrl) {
          const img = new Image();
          img.src = place.imageUrl;
        }
      });
    }
  }, [nearbyPlaces, distantPlaces]);

  // Click handler for document to hide suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      const searchBox = document.querySelector('.search-box');
      if (searchBox && !searchBox.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Handle Explore button click - stores data to sessionStorage and navigates to summary page
  const handleExploreClick = (place) => {
    // Ensure coordinates are valid
    if (!userCoords || !userCoords.lat || !userCoords.lng) {
      console.error("Invalid origin coordinates:", userCoords);
      alert("Could not determine your location coordinates. Please try searching again.");
      return;
    }
    
    if (!place.lat || !place.lng) {
      console.error("Invalid destination coordinates:", place);
      alert("Destination coordinates are invalid. Please try another destination.");
      return;
    }
    
    // Log coordinates for debugging
    console.log("Storing trip data with coordinates:", {
      origin: {
        name: searchQuery,
        coords: userCoords
      },
      destination: {
        name: place.name,
        coords: { lat: place.lat, lng: place.lng }
      }
    });
    
    // Store trip data in sessionStorage for the prebuilt route page to use
    sessionStorage.setItem('packageTrip', JSON.stringify({
      origin: searchQuery, // Current location
      destination: place.name,
      originCoords: userCoords,
      destinationCoords: { lat: place.lat, lng: place.lng },
      distance: place.distance
    }));
    
    // Navigate to prebuilt route page
    navigate('/prebuilt');
  };

  return (
    <>
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

      <section className="hero"></section>

      <div className="location-search-container">
        <div className="location-search-wrapper">
          <form onSubmit={handleLocationSearch} className="search-box">
            <input
              type="text"
              placeholder="Search destinations..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleSearchInputFocus}
              ref={searchInputRef}
            />
            <button type="submit" className="search-button">Search</button>
            
            {showSuggestions && suggestions.length > 0 && (
              <div className="location-suggestions">
                {suggestions.map((suggestion) => (
                  <div 
                    key={suggestion.place_id} 
                    className="location-suggestion-item"
                    onClick={() => handleLocationSelect(suggestion)}
                  >
                    {suggestion.display_name}
                  </div>
                ))}
          </div>
            )}
          </form>
          <button
            className="current-location-btn"
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  async (position) => {
                    const coords = {
                      lat: position.coords.latitude,
                      lng: position.coords.longitude
                    };
                    setUserCoords(coords);
                    
                    // Reverse geocode to get location name
                    try {
                      const response = await axios.get(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.lat}&lon=${coords.lng}&zoom=10`
                      );
                      if (response.data && response.data.display_name) {
                        setSearchQuery(response.data.display_name);
                        sessionStorage.setItem("location", response.data.display_name);
                      }
                    } catch (err) {
                      console.error("Error reverse geocoding:", err);
                    }
                    
                    fetchPlaces(coords);
                  },
                  (err) => {
                    console.error("Geolocation error:", err);
                    setError("Unable to get your location. Please enter a location in the search box.");
                  }
                );
              }
            }}
          >
            <IoLocationSharp size={20} />
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <div className="loading-container">
          <p>Loading places...</p>
        </div>
      ) : (
        <>
          {/* Nearby Places Section */}
      <section className="featured-packages">
        <h2>Featured Travel Packages</h2>
            <h4>{userCoords ? 'Places near you (within 80km)' : 'Location not available'}</h4>
        <div className="package-grid">
              {nearbyPlaces.length > 0 ? (
                nearbyPlaces.map((place, index) => (
                  <div className="package-card" key={`nearby-${index}`}>
                    <div 
                      className="card-image" 
                      style={{ 
                        backgroundImage: `url(${place.photoRef ? getPhotoUrl(place) : fallbackImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    ></div>
            <div className="card-content">
                      <h3>{place.name}</h3>
                      <h5>{place.distance} km</h5>
                      <button 
                        className="explore-btn"
                        onClick={() => handleExploreClick(place)}
                      >
                        Explore
                      </button>
            </div>
          </div>
                ))
              ) : userCoords ? (
                <div className="no-places-message">
                  <p>No nearby places found within 80km of your location.</p>
            </div>
              ) : null}
        </div>
      </section>

          {/* Distant Places Section */}
      <section className="featured-packages">
            <h4>{userCoords ? 'Famous tourist spots (80km - 1000km)' : 'Location not available'}</h4>
        <div className="package-grid">
              {distantPlaces.length > 0 ? (
                distantPlaces.map((place, index) => (
                  <div className="package-card" key={`distant-${index}`}>
                    <div 
                      className="card-image" 
                      style={{ 
                        backgroundImage: `url(${place.photoRef ? getPhotoUrl(place) : fallbackImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    ></div>
            <div className="card-content">
                      <h3>{place.name}</h3>
                      <h5>{place.distance} km</h5>
                      <button 
                        className="explore-btn"
                        onClick={() => handleExploreClick(place)}
                      >
                        Explore
                      </button>
            </div>
          </div>
                ))
              ) : userCoords ? (
                <div className="no-places-message">
                  <p>No tourist spots found between 80km and 1000km of your location.</p>
            </div>
              ) : null}
        </div>
      </section>
        </>
      )}
    </>
  );
};

export default TravelPackage;