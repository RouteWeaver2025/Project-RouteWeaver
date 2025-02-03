import React, { useState, useEffect } from 'react';
import '../design/query.css'
import { useNavigate } from "react-router-dom";

function Questions() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [destination, setDestination] = useState('');
  const [number, setNumber] = useState('');

  sessionStorage.setItem('number', 1)
  const handleDestinationChange = (event) => {
    const newDestination = (event.target.value);
    setDestination(newDestination);
    sessionStorage.setItem('destination', newDestination);

  }

  const handleNumber = (event) => {
    setNumber(event.target.value); // Update the number state
    sessionStorage.setItem('number', event.target.value)
  }
  const handleNext = () => {
    if (currentStep === 1 && destination.trim() !== '') {
      setCurrentStep(2);
    }
    else if (currentStep === 0) {
      setCurrentStep(1)
    }
    else if (currentStep === 1) {
      alert("Please enter a destination!");
    }
    else if(currentStep===2){
      navigate('/suggestions');
    }
  }
  const handleBack = () => {
    if (currentStep === 0) {
      navigate('/home');
    }
    else if (currentStep === 1) {
      setCurrentStep(0);
    }
    else if (currentStep === 2) {
      setCurrentStep(1);
    }
  }
  useEffect(() => {
    if (currentStep !== 1) return;
    const savedDestination = sessionStorage.getItem('destination');
    if (savedDestination) {
      setDestination(savedDestination);
    }
    const savedNumber = sessionStorage.getItem('number');
        if (savedNumber){
            setNumber(savedNumber)
        }
    // Initialize Google Maps Autocomplete
    const initializeAutocomplete = () => {
      const input = document.getElementById('search-bar');
      if (input) {
        const autocomplete = new window.google.maps.places.Autocomplete(input);
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place.geometry) {
            const fullPlaceName = place.formatted_address || place.name;
            setDestination(fullPlaceName);
            sessionStorage.setItem('destination', fullPlaceName);
            const locationString = `Latitude: ${place.geometry.location.lat()}, Longitude: ${place.geometry.location.lng()}`;
            console.log(locationString);
          } else {
            console.log("No geometry information available for the selected place.");
          }
        });
      }
    };

    // Load Google Maps Script
    const loadScript = () => {
      const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      console.log(key);
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = initializeAutocomplete;
      document.head.appendChild(script);
    };
    if (!window.google || !window.google.maps) {
      loadScript();
    } else {
      initializeAutocomplete();
    }

  }, [currentStep]);
  const renderContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div>
            <div className="options">
              <button id="custom" onClick={handleNext}>Custom</button>
              <button id="pkg">Travel Package</button>
            </div>
            <div className="move">
              <button id='back' onClick={handleBack}></button>
            </div>
          </div>
        );
      case 1:
        return (
          <div>
            <p id="text2">Where do you want to go?</p>
            <div className="search-bar-container">
              <input id="search-bar" value={destination} type="text" placeholder="Search.." onChange={handleDestinationChange} />
            </div>
            <div className="move">
              <button id='back' onClick={handleBack}></button>
              <button id='next' onClick={handleNext}></button>
            </div>
          </div>
        );
      case 2:
        return (
          <div>
            <p id="text2">How big is your group?</p>
            <div className="options1">
              <button id="solo" onClick={handleNext}>Solo</button>
              <div className="multiple">
                <p id="text3"><strong>Multiple</strong></p>
                <input id="measure" value={number} type="text" placeholder="1" onChange={handleNumber} />
              </div>
            </div>
            <div className="move">
              <button id='back' onClick={handleBack}></button>
              <button id='next' onClick={() => navigate('/suggestions')}></button>
            </div>
          </div>
        );
      default:
        return null;

    }
  }
  return (
    <>
    <button id="name" onClick={() => navigate('/home')}>RouteWeaver</button>
      <div className="main">
        {renderContent()}
      </div>
    </>

  );
}

export default Questions;
