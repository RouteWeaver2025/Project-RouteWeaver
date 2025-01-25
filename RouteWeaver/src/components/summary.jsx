import React from "react";
import "../design/summary.css";

const Summary = () => {
  return (
    <div className="summary">
      <div className="head">
        <h1>Route Summary</h1>
      </div>
      <div className="plan">
        <h2>Route :</h2>
        <div className="route">
          <h3>Start :</h3>
          <div className="addedstops">

          </div>
          <h3>End :</h3>
        </div>
      </div>
    </div>
  );
};

export default Summary;