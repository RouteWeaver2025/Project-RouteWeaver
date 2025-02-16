import { useState } from "react";
import { FaCheck, FaTimes } from "react-icons/fa";
import "../design/suggest.css";
import axios from 'axios';

const timelineData = [
  {
    id: 1,
    title: "Mountain Trek",
    description: "Adventure through the Himalayas",
    date: "2024-01-15",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
  },
  {
    id: 2,
    title: "Desert Safari",
    description: "Expedition in the Sahara",
    date: "2024-02-20",
    image: "https://images.unsplash.com/photo-1509316785289-025f5b846b35",
  },
  {
    id: 3,
    title: "Ocean Voyage",
    description: "Pacific Ocean Exploration",
    date: "2024-03-25",
    image: "https://images.unsplash.com/photo-1505118380757-91f5f5632de0",
  },
  {
    id: 4,
    title: "Forest Trail",
    description: "Amazon Rainforest Journey",
    date: "2024-04-30",
    image: "https://images.unsplash.com/photo-1511497584788-876760111969",
  },
  {
    id: 5,
    title: "Forest Amazon",
    description: "Amazon Rainforest Journey",
    date: "2024-04-30",
    image: "https://images.unsplash.com/photo-1511497584788-876760111969",
  },
];

const TimelineItem = ({ item, isLeft }) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className={`timeline-item ${isLeft ? "left" : "right"}`}>
      <div
        className="timeline-content"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className={`dot ${isLeft ? "dot-left" : "dot-right"}`} />

        {isHovered && (
          <div className={`hover-box ${isLeft ? "hover-left" : "hover-right"}`}>
            <h3>{item.title}</h3>
            <img
              src={item.image}
              alt={item.title}
              loading="lazy"
              onError={(e) =>
                (e.target.src =
                  "https://images.unsplash.com/photo-1594322436404-5a0526db4d13")
              }
            />
            <p>{item.description}</p>
            <div className="button-group">
              <button className="accept" aria-label={`Accept ${item.title}`}>
                <FaCheck className="icon" />
              </button>
              <button className="decline" aria-label={`Decline ${item.title}`}>
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
//   try{
//     const location=sessionStorage.getItem("location");
//     const destination=sessionStorage.getItem("destination");
//     const response= axios.get("/suggest", {
//       params: {
//         location: location,
//         destination: destination
//       }
//     });
//     console.log(response);
    return (
      <div className="timeline-container">
        <div className="timeline-line" />
        {timelineData.map((item, index) => (
          <TimelineItem key={item.id} item={item} isLeft={index % 2 === 0} />
        ))}
      </div>
    );
  // } 
  // catch (error) {
  //   console.error(error);
  // }
  
};

export default Timeline;