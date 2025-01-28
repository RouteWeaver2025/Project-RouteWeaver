import React, { useState } from "react";
import "./Questions.css";

const Questions = () => {
  const questions = [
    {
      text: "Which type of route do you want?",
      options: ["Custom Route", "Travel Package"]
    },
    {
      text: "State your starting location and destination",
      type: "location"
    },
    {
      text: "Select the number of travellers",
      options: ["Solo", "Multiple"]
    }
  ];

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [showSummary, setShowSummary] = useState(false);
  const [startingLocation, setStartingLocation] = useState("");
  const [destinationLocation, setDestinationLocation] = useState("");
  const [error, setError] = useState("");

  const handleAnswer = (answer) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answer;
    setAnswers(newAnswers);

    if (currentQuestionIndex !== 1) {
      setTimeout(() => setCurrentQuestionIndex(currentQuestionIndex + 1), 300);
    }
  };

  const nextQuestion = () => {
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const restartQuiz = () => {
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setShowSummary(false);
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setStartingLocation(`Latitude: ${latitude}, Longitude: ${longitude}`);
          handleAnswer(`Latitude: ${latitude}, Longitude: ${longitude}`);
        },
        (error) => {
          setError("Unable to retrieve location");
        }
      );
    } else {
      setError("Geolocation is not supported by this browser.");
    }
  };

  return (
    <div className="outer-container">
      <div className="questionnaire-box">
        <h1 className="question-title">Please select your preferred choice</h1>
        {!showSummary ? (
          <div id="question-container">
            <p id="question-text">{questions[currentQuestionIndex].text}</p>
            <div id="options" className="options-container">
              {questions[currentQuestionIndex].type === "location" ? (
                <>
                  <div className="location-fields">
                    <input
                      type="text"
                      className="location-input"
                      placeholder="Enter your starting location"
                      value={startingLocation}
                      onChange={(e) => setStartingLocation(e.target.value)}
                    />
                    <input
                      type="text"
                      className="location-input"
                      placeholder="Enter your destination location"
                      value={destinationLocation}
                      onChange={(e) => setDestinationLocation(e.target.value)}
                    />
                    <div classname="Night">
                     <button id="get-location-btn" onClick={getLocation}>Get My Location</button>
                     <button id="next-btn" onClick={nextQuestion}>Next</button>
                     </div>
                  </div>
                  
                 
                  {error && <p>{error}</p>}
                </>
              ) : (
                <div className="option-boxes">
                  {questions[currentQuestionIndex].options.map((option, index) => (
                    <div
                      key={index}
                      className="option-box"
                      onClick={() => handleAnswer(option)}
                    >
                      {option}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div id="summary">
            <h2 className="question-title">Your Answers</h2>
            <ul id="answers-list">
              {questions.map((q, index) => (
                <li key={index}>
                  {q.text}: {answers[index] || "Not answered"}
                </li>
              ))}
            </ul>
            <button id="restart-btn" onClick={restartQuiz}>Restart</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Questions;
