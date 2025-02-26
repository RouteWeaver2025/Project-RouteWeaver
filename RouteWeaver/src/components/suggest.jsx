import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaCheck, FaTimes } from "react-icons/fa";
import "../design/suggest.css";

const TimelineItem = ({ item, isLeft, onAccept, onDecline, index, openedHoverBox, setOpenedHoverBox }) => {
  const isHovered = openedHoverBox === index;

  return (
    <div className={`timeline-item ${isLeft ? "left" : "right"}`}>
      <div
        className="timeline-content"
        onClick={() => setOpenedHoverBox(isHovered ? null : index)} // Toggle the hover box
      >
        <div className={`dot ${isLeft ? "dot-left" : "dot-right"}`} />
        {isHovered && (
          <div className={`hover-box ${isLeft ? "hover-left" : "hover-right"}`}>
            <h3>{item.name}</h3>
            <img
              src={item.image}
              alt={item.name}
              loading="lazy"
              onError={(e) => (e.target.src = "https://images.unsplash.com/photo-1594322436404-5a0526db4d13")}
            />
            <div className="button-group">
              <button className="accept" onClick={() => onAccept(item)}>
                <FaCheck className="icon" />
              </button>
              <button className="decline" onClick={() => onDecline(item)}>
                <FaTimes className="icon" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Timeline = () => {
  const [timelineData, setTimelineData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acceptedLocations, setAcceptedLocations] = useState([]);
  const [declinedLocations, setDeclinedLocations] = useState([]);
  const [openedHoverBox, setOpenedHoverBox] = useState(null); // Tracks the currently open hover box
  const navigate = useNavigate();
  const location = sessionStorage.getItem("location");
  const dest = sessionStorage.getItem("destination");

  useEffect(() => {
    const fetchTimelineData = async () => {
      try {
        const response = await axios.get("http://localhost:5000/create", {
          params: { origin: location, destination: dest },
        });
        const fetchedData = response.data.places.map((place, index) => ({
          ...place,
          image: response.data.images[index] || null,
          description: "Tourist Attraction",
        }));
  
        setTimelineData(fetchedData);
      } catch (err) {
        setError(err);
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimelineData();
  }, []);

  const handleAccept = (item) => {
    setAcceptedLocations([...acceptedLocations, item]);
  };

  const handleDecline = (name) => {
    setDeclinedLocations([...declinedLocations, name]);
  };

  const handleProceed = () => {
    navigate("/summary", { state: { acceptedLocations } });
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div className="timeline-container">
      <div className="timeline-line" />
      {timelineData.map((item, index) => (
        <TimelineItem
          key={item.place_id}
          item={item}
          isLeft={index % 2 === 0}
          onAccept={handleAccept}
          onDecline={handleDecline}
          index={index}
          openedHoverBox={openedHoverBox}
          setOpenedHoverBox={setOpenedHoverBox}
        />
      ))}
      <button className="proceed-btn" onClick={handleProceed}>Proceed to Summary</button>
    </div>
  );
};

export default Timeline;
