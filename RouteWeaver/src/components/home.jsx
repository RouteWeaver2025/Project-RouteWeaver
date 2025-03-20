import React, { useState, useEffect } from 'react';
import { FaRoad } from 'react-icons/fa';
import '../design/homescreen.css';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();
  const [showDiagonal, setShowDiagonal] = useState(false);
  const [showText, setShowText] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [holidays, setHolidays] = useState({});

  // Retrieve start location from session storage
  const startLocation = sessionStorage.getItem("startLocation");

  useEffect(() => {
    // Animate elements on load
    setTimeout(() => setShowText(true), 500);
    setTimeout(() => setShowDiagonal(true), 1200);

    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowDescription(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Fetch fixed-date holidays from Google Calendar API when month or year changes
  useEffect(() => {
    const fetchHolidays = async () => {
      const calendarId = 'en.indian#holiday@group.v.calendar.google.com';
      const apiKey = 'AIzaSyCvumcWD5SudzRyaiAbPo8q8jBEvTzFFA8';
      const firstDay = new Date(currentYear, currentMonth, 1);
      const lastDay = new Date(currentYear, currentMonth + 1, 0);
      const timeMin = firstDay.toISOString();
      const timeMax = lastDay.toISOString();

      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?key=${apiKey}&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();

        console.log("Fetched holiday data:", data);
        if (data.error) {
          console.log("API Error:", data.error);
          console.log("Error message:", data.error.message);
          console.log("Error details:", data.error.errors);
        }
        
        // Map each holiday event to its date (day of month)
        const holidayMap = {};
        if (data.items && Array.isArray(data.items)) {
          data.items.forEach(event => {
            // event.start.date is in YYYY-MM-DD format
            const day = new Date(event.start.date).getDate();
            holidayMap[day] = event;
          });
        }
        setHolidays(holidayMap);
      } catch (error) {
        console.error("Error fetching holidays:", error);
      }
    };

    fetchHolidays();
  }, [currentMonth, currentYear]);

  // Generate calendar data and mark holidays
  const generateCalendar = (month, year, holidays) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add each day of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      const isHoliday = holidays[i] !== undefined;
      days.push({ day: i, isWeekend, isHoliday });
    }
    
    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Build the calendar array
  const calendar = generateCalendar(currentMonth, currentYear, holidays);

  // Compute consecutive holidays starting from today's date in current month
  const getConsecutiveHolidaysCount = () => {
    const today = new Date();
    // Only consider current month
    const currentDay = today.getMonth() === currentMonth ? today.getDate() : 1;
    let count = 0;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    for (let day = currentDay; day <= daysInMonth; day++) {
      if (holidays[day]) {
        count++;
      } else {
        break;
      }
    }
    return count;
  };

  const consecutiveHolidays = getConsecutiveHolidaysCount();

  // Generate an array for route tiles based on consecutive holidays count
  const routeTiles = [];
  for (let i = 1; i <= consecutiveHolidays; i++) {
    routeTiles.push(`Route ${i}`);
  }

  // Move to next/previous month
  const changeMonth = (increment) => {
    let newMonth = currentMonth + increment;
    let newYear = currentYear;
    if (newMonth > 11) {
      newMonth = 0;
      newYear += 1;
    } else if (newMonth < 0) {
      newMonth = 11;
      newYear -= 1;
    }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  return (
    <div className="home-container">
      {/* Navigation Bar */}
      <nav className="navbar">
        <ul>
          <li><a href="#profile">PROFILE</a></li>
          <li><a href="#switch">SWITCH ACCOUNTS</a></li>
          <li><a href="#logout">LOGOUT</a></li>
        </ul>
      </nav>
      
      {/* Hero Section */}
      <div className="hero-section">
        <div className="logo">
          <FaRoad className="road-icon" />
          <span className="logo-text">RouteWeaver</span>
        </div>
        <div className="hero-content">
          <div className={`text-container ${showText ? 'show' : ''}`}>
            <button className="new-routes" onClick={() => navigate('/queries')}>New Routes</button>
            <button className="saved-routes" onClick={() => navigate('/saver')}>Saved Routes</button>
            <div className={`diagonal-line ${showDiagonal ? 'show' : ''}`}></div>
          </div>
        </div>
      </div>
      
      {/* Agency Description */}
      <div className={`agency-description ${showDescription ? 'show' : ''}`}>
        <p>The Brigade is a digital agency. We create moments for people that forge indelible bonds with our clients.</p>
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
                  title={day?.isHoliday ? holidays[day.day]?.summary : ''}
                >
                  {day?.day}
                </div>
              ))}
            </div>
          </div>

          <div className="separator"></div>

          <div className="tiles-container">
            {startLocation ? (
              routeTiles.length > 0 ? (
                <div className="calendar-tiles">
                  {routeTiles.map((route, idx) => (
                    <div key={idx} className="tile">
                      {route}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-routes-message">
                  No consecutive holidays available for route planning.
                </div>
              )
            ) : (
              <div className="no-start-message">
                
                <input 
                  type="text" 
                  placeholder="Enter Current Location" 
                  className="search-start-input"
                />
                <div className='crlocationtext'>
                  <p>Current Location</p>
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
