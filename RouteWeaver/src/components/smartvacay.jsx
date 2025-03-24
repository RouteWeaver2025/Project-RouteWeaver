import React, { useState, useEffect } from 'react';
import { FiRefreshCw } from 'react-icons/fi';
import { FaMapMarkerAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Smart Vacation Planner component
const SmartVacay = ({ currentMonth, currentYear, holidays, location }) => {
  const navigate = useNavigate();
  const [vacationSuggestions, setVacationSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [destinationsError, setDestinationsError] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [startingLocation, setStartingLocation] = useState(location);
  const [tripLength, setTripLength] = useState(0);
  const [destinationSuggestions, setDestinationSuggestions] = useState([]);
  const [selectedDestination, setSelectedDestination] = useState(null);

  // Function to determine if a date is a weekend
  const isWeekend = (year, month, day) => {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // 0 is Sunday, 6 is Saturday
  };

  // Function to find holiday and weekend dates in the current month
  const findAvailableDates = () => {
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const availableDates = [];

    // Add weekends
    for (let day = 1; day <= daysInMonth; day++) {
      if (isWeekend(currentYear, currentMonth, day)) {
        availableDates.push({
          day,
          isHoliday: false,
          isWeekend: true,
          description: 'Weekend'
        });
      }
    }

    // Add holidays
    if (holidays && holidays.length > 0) {
      holidays.forEach(holiday => {
        const holidayDate = new Date(holiday.date);
        if (holidayDate.getMonth() === currentMonth && holidayDate.getFullYear() === currentYear) {
          const day = holidayDate.getDate();
          
          // Check if this date is already in our array (might be a weekend)
          const existingIndex = availableDates.findIndex(d => d.day === day);
          
          if (existingIndex !== -1) {
            // Update existing entry to mark as holiday
            availableDates[existingIndex].isHoliday = true;
            availableDates[existingIndex].description = holiday.summary;
          } else {
            // Add new holiday
            availableDates.push({
              day,
              isHoliday: true,
              isWeekend: false,
              description: holiday.summary
            });
          }
        }
      });
    }

    // Sort dates by day
    return availableDates.sort((a, b) => a.day - b.day);
  };

  // Function to find consecutive dates in the available dates
  const findConsecutiveDates = (dates) => {
    const consecutiveGroups = [];
    let currentGroup = [dates[0]];

    for (let i = 1; i < dates.length; i++) {
      if (dates[i].day === dates[i-1].day + 1) {
        // These days are consecutive
        currentGroup.push(dates[i]);
      } else {
        // Start a new group
        if (currentGroup.length > 0) {
          consecutiveGroups.push([...currentGroup]);
        }
        currentGroup = [dates[i]];
      }
    }

    // Add the last group if it's not empty
    if (currentGroup.length > 0) {
      consecutiveGroups.push(currentGroup);
    }

    return consecutiveGroups;
  };

  // Function to determine distance range based on consecutive days
  const getDistanceRange = (daysCount) => {
    if (daysCount === 1) {
      return { min: 50, max: 200 }; // 50-200 km for single day trips
    } else if (daysCount === 2) {
      return { min: 150, max: 400 }; // 150-400 km for 2-day trips
    } else if (daysCount <= 4) {
      return { min: 300, max: 800 }; // 300-800 km for 3-4 day trips
    } else {
      return { min: 500, max: 2000 }; // 500+ km for longer trips
    }
  };

  // Fetch destinations from API based on trip length
  async function fetchDestinations(location, tripLength) {
    if (!location) {
      console.error("Location is required to fetch destinations");
      return [];
    }

    setIsLoadingDestinations(true);
    setDestinationsError(null);
    
    // Determine trip type based on trip length
    let tripType = "medium";
    if (tripLength <= 2) {
      tripType = "short"; 
    } else if (tripLength <= 4) {
      tripType = "medium";
    } else {
      tripType = "long";
    }
    
    console.log(`Fetching ${tripType} trip destinations for ${location}`);
    
    try {
      // Use the correct API URL
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(
        `${baseUrl}/api/landmarks/vacationDestinations?location=${encodeURIComponent(location)}&tripType=${tripType}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      console.log("Received destinations:", data.destinations);
      
      return data.destinations || [];
    } catch (error) {
      console.error("Error fetching destinations:", error);
      setDestinationsError("Failed to fetch destinations. Using backup options.");
      
      // Fall back to hardcoded options if API fails
      return getFallbackDestinations(tripType);
    } finally {
      setIsLoadingDestinations(false);
    }
  }

  // Fallback destinations when API fails
  function getFallbackDestinations(tripType) {
    // Make sure tripType is a string to avoid undefined issues
    const tripTypeStr = String(tripType || "").toLowerCase();
    
    const fallbacks = {
      short: [
        { name: "Munnar, Kerala", distance: 70, coords: { lat: 10.0889, lng: 77.0595 } },
        { name: "Coorg, Karnataka", distance: 120, coords: { lat: 12.4244, lng: 75.7382 } },
        { name: "Pondicherry", distance: 150, coords: { lat: 11.9416, lng: 79.8083 } },
      ],
      medium: [
        { name: "Goa", distance: 250, coords: { lat: 15.2993, lng: 74.1240 } },
        { name: "Ooty, Tamil Nadu", distance: 200, coords: { lat: 11.4102, lng: 76.6950 } },
        { name: "Varanasi, Uttar Pradesh", distance: 300, coords: { lat: 25.3176, lng: 82.9739 } },
      ],
      long: [
        { name: "Shimla, Himachal Pradesh", distance: 450, coords: { lat: 31.1048, lng: 77.1734 } },
        { name: "Jaipur, Rajasthan", distance: 500, coords: { lat: 26.9124, lng: 75.7873 } },
        { name: "Manali, Himachal Pradesh", distance: 480, coords: { lat: 32.2432, lng: 77.1892 } },
      ]
    };
    
    // Determine which category to use based on trip length (if numeric) or type string
    let category = 'medium'; // Default to medium
    
    if (tripTypeStr === 'short' || tripTypeStr === '1' || tripTypeStr === '2' || parseInt(tripTypeStr) <= 2) {
      category = 'short';
    } else if (tripTypeStr === 'medium' || tripTypeStr === '3' || tripTypeStr === '4' || (parseInt(tripTypeStr) > 2 && parseInt(tripTypeStr) <= 4)) {
      category = 'medium';
    } else if (tripTypeStr === 'long' || tripTypeStr === '5' || parseInt(tripTypeStr) > 4) {
      category = 'long';
    }
    
    console.log(`Getting fallback destinations for trip type: ${tripTypeStr} (using category: ${category})`);
    
    return fallbacks[category] || fallbacks.medium;
  }

  // Function to fetch vacation suggestions
  const fetchVacationSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      // Find available dates (weekends and holidays)
      const availableDates = findAvailableDates();
      
      // If no available dates, return early
      if (availableDates.length === 0) {
        setVacationSuggestions([]);
        setLoading(false);
        return;
      }
      
      // Find consecutive date groups
      const consecutiveGroups = findConsecutiveDates(availableDates);
      
      // Randomly select up to 4 date groups (prioritize longer durations)
      const sortedGroups = [...consecutiveGroups].sort((a, b) => b.length - a.length);
      const selectedGroups = sortedGroups.slice(0, Math.min(4, sortedGroups.length));
      
      // Fetch destinations for each selected group
      const suggestions = await Promise.all(
        selectedGroups.map(async (group) => {
          const daysCount = group.length;
          const distanceRange = getDistanceRange(daysCount);
          
          // Format the date range
          const startDate = new Date(currentYear, currentMonth, group[0].day);
          const endDate = new Date(currentYear, currentMonth, group[group.length - 1].day);
          
          // Format dates as strings
          const startDateStr = startDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          const endDateStr = endDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          });
          
          // Determine if it's a single day or multiple days
          const dateText = startDateStr === endDateStr ? 
            startDateStr : 
            `${startDateStr} - ${endDateStr}`;
          
          try {
            // Fetch destination from backend
            const response = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/landmarks/popularDestinations`, {
              params: {
                origin: location,
                minDistance: distanceRange.min,
                maxDistance: distanceRange.max,
                limit: 1
              }
            });
            
            // Properly handle the destination data
            let destination;
            if (response.data && response.data.destinations && response.data.destinations.length > 0) {
              destination = response.data.destinations[0];
              console.log("Received destination:", destination);
            } else {
              // If no destination was found, create a fallback with a real place name
              // Get fallback destinations for this trip length
              const fallbackDestinations = getFallbackDestinations(daysCount);
              // Select a random destination from the array
              const randomIndex = Math.floor(Math.random() * fallbackDestinations.length);
              destination = fallbackDestinations[randomIndex];
              
              console.warn("No destinations returned from API, using fallback destination:", destination.name);
            }
            
            return {
              id: `${startDate.getTime()}-${endDate.getTime()}`,
              dates: dateText,
              days: daysCount,
              destination: destination.name,
              distance: destination.distance,
              description: group.map(d => d.description).join(', '),
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              origin: location,
              coords: destination.coords || null
            };
          } catch (error) {
            console.error('Error fetching destination:', error);
            
            // Create a fallback destination with a real place name
            const fallbackDestinations = getFallbackDestinations(daysCount);
            // Select a random destination from the array
            const randomIndex = Math.floor(Math.random() * fallbackDestinations.length);
            const fallbackDestination = fallbackDestinations[randomIndex];
            
            return {
              id: `${startDate.getTime()}-${endDate.getTime()}`,
              dates: dateText,
              days: daysCount,
              destination: fallbackDestination.name,
              distance: fallbackDestination.distance,
              description: 'Could not fetch destination details',
              startDate: startDate.toISOString().split('T')[0],
              endDate: endDate.toISOString().split('T')[0],
              origin: location,
              coords: fallbackDestination.coords || null
            };
          }
        })
      );
      
      setVacationSuggestions(suggestions);
    } catch (error) {
      console.error('Error generating vacation suggestions:', error);
      setError('Failed to generate vacation suggestions');
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion click to navigate to summary
  const handleSuggestionClick = (suggestion) => {
    // Store suggestion data in sessionStorage for the summary page
    sessionStorage.setItem('vacayTrip', JSON.stringify({
      origin: suggestion.origin,
      destination: suggestion.destination,
      startDate: suggestion.startDate,
      endDate: suggestion.endDate,
      days: suggestion.days,
      distance: suggestion.distance,
      coords: suggestion.coords
    }));
    
    // Navigate to summary page with special parameter
    navigate('/summary/vacay');
  };

  // Effect to handle vacation suggestions when dates or location changes
  useEffect(() => {
    // Skip if incomplete data
    if (!startDate || !endDate || !startingLocation) {
      setDestinationSuggestions([]);
      setSelectedDestination(null);
      return;
    }

    // Calculate vacation days
    const days = calculateTripDays(startDate, endDate);
    setTripLength(days);

    // Get vacation suggestions
    fetchVacationSuggestions();
  }, [startDate, endDate, startingLocation]);

  // New effect to fetch destinations when location and trip length change
  useEffect(() => {
    // Only fetch destinations when we have a starting location and valid trip length
    if (startingLocation && tripLength > 0) {
      // Fetch destinations from API
      fetchDestinations(startingLocation, tripLength)
        .then(destinationOptions => {
          setDestinationSuggestions(destinationOptions);
          
          // If we have suggestions and there's no selected destination yet, auto-select the first one
          if (destinationOptions.length > 0 && !selectedDestination) {
            handleDestinationSelect(destinationOptions[0]);
          }
        });
    }
  }, [startingLocation, tripLength]);

  // Handle refresh button click
  const handleRefresh = () => {
    fetchVacationSuggestions();
  };
  
  // Handle destination selection
  const handleDestinationSelect = (destination) => {
    setSelectedDestination(destination);
    
    // Create vacay trip object with selected destination details
    if (destination && startingLocation && tripLength > 0) {
      const vacayTrip = {
        origin: startingLocation,
        destination: destination.name,
        days: tripLength,
        distance: destination.distance,
        coords: destination.coords,
        startDate: startDate,
        endDate: endDate
      };
      
      // Store in session storage for the summary page
      sessionStorage.setItem('vacayTrip', JSON.stringify(vacayTrip));
      console.log('Stored vacation trip in session storage:', vacayTrip);
      
      // Also notify parent component if onDestinationSelect prop exists
      if (onDestinationSelect && typeof onDestinationSelect === 'function') {
        onDestinationSelect(destination);
      }
    }
  };

  // Function to view selected route
  const viewSelectedRoute = () => {
    if (selectedDestination) {
      navigate('/summary/vacay');
    } else {
      alert('Please select a destination first');
    }
  };

  // Function to calculate trip days between two dates
  const calculateTripDays = (start, end) => {
    if (!start || !end) return 0;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Get difference in milliseconds and convert to days
    const diffTime = Math.abs(endDate - startDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Add 1 to include both start and end days
    return diffDays + 1;
  };

  // If location is not available, show search prompt
  if (!location) {
    return (
      <div className="no-start-message">
        <h3>Enter your starting location</h3>
        <p>We'll suggest vacation spots based on your location</p>
      </div>
    );
  }

  return (
    <div className="smart-vacay-container">
      <div className="smart-vacay-header">
        <h3>Smart Vacations</h3>
        <button 
          className="refresh-button" 
          onClick={handleRefresh} 
          title="Refresh suggestions"
          aria-label="Refresh suggestions"
        >
          <FiRefreshCw size={18} />
        </button>
      </div>
      
      {loading ? (
        <div className="loading-spinner">Loading suggestions...</div>
      ) : error ? (
        <div className="error-message">{error}</div>
      ) : vacationSuggestions.length === 0 ? (
        <div className="no-suggestions">No vacation dates available this month</div>
      ) : (
        <div className="suggestion-list">
          {vacationSuggestions.map((suggestion) => (
            <div 
              key={suggestion.id} 
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              <div className="suggestion-dates">{suggestion.dates}</div>
              <div className="suggestion-destination">
                <FaMapMarkerAlt className="destination-icon" />
                {suggestion.destination}
              </div>
              <div className="suggestion-details">
                <span className="days-count">{suggestion.days} day{suggestion.days !== 1 ? 's' : ''}</span>
                {suggestion.distance > 0 && (
                  <span className="distance">{Math.round(suggestion.distance)} km</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Custom Date Selection */}
      <div className="date-selection">
        <h3>Plan Your Custom Trip</h3>
        <div className="date-inputs">
          <div className="date-field">
            <label htmlFor="start-date">Start Date</label>
            <input 
              type="date" 
              id="start-date"
              value={startDate || ''}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="date-field">
            <label htmlFor="end-date">End Date</label>
            <input 
              type="date" 
              id="end-date"
              value={endDate || ''}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        {startDate && endDate && (
          <div className="trip-length-display">
            Trip length: <strong>{calculateTripDays(startDate, endDate)}</strong> days
          </div>
        )}
      </div>

      {/* Destination Suggestions Section */}
      <div className="destination-suggestions">
        <h3>Recommended Destinations</h3>
        
        {isLoadingDestinations ? (
          <div className="loading-destinations">
            <p>Finding the best destinations for your trip...</p>
          </div>
        ) : destinationSuggestions.length > 0 ? (
          <>
            <div className="suggestions-grid">
              {destinationSuggestions.map((destination, index) => (
                <div 
                  key={index}
                  className={`suggestion-card ${selectedDestination?.name === destination.name ? 'selected' : ''}`}
                  onClick={() => handleDestinationSelect(destination)}
                >
                  <h4>{destination.name}</h4>
                  <p>{destination.distance} km away</p>
                  {destination.rating && <p>Rating: {destination.rating} ⭐</p>}
                </div>
              ))}
            </div>
            
            {selectedDestination && (
              <div className="destination-actions">
                <button 
                  className="view-route-btn"
                  onClick={viewSelectedRoute}
                >
                  View Route to {selectedDestination.name}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="no-destinations">
            {destinationsError || "No destinations found. Try a different location or trip length."}
          </div>
        )}
      </div>
    </div>
  );
};

export default SmartVacay;
