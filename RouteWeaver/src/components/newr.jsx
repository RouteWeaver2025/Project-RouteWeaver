import React, { useState } from "react";
import homeImage from "../assets/homeimg.jpg";
import "../design/newr.css";

const Newr = () => {
  // State to track the visibility of all stop boxes
  const [visibleStops, setVisibleStops] = useState({
    stop1: true,
    stop2: true,
    stop3: true,
    stop4: false, // Initially hidden
  });

  const [selectedNames, setSelectedNames] = useState([]);

  // Handle adding a name and showing Stop4 if triggered by Stop3
  const handleAdd = (name) => {
    setSelectedNames((prev) => [...prev, name]);
    if (name === "Name3") {
      setVisibleStops((prev) => ({ ...prev, stop4: true }));
    }
  };

  // Handle removing a name and showing Stop4 if triggered by Stop3
  const handleRemove = (name, stopKey) => {
    setSelectedNames((prev) => prev.filter((n) => n !== name));
    if (stopKey === "stop3") {
      setVisibleStops((prev) => ({ ...prev, [stopKey]: false }));
      setVisibleStops((prev) => ({ ...prev, stop4: true }));
    } else {
      setVisibleStops((prev) => ({ ...prev, [stopKey]: false }));
    }
  };

  // Check if there are any visible stops
  const areStopsVisible = Object.values(visibleStops).includes(true);

  return (
    <div className="newroute">
      <div className="customroute">
        {/* Conditionally render the tree if there are visible stops */}
        {areStopsVisible&& <div className="tree"></div>}

        {/* Start Box */}
        <div className="start">
          <h2>Start</h2>
        </div>

        {/* Stop Boxes */}
        {visibleStops.stop1 && (
          <div className="stop1 visible">
            <h2>Name1</h2>
            <img src={homeImage} alt="Stop 1" />
            <div className="button">
              <button
                className="remove1"
                onClick={() => handleRemove("Name1", "stop1")}
              >
                -
              </button>
              <button className="add1" onClick={() => handleAdd("Name1")}>
                +
              </button>
            </div>
          </div>
        )}

        {visibleStops.stop2 && (
          <div className="stop2 visible">
            <h2>Name2</h2>
            <img src={homeImage} alt="Stop 2" />
            <div className="button">
              <button
                className="remove2"
                onClick={() => handleRemove("Name2", "stop2")}
              >
                -
              </button>
              <button className="add2" onClick={() => handleAdd("Name2")}>
                +
              </button>
            </div>
          </div>
        )}

        {visibleStops.stop3 && (
          <div className="stop3 visible">
            <h2>Name3</h2>
            <img src={homeImage} alt="Stop 3" />
            <div className="button">
              <button
                className="remove3"
                onClick={() => handleRemove("Name3", "stop3")}
              >
                -
              </button>
              <button className="add3" onClick={() => handleAdd("Name3")}>
                +
              </button>
            </div>
          </div>
        )}

        {visibleStops.stop4 && (
          <div className="stop4 visible">
            <h2>Name4</h2>
            <img src={homeImage} alt="Stop 4" />
            <div className="button">
              <button
                className="remove4"
                onClick={() => handleRemove("Name4", "stop4")}
              >
                -
              </button>
              <button className="add4" onClick={() => handleAdd("Name4")}>
                +
              </button>
            </div>
          </div>
        )}

        {/* Destination Box */}
        <div className="destination">
          <h2>End</h2>
        </div>
      </div>

      <button
        className="routesummary"
        onClick={() => window.location.href = "/summary"}
      >
        View Summary
      </button>
    </div>
  );
};

export default Newr;