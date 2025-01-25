import React from 'react';
import homeImage from '../assets/homeimg.jpg';  
import "../design/newr.css";

const Newr = () => {
    return (
        <div className="newroute">
            <div className="customroute">
                {/* Tree Line */}
                <div className="tree"></div>

                {/* Start Box */}
                <div className="start">
                    <h2>Start</h2>
                </div>

                {/* Stop Boxes */}
                <div className="stop1">
                    <h2>Name1</h2>
                    <img src={homeImage} alt="Stop 1" />
                    <div className="button">
                        <button className="remove1">-</button>
                        <button className="add1">+</button>
                    </div>
                </div>

                <div className="stop2">
                    <h2>Name2</h2>
                    <img src={homeImage} alt="Stop 2" />
                    <div className="button">
                        <button className="remove2">-</button>
                        <button className="add2">+</button>
                    </div>
                </div>

                <div className="stop3">
                    <h2>Name3</h2>
                    <img src={homeImage} alt="Stop 3" />
                    <div className="button">
                        <button className="remove3">-</button>
                        <button className="add3">+</button>
                    </div>
                </div>

                <div className="stop4">
                    <h2>Name4</h2>
                    <img src={homeImage} alt="Stop 4" />
                    <div className="button">
                        <button className="remove4">-</button>
                        <button className="add4">+</button>
                    </div>
                </div>

                {/* Destination Box */}
                <div className="destination">
                    <h2>End</h2>
                </div>
            </div>
        </div>
    );
};

export default Newr;
