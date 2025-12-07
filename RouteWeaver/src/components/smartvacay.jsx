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
  const [refreshCount, setRefreshCount] = useState(0);
  const [allFetchedDestinations, setAllFetchedDestinations] = useState([]);
  const [currentDestinationSet, setCurrentDestinationSet] = useState(0); // 0 = first set, 1 = second set

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
        
        // Limit to max 2 days per group
        if (currentGroup.length === 2) {
          consecutiveGroups.push([...currentGroup]);
          currentGroup = [];
          // Skip to next day
          continue;
        }
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

    // Also add individual days as 1-day trips
    for (let i = 0; i < dates.length; i++) {
      // Skip if this day is already part of a 2-day group
      if (consecutiveGroups.some(group => 
        group.length > 1 && group.some(d => d.day === dates[i].day)
      )) {
        continue;
      }
      
      // Add as a single-day trip
      consecutiveGroups.push([dates[i]]);
    }

    return consecutiveGroups;
  };

  // Function to fetch vacation destinations from the new backend endpoint
  const fetchVacayDestinations = async (location, days = 2) => {
    if (!location) {
      console.error("Location is required to fetch vacation destinations");
      return [];
    }

    setIsLoadingDestinations(true);
    setDestinationsError(null);
    
    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      console.log(`Fetching vacation destinations for ${location} with ${days} trip days`);
      
      const response = await axios.get(`${baseUrl}/smartvacay/suggestions`, {
        params: { 
          location,
          tripDays: days 
        }
      });
      
      if (response.data.success) {
        // Combine short, medium, and long distance places
        const allDestinations = [
          ...(response.data.shortDistance || []).map(place => ({
            ...place,
            distanceType: 'short'
          })),
          ...(response.data.mediumDistance || []).map(place => ({
            ...place,
            distanceType: 'medium'
          })),
          ...(response.data.longDistance || []).map(place => ({
            ...place,
            distanceType: 'long'
          }))
        ];
        
        // Format the destinations to match our expected format
        const formattedDestinations = allDestinations.map(place => ({
          name: place.name,
          description: place.description,
          distance: extractDistanceFromDescription(place.description) || 100, // fallback distance
          lat: place.coordinates.latitude,
          lng: place.coordinates.longitude,
          distanceType: place.distanceType
        }));
        
        // Limit to 4 destinations for display, but make sure we include a mix of distances
        // based on the trip duration
        return selectOptimalDestinations(formattedDestinations, days);
      } else {
        throw new Error(response.data.error || "Failed to fetch destinations");
      }
    } catch (error) {
      console.error("Error fetching vacation destinations:", error);
      setDestinationsError("Failed to fetch destinations. Using backup options.");
      
      // Fall back to hardcoded options if API fails
      return getFallbackDestinations(days);
    } finally {
      setIsLoadingDestinations(false);
    }
  };

  // Helper function to extract distance from description
  const extractDistanceFromDescription = (description) => {
    if (!description) return null;
    
    const matches = description.match(/(\d+(?:\.\d+)?)\s*km/i);
    if (matches && matches[1]) {
      return parseFloat(matches[1]);
    }
    return null;
  };

  // Helper function to select optimal mix of destinations based on trip duration and distance
  const selectOptimalDestinations = (destinations, days) => {
    // Group destinations by type
    const shortDist = destinations.filter(d => d.distanceType === 'short');
    const mediumDist = destinations.filter(d => d.distanceType === 'medium');
    const longDist = destinations.filter(d => d.distanceType === 'long');
    
    // Sort each group by actual distance
    shortDist.sort((a, b) => a.distance - b.distance);
    mediumDist.sort((a, b) => a.distance - b.distance);
    longDist.sort((a, b) => a.distance - b.distance);
    
    let firstSet = [];
    let secondSet = [];
    
    if (days === 1) {
      // 1-day trip: Focus on closer destinations (up to ~100km)
      // First set: 3 short, 1 medium
      firstSet = [
        ...shortDist.filter(d => d.distance <= 80).slice(0, 3),
        ...mediumDist.filter(d => d.distance <= 100).slice(0, 1)
      ];
      // Second set: 2 short, 2 medium (slightly farther but still doable in a day)
      secondSet = [
        ...shortDist.filter(d => d.distance <= 80).slice(3, 5),
        ...mediumDist.filter(d => d.distance <= 100).slice(1, 3)
      ];
    } else {
      // 2-day trip: Include medium to longer distances (100-400km)
      // First set: 1 short, 2 medium, 1 long
      firstSet = [
        ...shortDist.slice(0, 1),
        ...mediumDist.filter(d => d.distance > 100 && d.distance <= 200).slice(0, 2),
        ...longDist.filter(d => d.distance > 200 && d.distance <= 400).slice(0, 1)
      ];
      // Second set: 1 medium, 3 long
      secondSet = [
        ...mediumDist.filter(d => d.distance > 100 && d.distance <= 200).slice(2, 3),
        ...longDist.filter(d => d.distance > 200 && d.distance <= 400).slice(1, 4)
      ];
    }
    
    // Fill sets if they don't have enough destinations
    const fillSet = (set, targetCount) => {
      if (set.length >= targetCount) return set.slice(0, targetCount);
      
      // Combined leftover destinations that aren't in this set
      const allLeftovers = [
        ...shortDist.filter(d => !set.some(s => s.name === d.name)),
        ...mediumDist.filter(d => !set.some(s => s.name === d.name)),
        ...longDist.filter(d => !set.some(s => s.name === d.name))
      ];
      
      // Add enough to reach the target count
      return [...set, ...allLeftovers.slice(0, targetCount - set.length)].slice(0, targetCount);
    };
    
    firstSet = fillSet(firstSet, 4);
    secondSet = fillSet(secondSet, 4);
    
    // Make sure destinations in second set aren't duplicates of first set
    secondSet = secondSet.filter(d => !firstSet.some(f => f.name === d.name));
    secondSet = fillSet(secondSet, 4);
    
    // Return both sets, 8 destinations total
    return [...firstSet, ...secondSet];
  };

  // Fallback destinations when API fails - adjusted for trip duration
  function getFallbackDestinations(days = 2) {
    // Default fallbacks for different trip durations
    const shortTrips = [
      { name: "Wagamon, Kerala", description: "Hill station at 35 km", distance: 35, lat: 9.6867, lng: 76.9344, distanceType: 'short' },
      { name: "Peerumedu, Kerala", description: "Hill station at 50 km", distance: 50, lat: 9.5722, lng: 77.0215, distanceType: 'short' },
      { name: "Vazhikkadavu, Kerala", description: "Scenic village at 65 km", distance: 65, lat: 9.7211, lng: 77.1231, distanceType: 'short' },
      { name: "Munnar, Kerala", description: "Hill station at 85 km", distance: 85, lat: 10.0889, lng: 77.0595, distanceType: 'medium' }
    ];
    
    const mediumTrips = [
      { name: "Vagamon, Kerala", description: "Hill station at 45 km", distance: 45, lat: 9.6867, lng: 76.9344, distanceType: 'short' },
      { name: "Munnar, Kerala", description: "Hill station at 85 km", distance: 85, lat: 10.0889, lng: 77.0595, distanceType: 'medium' },
      { name: "Thekkady, Kerala", description: "Wildlife sanctuary at 110 km", distance: 110, lat: 9.5833, lng: 77.1667, distanceType: 'medium' },
      { name: "Alleppey, Kerala", description: "Backwaters at 150 km", distance: 150, lat: 9.4981, lng: 76.3388, distanceType: 'long' }
    ];
    
    const longTrips = [
      { name: "Munnar, Kerala", description: "Hill station at 85 km", distance: 85, lat: 10.0889, lng: 77.0595, distanceType: 'medium' },
      { name: "Thekkady, Kerala", description: "Wildlife sanctuary at 110 km", distance: 110, lat: 9.5833, lng: 77.1667, distanceType: 'medium' },
      { name: "Wayanad, Kerala", description: "Hill district at 250 km", distance: 250, lat: 11.6854, lng: 76.1320, distanceType: 'long' },
      { name: "Kovalam, Kerala", description: "Beach resort at 285 km", distance: 285, lat: 8.4004, lng: 76.9787, distanceType: 'long' }
    ];
    
    if (days <= 2) return shortTrips;
    if (days <= 4) return mediumTrips;
    return longTrips;
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
      
      // Find consecutive date groups (now limited to 1-2 days)
      const consecutiveGroups = findConsecutiveDates(availableDates);
      
      // Sort by day (to ensure variety in dates) then select several
      // This ensures we don't always use the same date range for all suggestions
      const sortedGroups = [...consecutiveGroups].sort((a, b) => a[0].day - b[0].day);
      
      // Select a variety of 1-day and 2-day periods spaced throughout the month
      const twoDay = sortedGroups.filter(g => g.length === 2).slice(0, 2); // Take 2 two-day periods
      const oneDay = sortedGroups.filter(g => g.length === 1)
        .filter(g => !twoDay.some(td => td.some(d => Math.abs(d.day - g[0].day) <= 3))) // Not too close to 2-day periods
        .slice(0, 3); // Take up to 3 one-day periods
        
      const selectedGroups = [...twoDay, ...oneDay].sort((a, b) => a[0].day - b[0].day);
      
      // Create array of destinations for each group based on trip duration
      const destinationsPromises = selectedGroups.map(async (group) => {
        // Get number of days for this group
        const daysCount = group.length;
        return await fetchVacayDestinations(startingLocation, daysCount);
      });
      
      // Wait for all destination queries to complete
      const destinationsResults = await Promise.all(destinationsPromises);
      
      // Store all destinations for each group
      const allGroupDestinations = destinationsResults.map((destinations, index) => {
        const group = selectedGroups[index];
        const daysCount = group.length;
        
        // Map each destination to a suggestion object
        return destinations.map(destination => {
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
          
          // For 1-day trips, prefer destinations under 100km
          // For 2-day trips, prefer destinations between 100-400km
          let distanceScore = 0;
          if (daysCount === 1 && destination.distance <= 100) {
            distanceScore = 100 - destination.distance; // Higher score for closer places on 1-day trips
          } else if (daysCount === 2 && destination.distance > 100 && destination.distance <= 400) {
            distanceScore = 400 - Math.abs(250 - destination.distance); // Score peaks around 250km for 2-day trips
          }
          
          return {
            id: `${startDate.getTime()}-${endDate.getTime()}-${destination.name}`,
            dates: dateText,
            days: daysCount,
            destination: destination.name,
            distance: destination.distance,
            description: group.map(d => d.description).join(', '),
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            origin: startingLocation,
            coords: {
              lat: destination.lat,
              lng: destination.lng
            },
            distanceScore // Used for sorting
          };
        });
      }).flat(); // Flatten the array of arrays
      
      // Sort all destinations by distanceScore to ensure best matches for each day count
      allGroupDestinations.sort((a, b) => b.distanceScore - a.distanceScore);
      
      // Process all destination sets into two distinct sets of suggestions
      const oneDaySuggestions = allGroupDestinations.filter(s => s.days === 1).slice(0, 8);
      const twoDaySuggestions = allGroupDestinations.filter(s => s.days === 2).slice(0, 8);
      
      // We want a mix of 1-day and 2-day trips in each set
      const allSuggestions = [];
      
      // Add 1-day suggestions (half to set 0, half to set 1)
      const midOneDay = Math.floor(oneDaySuggestions.length / 2);
      oneDaySuggestions.slice(0, midOneDay).forEach(s => allSuggestions.push({...s, set: 0}));
      oneDaySuggestions.slice(midOneDay).forEach(s => allSuggestions.push({...s, set: 1}));
      
      // Add 2-day suggestions (half to set 0, half to set 1)
      const midTwoDay = Math.floor(twoDaySuggestions.length / 2);
      twoDaySuggestions.slice(0, midTwoDay).forEach(s => allSuggestions.push({...s, set: 0}));
      twoDaySuggestions.slice(midTwoDay).forEach(s => allSuggestions.push({...s, set: 1}));
      
      // Store all fetched destinations
      setAllFetchedDestinations(allSuggestions);
      
      // Show the first set of destinations initially
      setCurrentDestinationSet(0);
      const firstSetSuggestions = allSuggestions
        .filter(s => s.set === 0)
        .slice(0, 4);
        
      setVacationSuggestions(firstSetSuggestions);
      
      // Reset refresh count
      setRefreshCount(0);
    } catch (error) {
      console.error('Error generating vacation suggestions:', error);
      setError('Failed to generate vacation suggestions');
    } finally {
      setLoading(false);
    }
  };

  // Handle suggestion click to navigate to prebuilt route
  const handleSuggestionClick = async (suggestion) => {
    try {
      // Get coordinates for the origin
      let originCoords = null;
      
      // Try to get coordinates from Nominatim
      if (suggestion.origin) {
        console.log(`Getting coordinates for origin: ${suggestion.origin}`);
        
        // Add Kerala, India to improve geocoding accuracy if not already included
        const searchQuery = suggestion.origin.toLowerCase().includes('kerala') ? 
          suggestion.origin : 
          `${suggestion.origin}, Kerala, India`;
        
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
        const data = await response.json();
        
        if (data && data.length > 0) {
          originCoords = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon)
          };
          console.log("Retrieved origin coordinates:", originCoords);
          
          // Validate the coordinates
          if (isNaN(originCoords.lat) || isNaN(originCoords.lng) ||
              Math.abs(originCoords.lat) < 0.1 && Math.abs(originCoords.lng) < 0.1) {
            console.error("Invalid coordinates received from Nominatim");
            originCoords = null;
          }
        }
      }
      
      // If we couldn't get valid coordinates, use a fallback for Kerala
      if (!originCoords) {
        console.warn("Using fallback coordinates for Kerala");
        originCoords = {
          lat: 10.8505, // Fallback to central Kerala coordinates
          lng: 76.2711
        };
      }
      
      // Log for debugging
      console.log("Final originCoords being stored:", originCoords);
      console.log("Destination coords being stored:", suggestion.coords);
      
      // Store suggestion data in sessionStorage for the prebuilt page to use
      sessionStorage.setItem('packageTrip', JSON.stringify({
        origin: suggestion.origin,
        destination: suggestion.destination,
        startDate: suggestion.startDate,
        endDate: suggestion.endDate,
        days: suggestion.days,
        distance: suggestion.distance,
        originCoords: originCoords,
        destinationCoords: suggestion.coords // Rename to be consistent with travelpackage.jsx
      }));
      
      // Navigate to prebuilt route page
      navigate('/prebuilt');
    } catch (error) {
      console.error("Error getting origin coordinates:", error);
      alert("There was an issue getting coordinates for your trip. Please try again.");
    }
  };

  // Effect to fetch vacation suggestions when location changes
  useEffect(() => {
    if (startingLocation) {
      fetchVacationSuggestions();
    }
  }, [startingLocation, currentMonth, currentYear]);

  // Handle location from sessionStorage
  useEffect(() => {
    const storedLocation = sessionStorage.getItem('location');
    if (storedLocation && !startingLocation) {
      setStartingLocation(storedLocation);
    }
  }, []);

  // Handle refresh button click
  const handleRefresh = () => {
    const newRefreshCount = refreshCount + 1;
    setRefreshCount(newRefreshCount);
    
    if (newRefreshCount >= 3) {
      // On third refresh, show premium alert
      alert("Premium subscription required to see more vacation suggestions.");
      return;
    }
    
    if (newRefreshCount === 1) {
      // On first refresh, show second set
      setCurrentDestinationSet(1);
      const secondSetSuggestions = allFetchedDestinations.filter(s => s.set === 1);
      setVacationSuggestions(secondSetSuggestions.slice(0, 4));
    } else if (newRefreshCount === 2) {
      // On second refresh, fetch new destinations
      fetchVacationSuggestions();
    }
  };
  
  // Handle destination selection for custom trip planning
  const handleDestinationSelect = async (destination) => {
    setSelectedDestination(destination);
    
    // Calculate trip length if dates are selected
    let tripDays = 0;
    if (startDate && endDate) {
      tripDays = calculateTripDays(startDate, endDate);
    }
  };

  // Function to view selected route
  const viewSelectedRoute = async () => {
    if (selectedDestination) {
      try {
        // Get coordinates for the origin
        let originCoords = null;
        
        if (startingLocation) {
          console.log(`Getting coordinates for origin: ${startingLocation}`);
          
          // Add Kerala, India to improve geocoding accuracy if not already included
          const searchQuery = startingLocation.toLowerCase().includes('kerala') ? 
            startingLocation : 
            `${startingLocation}, Kerala, India`;
          
          const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
          const data = await response.json();
          
          if (data && data.length > 0) {
            originCoords = {
              lat: parseFloat(data[0].lat),
              lng: parseFloat(data[0].lon)
            };
            console.log("Retrieved origin coordinates for custom trip:", originCoords);
            
            // Validate the coordinates
            if (isNaN(originCoords.lat) || isNaN(originCoords.lng) ||
                Math.abs(originCoords.lat) < 0.1 && Math.abs(originCoords.lng) < 0.1) {
              console.error("Invalid coordinates received from Nominatim");
              originCoords = null;
            }
          }
        }
        
        // If we couldn't get valid coordinates, use a fallback for Kerala
        if (!originCoords) {
          console.warn("Using fallback coordinates for Kerala");
          originCoords = {
            lat: 10.8505, // Fallback to central Kerala coordinates
            lng: 76.2711
          };
        }
        
        // Log for debugging
        console.log("Final originCoords being stored for custom trip:", originCoords);
        console.log("Destination coords being stored for custom trip:", {
          lat: selectedDestination.lat,
          lng: selectedDestination.lng
        });
        
        // Create package trip object with actual origin coordinates
        const packageTrip = {
          origin: startingLocation,
          destination: selectedDestination.name,
          startDate: startDate,
          endDate: endDate,
          days: tripLength || 2,
          distance: selectedDestination.distance,
          originCoords: originCoords,
          destinationCoords: { // Rename to be consistent with travelpackage.jsx
            lat: selectedDestination.lat,
            lng: selectedDestination.lng
          }
        };
        
        // Store in session storage for the prebuilt page
        sessionStorage.setItem('packageTrip', JSON.stringify(packageTrip));
        
        navigate('/prebuilt');
      } catch (error) {
        console.error("Error getting origin coordinates for custom trip:", error);
        alert("There was an issue getting coordinates for your trip. Please try again.");
      }
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

  // Effect to load custom destinations when custom trip dates change
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

    // Fetch destinations for custom trip based on trip length
    const fetchCustomDestinations = async () => {
      console.log(`Fetching custom destinations for ${days} day trip`);
      const destinations = await fetchVacayDestinations(startingLocation, days);
      setDestinationSuggestions(destinations);
      
      // Auto-select the first destination if none is selected
      if (destinations.length > 0 && !selectedDestination) {
        handleDestinationSelect(destinations[0]);
      }
    };
    
    fetchCustomDestinations();
  }, [startDate, endDate, startingLocation]);

  // Helper function to classify distance type based on kilometers
  const getDistanceType = (distance) => {
    if (distance <= 70) return 'short';
    if (distance <= 120) return 'medium';
    return 'long';
  };

  // If location is not available, show search prompt
  if (!startingLocation) {
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
                  <span className={`distance distance-${getDistanceType(suggestion.distance)}`}>
                    {Math.round(suggestion.distance)} km
                  </span>
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
                  className={`suggestion-card ${selectedDestination?.name === destination.name ? 'selected' : ''} distance-${destination.distanceType}`}
                  onClick={() => handleDestinationSelect(destination)}
                >
                  <h4>{destination.name}</h4>
                  <div className="distance-indicator">
                    <span className={`distance-badge ${destination.distanceType}`}>
                      {destination.distanceType === 'short' ? 'Nearby' : 
                       destination.distanceType === 'medium' ? 'Day Trip' : 'Long Trip'}
                    </span>
                    <span>{Math.round(destination.distance)} km</span>
                  </div>
                  <p>{destination.description}</p>
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
