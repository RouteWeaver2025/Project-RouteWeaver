import React, { useState, useEffect } from 'react';
import '../design/query.css';
import { useNavigate } from 'react-router-dom';

function Questions() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [destination, setDestination] = useState('');
  const [location, setLocation] = useState('');
  const [number, setNumber] = useState('');

  useEffect(() => {
    sessionStorage.setItem('number', 1);
    if (currentStep !== 1 && currentStep !== 2) return;
    
    const savedDestination = sessionStorage.getItem('destination');
    if (savedDestination) setDestination(savedDestination);

    const savedLocation = sessionStorage.getItem('location');
    if (savedLocation) setLocation(savedLocation);

    const savedNumber = sessionStorage.getItem('number');
    if (savedNumber) setNumber(savedNumber);

    const initializeAutocomplete = (inputId, setValue, sessionKey) => {
      const input = document.getElementById(inputId);
      if (!input) return;
      
      const autocomplete = new window.google.maps.places.Autocomplete(input);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const fullPlaceName = place.formatted_address || place.name;
          setValue(fullPlaceName);
          sessionStorage.setItem(sessionKey, fullPlaceName);
          console.log(`Selected ${sessionKey}:`, fullPlaceName);
        } else {
          console.log("No geometry information available for the selected place.");
        }
      });
    };

    if (!window.google || !window.google.maps) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (currentStep === 1) initializeAutocomplete('search-bar', setDestination, 'destination');
        if (currentStep === 2) initializeAutocomplete('search-bar1', setLocation, 'location');
      };
      document.head.appendChild(script);
    } else {
      if (currentStep === 1) initializeAutocomplete('search-bar', setDestination, 'destination');
      if (currentStep === 2) initializeAutocomplete('search-bar1', setLocation, 'location');
    }
  }, [currentStep]);

  const handleNext = () => {
    if (currentStep === 0) setCurrentStep(1);
    else if (currentStep === 1 && destination.trim()) setCurrentStep(2);
    else if (currentStep === 1) alert('Please enter a destination!');
    else if (currentStep === 2 && location.trim()) setCurrentStep(3);
    else if (currentStep === 2) alert('Please enter a location!');
    else if (currentStep === 3) navigate('/suggestions');
  };

  const handleBack = () => {
    if (currentStep === 0) navigate('/home');
    else setCurrentStep(currentStep - 1);
  };

  return (
    <>
      <button id="name" onClick={() => navigate('/home')}>RouteWeaver</button>
      <div className="main">
        {currentStep === 0 && (
          <div>
            <div className="options">
              <button id="custom" onClick={handleNext}>Custom</button>
              <button id="pkg" onClick={() => navigate('/packages')}>Travel Package</button>
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
              <input id="search-bar" value={destination} type="text" placeholder="Search.." onChange={(e) => setDestination(e.target.value)} />
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
              <input id="search-bar1" value={location} type="text" placeholder="Search.." onChange={(e) => setLocation(e.target.value)} />
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
                <input id="measure" value={number} type="text" placeholder="1" onChange={(e) => setNumber(e.target.value)} />
              </div>
            </div>
            <div className="move">
              <button id="back" onClick={handleBack}></button>
              <button id="next" onClick={() => navigate('/suggestions')}></button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default Questions;