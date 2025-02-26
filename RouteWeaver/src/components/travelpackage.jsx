import React, { useState, useEffect } from "react";
import { FaBold, FaUserCircle } from 'react-icons/fa';
import { IoLocationSharp } from 'react-icons/io5';
import '../design/travelpackage.css';
import { useNavigate } from 'react-router-dom';

const TravelPackage = () => {
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        console.log(position.coords.latitude, position.coords.longitude);
        // Here you would typically use these coordinates to update the search
      });
    }
  };

  return (
    <>
      <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`}>
        <div>
          <button id="name" onClick={() => navigate('/home')}>RouteWeaver</button>
        </div>
        <div className="nav-links">
          <a href="/home"><h4>Home</h4></a>
          <FaUserCircle
            size={24}
            className="profile-icon"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          />
          {showProfileMenu && (
            <div className="profile-dropdown">
              <a href="#profile">My Profile</a>
              <a href="#settings">Settings</a>
              <a href="#switch">Switch Account</a>
              <a href="#signout">Sign Out</a>
            </div>
          )}
        </div>
      </nav>

      <section className="hero"></section>

      <div className="location-search-container">
        <div className="location-search-wrapper">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search destinations..."
              className="search-input"
            />
          </div>
          <button
            className="current-location-btn"
            onClick={handleLocationClick}
          >
            <IoLocationSharp size={20} />
            {/* <span>Current Location</span> */}
          </button>
        </div>
      </div>

      <section className="featured-packages">
        <h2>Featured Travel Packages</h2>
        <h4>Places near you</h4>
        <div className="package-grid">
          <div className="package-card">
            <div className="card-image tropical"></div>
            <div className="card-content">
              <h3>Tropical Paradise Getaway</h3>
              <p>Experience the ultimate relaxation in a luxurious oceanfront resort.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image mountain"></div>
            <div className="card-content">
              <h3>Mountain Adventure Tour</h3>
              <p>Embark on a thrilling journey through majestic mountain landscapes.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image city"></div>
            <div className="card-content">
              <h3>Cultural City Exploration</h3>
              <p>Discover the rich history and vibrant culture of a bustling city.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1512100356356-de1b84283e18?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')` }}></div>
            <div className="card-content">
              <h3>Desert Safari Adventure</h3>
              <p>Experience the thrill of desert dunes and traditional Bedouin culture.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1534008757030-27299c4371b6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')` }}></div>
            <div className="card-content">
              <h3>Island Hopping Tour</h3>
              <p>Explore multiple pristine islands and discover hidden beaches.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')` }}></div>
            <div className="card-content">
              <h3>Rainforest Expedition</h3>
              <p>Discover exotic wildlife and ancient ecosystems in pristine rainforests.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>
        </div>
      </section>

      <section className="featured-packages">
        <h4>Places in Kerala</h4>
        <div className="package-grid">
          <div className="package-card">
            <div className="card-image tropical"></div>
            <div className="card-content">
              <h3>Tropical Paradise Getaway</h3>
              <p>Experience the ultimate relaxation in a luxurious oceanfront resort.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image mountain"></div>
            <div className="card-content">
              <h3>Mountain Adventure Tour</h3>
              <p>Embark on a thrilling journey through majestic mountain landscapes.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image city"></div>
            <div className="card-content">
              <h3>Cultural City Exploration</h3>
              <p>Discover the rich history and vibrant culture of a bustling city.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1512100356356-de1b84283e18?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')` }}></div>
            <div className="card-content">
              <h3>Desert Safari Adventure</h3>
              <p>Experience the thrill of desert dunes and traditional Bedouin culture.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1534008757030-27299c4371b6?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')` }}></div>
            <div className="card-content">
              <h3>Island Hopping Tour</h3>
              <p>Explore multiple pristine islands and discover hidden beaches.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>

          <div className="package-card">
            <div className="card-image" style={{ backgroundImage: `url('https://images.unsplash.com/photo-1566073771259-6a8506099945?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80')` }}></div>
            <div className="card-content">
              <h3>Rainforest Expedition</h3>
              <p>Discover exotic wildlife and ancient ecosystems in pristine rainforests.</p>
              <button className="explore-btn">Explore More</button>
            </div>
          </div>
        </div>
      </section>


      {/* <footer className="footer">
        <div className="footer-content">
          <div className="contact-info">
            <h3>Contact Us</h3>
            <p>Email: routeweaver25.com</p>
            <p>Phone: +91 9892746294</p>
          </div>
          <div className="social-links">
            <h3>Follow Us</h3>
            <div className="social-icons">
              <a href="#facebook" aria-label="Facebook">
                <FaFacebookF />
              </a>
              <a href="#twitter" aria-label="Twitter">
                <FaTwitter />
              </a>
              <a href="#instagram" aria-label="Instagram">
                <FaInstagram />
              </a>
            </div>
          </div>
        </div>
      </footer> */}
    </>
  );
};

export default TravelPackage;