import React, { useState, useEffect } from "react";
import "../design/homescreen.css";

// HomePage component
const HomePage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [menuOpen, setMenuOpen] = useState(false); // State to toggle the menu
  const [greet, setGreet] = useState(""); // State to store the greeting message

  // Function to toggle the menu
  const handleMenuToggle = () => {
    setMenuOpen(!menuOpen); // Toggle menu visibility
  };

  // Function to handle month change (next/previous)
  const handleMonthChange = (direction) => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  // Function to get the month name (excluding year)
  const getMonthName = (date) =>
    date.toLocaleString("default", { month: "long" });

  // Function to generate the calendar
  const generateCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendar = [];
    let day = 1;

    for (let i = 0; i < 6; i++) {
      const week = [];
      for (let j = 0; j < 7; j++) {
        if ((i === 0 && j < firstDay) || day > daysInMonth) {
          week.push(
            <div key={`${i}-${j}`} className="calendar-cell empty"></div>
          );
        } else {
          week.push(
            <div key={`${i}-${j}`} className="calendar-cell">
              {day}
            </div>
          );
          day++;
        }
      }
      calendar.push(
        <div key={i} className="calendar-row">
          {week}
        </div>
      );
    }
    return calendar;
  };

  // Async function to determine greeting based on current time
  const greeting = async () => {
    const currentTime = new Date();
    const hours = currentTime.getHours(); // Get current hour

    let greetingMessage = "";

    if (hours >= 0 && hours <= 11) {
      greetingMessage = "Good Morning";
    } else if (hours >= 12 && hours <= 16) {
      greetingMessage = "Good Afternoon";
    } else if (hours >= 17 && hours <= 23) {
      greetingMessage = "Good Evening";
    }

    return greetingMessage;
  };

  // Fetch the greeting when the component is mounted
  useEffect(() => {
    const fetchGreeting = async () => {
      const message = await greeting();
      setGreet(message); // Update state with the greeting message
    };
    fetchGreeting(); // Call the async function
  }, []); // Empty dependency array ensures this runs only once when the component mounts

  return (
    <div className="main1">
      {/* Menu bar always visible */}
      <div className="homeTop">
        <div className="menuicon" onClick={handleMenuToggle}>
          <div className="bar1"></div>
          <div className="bar2"></div>
          <div className="bar3"></div>
        </div>
      </div>

      {/* Menu that toggles visibility */}
      <div className={`menu ${menuOpen ? "open" : ""}`}>
        <div className="menuicon inside-menu" onClick={handleMenuToggle}>
          <div className="bar1"></div>
          <div className="bar2"></div>
          <div className="bar3"></div>
        </div>
        {/*<div className="menu-content">
          { Add your menu items here }
        </div>*/}
        <div className="menu-item logout" onClick={() => alert("Logged out")}>
          <h3>Logout</h3>
        </div>
      </div>

      {/* Greeting message */}
      <div className="greeting">
        <h3>{greet} Ryan</h3>
      </div>
      
      {/*buttons: new route, saved route,smartvacay*/}
      <div className="box">
        <div role="button" className="NewR">
          <h4>New Route</h4>
        </div>
        <div role="button" className="SavedR">
          <h4>Saved Route</h4>
        </div>
      </div>

      <div className="SmartV">
        <div className="left-section">{/*left section*/}
          <div className="calendar">{/* Calendar component */}
            <div className="calendar-header">
              <button
                className="calendar-button"
                onClick={() => handleMonthChange(-1)}
              >
                &lt;
              </button>
              <h3 className="calendar-month">{getMonthName(currentDate)}</h3>
              <button
                className="calendar-button"
                onClick={() => handleMonthChange(1)}
              >
                &gt;
              </button>
            </div>
            <div className="calendar-body">
              <div className="calendar-row">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div key={day} className="calendar-cell header">
                      {day}
                    </div>
                  )
                )}
              </div>
              {generateCalendar()}
            </div>
          </div>
        </div>
        <div className="right-section">
          {/*<div role="button" className="suggestedroute1"></div>
          <div role="button" className="suggestedroute2"></div>
          <div role="button" className="suggestedroute3"></div>*/}
          <button className="suggestedroute1">one</button>{/*suggested routes from current location*/}
          <button className="suggestedroute2">two</button>
          <button className="suggestedroute3">three</button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
