import React, { useState, useEffect } from 'react';
import '../design/query.css';
import { useNavigate } from 'react-router-dom';

function Questions() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [destination, setDestination] = useState('');
  const [location, setLocation] = useState('');
  const [number, setNumber] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [suggestions, setSuggestions] = useState([]); // Suggestions for autocomplete
  const [activeField, setActiveField] = useState(null); // "destination" or "location"

  // Extended keywords list
  const keywords = [
    { id: 1, name: 'Restaurant', icon: '🍽️' },
    { id: 2, name: 'Cafe', icon: '☕' },
    { id: 3, name: 'Park', icon: '🌳' },
    { id: 4, name: 'Museum', icon: '🏛️' },
    { id: 5, name: 'Beach', icon: '🏖️' },
    { id: 6, name: 'Mountain', icon: '⛰️' },
    { id: 7, name: 'Lake', icon: '🌊' },
    { id: 8, name: 'Forest', icon: '🌲' },
    { id: 9, name: 'Historical Site', icon: '🏰' },
    { id: 10, name: 'Shopping Mall', icon: '🛍️' },
    { id: 11, name: 'Viewpoint', icon: '🔭' },
    { id: 12, name: 'Temple', icon: '🛕' },
    { id: 13, name: 'Church', icon: '⛪' },
    { id: 14, name: 'Mosque', icon: '🕌' },
    { id: 15, name: 'Amusement Park', icon: '🎡' },
    { id: 16, name: 'Zoo', icon: '🦁' },
    { id: 17, name: 'Bar', icon: '🍹' },
    { id: 18, name: 'Bakery', icon: '🥐' },
    { id: 19, name: 'Grocery Store', icon: '🛒' },
    { id: 20, name: 'Food Truck', icon: '🚚' },
    { id: 21, name: 'Nightclub', icon: '🎶' },
    { id: 22, name: 'Diner', icon: '🍔' },
    { id: 23, name: 'Fast Food', icon: '🍟' },
    { id: 24, name: 'Garden', icon: '🌷' },
    { id: 25, name: 'Hiking Trail', icon: '🥾' },
    { id: 26, name: 'Camping', icon: '🏕️' },
    { id: 27, name: 'River', icon: '🏞️' },
    { id: 28, name: 'Waterfall', icon: '🌊' },
    { id: 29, name: 'Cycling', icon: '🚴' },
    { id: 30, name: 'Skiing', icon: '⛷️' },
    { id: 31, name: 'Theater', icon: '🎭' },
    { id: 32, name: 'Cinema', icon: '🎬' },
    { id: 33, name: 'Art Gallery', icon: '🖼️' },
    { id: 34, name: 'Library', icon: '📚' },
    { id: 35, name: 'Aquarium', icon: '🐠' },
    { id: 36, name: 'Concert Hall', icon: '🎻' },
    { id: 37, name: 'Stadium', icon: '🏟️' },
    { id: 38, name: 'Hotel', icon: '🏨' },
    { id: 39, name: 'Hospital', icon: '🏥' },
    { id: 40, name: 'Pharmacy', icon: '💊' },
    { id: 41, name: 'Gas Station', icon: '⛽' },
    { id: 42, name: 'ATM', icon: '🏧' },
    { id: 43, name: 'Post Office', icon: '📮' },
    { id: 44, name: 'Train Station', icon: '🚆' },
    { id: 45, name: 'Bus Station', icon: '🚌' },
    { id: 46, name: 'Airport', icon: '✈️' },
    { id: 47, name: 'Parking', icon: '🅿️' },
    { id: 48, name: 'Police', icon: '🚓' },
    { id: 49, name: 'Fire Station', icon: '🚒' },
    { id: 50, name: 'Bookstore', icon: '📖' },
    { id: 51, name: 'Clothing Store', icon: '👕' },
    { id: 52, name: 'Electronics Store', icon: '📱' },
    { id: 53, name: 'Pet Store', icon: '🐾' },
    { id: 54, name: 'Furniture Store', icon: '🛋️' },
    { id: 55, name: 'Sporting Goods', icon: '⚽' }
  ];

  // Debounce and fetch suggestions from Nominatim
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeField === "destination" && destination.length > 2) {
        fetchSuggestions(destination);
      } else if (activeField === "location" && location.length > 2) {
        fetchSuggestions(location);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [destination, location, activeField]);

  const fetchSuggestions = async (query) => {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`;
      const response = await fetch(url);
      const data = await response.json();
      setSuggestions(data);
    } catch (error) {
      console.error("Error fetching suggestions:", error);
    }
  };

  const handleSuggestionClick = (suggestion, type) => {
    if (type === "destination") {
      setDestination(suggestion.display_name);
      sessionStorage.setItem("destination", suggestion.display_name);
    } else if (type === "location") {
      setLocation(suggestion.display_name);
      sessionStorage.setItem("location", suggestion.display_name);
    }
    setSuggestions([]);
  };

  // Moved the logic that saves selected keywords to session storage
  // so that we allow zero keywords to proceed.
  const handleNext = () => {
    if (currentStep === 4) {
      // Save selected keywords to sessionStorage (even if empty)
      const selectedKeywordNames = selectedKeywords.map(id => {
        const kw = keywords.find(k => k.id === id);
        return kw ? kw.name : null;
      }).filter(name => name);

      // Store them (could be an empty array if user picked none)
      sessionStorage.setItem("selectedKeywords", JSON.stringify(selectedKeywordNames));
      navigate("/suggestions");
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep === 0) {
      navigate("/home");
    } else {
      setCurrentStep(prev => prev - 1);
    }
  };

  const toggleKeyword = (id) => {
    if (selectedKeywords.includes(id)) {
      setSelectedKeywords(selectedKeywords.filter((i) => i !== id));
    } else {
      setSelectedKeywords([...selectedKeywords, id]);
    }
  };

  return (
    <>
      <button id="name" onClick={() => navigate("/home")}>
        RouteWeaver
      </button>
      <div className="main">
        {currentStep === 0 && (
          <div>
            <div className="options">
              <button id="custom" onClick={handleNext}>Custom</button>
              <button id="pkg">Travel Package</button>
            </div>
            <div className="move">
              <button id="back" onClick={handleBack}></button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div>
            <p id="text2">Where do you want to go?</p>
            <div className="search-bar-container">
              <input
                id="search-bar"
                value={destination}
                type="text"
                placeholder="Search destination..."
                onFocus={() => setActiveField("destination")}
                onChange={(e) => setDestination(e.target.value)}
              />
              {activeField === "destination" && suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {suggestions.map((sugg) => (
                    <li key={sugg.place_id} onClick={() => handleSuggestionClick(sugg, "destination")}>
                      {sugg.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="move">
              <button id="back" onClick={handleBack}></button>
              <button id="next" onClick={handleNext}></button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div>
            <p id="text2">Where will you start from?</p>
            <div className="search-bar-container">
              <input
                id="search-bar1"
                value={location}
                type="text"
                placeholder="Search origin..."
                onFocus={() => setActiveField("location")}
                onChange={(e) => setLocation(e.target.value)}
              />
              {activeField === "location" && suggestions.length > 0 && (
                <ul className="suggestions-list">
                  {suggestions.map((sugg) => (
                    <li key={sugg.place_id} onClick={() => handleSuggestionClick(sugg, "location")}>
                      {sugg.display_name}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="move">
              <button id="back" onClick={handleBack}></button>
              <button id="next" onClick={handleNext}></button>
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div>
            <p id="text2">How big is your group?</p>
            <div className="options1">
              <button id="solo" onClick={handleNext}>Solo</button>
              <div className="multiple">
                <p id="text3"><strong>Multiple</strong></p>
                <input
                  id="measure"
                  value={number}
                  type="text"
                  placeholder="1"
                  onChange={(e) => setNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="move">
              <button id="back" onClick={handleBack}></button>
              <button id="next" onClick={() => setCurrentStep(4)}></button>
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div>
            <p id="text2">Select Your Interests</p>
            <div className="keywords-grid">
              {keywords.map((keyword) => (
                <div
                  key={keyword.id}
                  className={`keyword-item ${selectedKeywords.includes(keyword.id) ? 'selected' : ''}`}
                  onClick={() => toggleKeyword(keyword.id)}
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    color: 'white',
                    border: selectedKeywords.includes(keyword.id)
                      ? '2px solid #da9e48'
                      : '2px solid rgba(255, 255, 255, 0.2)'
                  }}
                >
                  <span className="keyword-icon">{keyword.icon}</span>
                  <span className="keyword-name">{keyword.name}</span>
                </div>
              ))}
            </div>
            <div className="selected-count" style={{ color: 'white' }}>
              {selectedKeywords.length} interests selected
            </div>
            <div className="move">
              <button id="back" onClick={handleBack}></button>
              {/* 
                IMPORTANT CHANGE:
                Removed "disabled={selectedKeywords.length === 0}" 
                so user can proceed even with zero keywords.
              */}
              <button id="next" onClick={handleNext}></button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Questions;
