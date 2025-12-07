import React, { useState, useEffect, useRef } from 'react';
import { FaRoad, FaUserCircle } from 'react-icons/fa';
import { IoLocationSharp } from 'react-icons/io5';
import '../design/homescreen.css';
import { useNavigate } from 'react-router-dom';
import SmartVacay from './smartvacay';
import axios from 'axios';

const HomePage = () => {
  const navigate = useNavigate();
  const [showDiagonal, setShowDiagonal] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const locationTimeoutRef = useRef(null);
  const [greeting, setGreeting] = useState('');
  const [username, setUsername] = useState('');

  // Handle sign out functionality
  const handleSignOut = () => {
    // Remove user data from localStorage and sessionStorage
    localStorage.removeItem('userEmail');
    sessionStorage.clear();
    // Navigate to login page
    navigate('/');
  };

  // Retrieve start location from session storage
  const [startLocation, setStartLocation] = useState(sessionStorage.getItem("location"));

  useEffect(() => {
    // Check if user is logged in
    const userEmail = localStorage.getItem("userEmail");
    if (!userEmail) {
      console.log("User not logged in, redirecting to login page");
      navigate("/");
      return;
    }
    
    // Animate elements on load
    setTimeout(() => setShowText(true), 900);
    setTimeout(() => setShowDiagonal(true), 1800);
    // Make the agency description visible without scrolling
    setTimeout(() => setShowDescription(true), 2500);

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      // Keep this for users who might scroll before the timeout
      if (window.scrollY > 100) {
        setShowDescription(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Set time-based greeting
  useEffect(() => {
    const updateGreeting = () => {
      const currentHour = new Date().getHours();
      let greetingText = '';
      
      if (currentHour >= 0 && currentHour < 12) {
        greetingText = 'Good Morning';
      } else if (currentHour >= 12 && currentHour < 16.5) {
        greetingText = 'Good Afternoon';
      } else {
        greetingText = 'Good Evening';
      }
      
      setGreeting(greetingText);
    };
    
    // Set initial greeting
    updateGreeting();
    
    // Update greeting every minute to handle time changes
    const intervalId = setInterval(updateGreeting, 60000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Fetch username if not in sessionStorage
  useEffect(() => {
    const storedUser = sessionStorage.getItem("user");
    
    if (storedUser) {
      setUsername(storedUser);
      console.log("Using username from sessionStorage:", storedUser);
    } else {
      const fetchUsername = async () => {
        try {
          // Get user email from sessionStorage or localStorage
          const userEmail = sessionStorage.getItem("userEmail") || localStorage.getItem("userEmail");
          console.log("Attempting to fetch username with email:", userEmail);
          
          if (userEmail) {
            const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
            // Fixed API path to match backend routes
            const response = await axios.get(`${baseUrl}/user/getProfile`, {
              params: { email: userEmail }
            });
            
            console.log("API response:", response.data);
            
            if (response.data && response.data.username) {
              setUsername(response.data.username);
              sessionStorage.setItem("user", response.data.username);
              console.log("Username set to:", response.data.username);
            } else {
              setUsername("User"); // Default if username not found
              console.log("No username found in API response");
            }
          } else {
            setUsername("User"); // Default if email not found
            console.log("No email found in sessionStorage or localStorage");
          }
        } catch (error) {
          console.error("Error fetching username:", error);
          setUsername("User"); // Default on error
        }
      };
      
      fetchUsername();
    }
  }, []);

  // Fetch holidays for the current month and year
  const fetchHolidays = async () => {
    try {
      const response = await axios.get(`https://www.googleapis.com/calendar/v3/calendars/en.indian%23holiday@group.v.calendar.google.com/events`, {
        params: {
          key: import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY,
          timeMin: new Date(currentYear, currentMonth, 1).toISOString(),
          timeMax: new Date(currentYear, currentMonth + 1, 0).toISOString(),
          singleEvents: true,
          orderBy: 'startTime'
        }
      });

      const events = response.data.items || [];
      const formattedHolidays = events.map(event => ({
        date: event.start.date,
        name: event.summary
      }));

      setHolidays(formattedHolidays);
      } catch (error) {
      console.error('Error fetching holidays:', error);
      
      // Fallback to hardcoded holidays for India in 2025
      const indianHolidays2025 = [
        { date: '2025-01-01', name: 'New Year\'s Day' },
        { date: '2025-01-26', name: 'Republic Day' },
        { date: '2025-03-14', name: 'Holi' },
        { date: '2025-04-13', name: 'Baisakhi' },
        { date: '2025-04-18', name: 'Good Friday' },
        { date: '2025-05-01', name: 'Labor Day' },
        { date: '2025-08-15', name: 'Independence Day' },
        { date: '2025-10-02', name: 'Gandhi Jayanti' },
        { date: '2025-10-23', name: 'Dussehra' },
        { date: '2025-11-12', name: 'Diwali' },
        { date: '2025-12-25', name: 'Christmas Day' }
      ];
      
      // Filter for current month
      const monthHolidays = indianHolidays2025.filter(holiday => {
        const holidayDate = new Date(holiday.date);
        return holidayDate.getMonth() === currentMonth && holidayDate.getFullYear() === currentYear;
      });
      
      console.log(`Using fallback holidays for ${currentMonth + 1}/${currentYear}:`, monthHolidays);
      setHolidays(monthHolidays);
    }
  };

  // Handle location input changes with OSRM autocomplete
  useEffect(() => {
    // Clear previous timeout to avoid multiple API calls
    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current);
    }

    // Only make API call if there's something to search for
    if (locationInput.length > 2) {
      locationTimeoutRef.current = setTimeout(async () => {
        try {
          const response = await axios.get(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationInput)}&limit=5`
          );
          setLocationSuggestions(response.data);
          setShowSuggestions(true);
        } catch (error) {
          console.error('Error fetching location suggestions:', error);
        }
      }, 500);
    } else {
      setLocationSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
      }
    };
  }, [locationInput]);

  // Handle location selection
  const handleLocationSelect = (location) => {
    const locationName = location.display_name;
    setLocationInput(locationName);
    setStartLocation(locationName);
    sessionStorage.setItem("location", locationName);
    setShowSuggestions(false);
  };

  // Function to change month
  const changeMonth = (increment) => {
    let newMonth = currentMonth + increment;
    let newYear = currentYear;
    
    if (newMonth < 0) {
      newMonth = 11;
      newYear--;
    } else if (newMonth > 11) {
      newMonth = 0;
      newYear++;
    }
    
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  // Month names
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  // Build calendar grid
  const buildCalendar = () => {
    const result = [];
    const date = new Date(currentYear, currentMonth, 1);
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const firstDayOfMonth = date.getDay(); // 0 for Sunday, 1 for Monday, etc.
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      result.push(null);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentYear, currentMonth, day);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      
      // Check if this day is a holiday
      const isHoliday = holidays.some(holiday => {
        const holidayDate = new Date(holiday.date);
        return holidayDate.getDate() === day;
      });
      
      result.push({
        day,
        isWeekend,
        isHoliday
      });
    }
    
    return result;
  };

  const calendar = buildCalendar();
  
  // Fetch fixed-date holidays from Google Calendar API when month or year changes
  useEffect(() => {
    fetchHolidays();
  }, [currentMonth, currentYear]);

  return (
    <div className="home-container">
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div>
          <button id="name" onClick={() => navigate('/home')}>
            RouteWeaver
          </button>
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
      
      <div className="hero-section">
        <div className="hero-content">
          <div className={`text-container ${showText ? 'show' : ''}`}>
            <p className='greeting'>{greeting} {username || 'User'}</p>
            <button className="new-routes" onClick={() => navigate('/queries')}>New Routes</button>
            <button className="saved-routes" onClick={() => navigate('/saver')}>Saved Routes</button>
            <div className={`diagonal-line ${showDiagonal ? 'show' : ''}`}></div>
          </div>
        </div>
      </div>
      
      {/* Agency Description */}
      <div className={`agency-description ${showDescription ? 'show' : ''}`}>
        <p>"Jobs fill your pocket,</p>
        <p>but adventures fill your soul."</p>
      </div>
      
      {/* Calendar Section */}
      <div className="calendar-section">
        <div className="calendar-box">
          <div className="calendar-container">
            <div className="calendar-header">
              <button onClick={() => changeMonth(-1)}>&lt;</button>
              <h2>{monthNames[currentMonth]} {currentYear}</h2>
              <button onClick={() => changeMonth(1)}>&gt;</button>
            </div>
            <div className="weekdays">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>
            <div className="calendar-grid">
              {calendar.map((day, index) => (
                <div 
                  key={index} 
                  className={`calendar-day 
                    ${!day ? 'empty' : ''} 
                    ${day?.isWeekend ? 'weekend' : ''} 
                    ${day?.isHoliday ? 'holiday' : ''}`}
                  title={day?.isHoliday ? 
                    holidays.find(h => new Date(h.date).getDate() === day.day)?.name || '' 
                    : ''}
                >
                  {day?.day}
                </div>
              ))}
            </div>
          </div>

          <div className="separator"></div>

          <div className="tiles-container">
            {startLocation ? (
              <SmartVacay 
                currentMonth={currentMonth} 
                currentYear={currentYear} 
                holidays={holidays} 
                location={startLocation} 
              />
            ) : (
              <div className="no-start-message">
                <h3>Enter your starting location</h3>
                <div className="location-search">
                <input 
                  type="text" 
                    placeholder="Search location..." 
                  className="search-start-input"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                  />
                  {showSuggestions && locationSuggestions.length > 0 && (
                    <div className="location-suggestions">
                      {locationSuggestions.map((suggestion) => (
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
                </div>
                <div className="search-hint">
                  <IoLocationSharp size={20} />
                  <p>We'll suggest vacation spots based on your location</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
