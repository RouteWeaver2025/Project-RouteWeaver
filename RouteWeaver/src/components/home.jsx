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

  useEffect(() => {
    // Animate elements on load
    setTimeout(() => setShowText(true), 500);
    setTimeout(() => setShowDiagonal(true), 1200);
    
    // Show description on scroll
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowDescription(true);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Generate calendar data
  const generateCalendar = (month, year) => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;
      days.push({ day: i, isWeekend });
    }
    
    return days;
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const calendar = generateCalendar(currentMonth, currentYear);

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
                className={`calendar-day ${!day ? 'empty' : ''} ${day?.isWeekend ? 'weekend' : ''}`}
              >
                {day?.day}
              </div>
            ))}
          </div>
        </div>
        
        <div className="calendar-tiles">
          <div className="tile">Route 1</div>
          <div className="tile">Route 2</div>
          <div className="tile">Route 3</div>
          <div className="tile">Route 4</div>
          <div className="tile">Route 5</div>
          <div className="tile">Route 6</div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
