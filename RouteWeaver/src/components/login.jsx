import React, { useState, useEffect } from "react";
import axios from "axios";
import bcrypt from "bcryptjs";
import { useNavigate } from "react-router-dom";
import validator from "validator";
import "../design/login.css"; // Your CSS file

const LoginPage = () => {
  const navigate = useNavigate();
  // State for Signup Form
  const [signupData, setSignupData] = useState({
    username: "",
    email: "",
    password: "",
  });

  // State for Login Form
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Check if user is already logged in
  useEffect(() => {
    const userEmail = localStorage.getItem("userEmail");
    if (userEmail) {
      console.log("User already logged in, redirecting to home");
      navigate("/home");
    }
  }, [navigate]);

  // Handle Signup Input Changes
  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle Login Input Changes
  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle Signup Submit
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (!validator.isEmail(signupData.email)) {
      alert("Invalid email address! Please enter a valid email."); // Set the error message
      return; // Stop form submission
    }
    try {
      const salt = await bcrypt.genSalt(11);
      const hashedpass = await bcrypt.hash(signupData.password, salt);
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/user/signup`, {
        email: signupData.email,
        password: hashedpass,
        username: signupData.username,
      });
      if (response.status === 201) {
        // Store email in both sessionStorage and localStorage
        sessionStorage.setItem("userEmail", signupData.email);
        localStorage.setItem("userEmail", signupData.email);
        // Store username directly too
        sessionStorage.setItem("user", signupData.username);
        navigate(response.data.redirectUrl);// Redirect to Home Page
      }
      else {
        alert(response.data.message); // Set the error message
      }
      console.log("Signup Response:", response.data);
    } catch (error) {
      console.error("Signup Error:", error.message);
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/user/login`, loginData);
      if (response.status === 200) {
        // Store email in both sessionStorage and localStorage
        sessionStorage.setItem("userEmail", loginData.email);
        localStorage.setItem("userEmail", loginData.email);
        
        // Store username from login response if available
        if (response.data && response.data.username) {
          console.log("Storing username from login response:", response.data.username);
          sessionStorage.setItem("user", response.data.username);
        } else {
          // Fallback to fetching profile if username not in response
          try {
            const userResponse = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/user/getProfile`, {
              params: { email: loginData.email }
            });
            
            if (userResponse.data && userResponse.data.username) {
              sessionStorage.setItem("user", userResponse.data.username);
            }
          } catch (err) {
            console.error("Error fetching username during login:", err);
          }
        }
        
        navigate(response.data.redirectUrl);
      }
    } catch (error) {
      console.error("Login Error:", error);
      if (error.response) {
        // Server responded with an error
        if (error.response.status === 404) {
          setError("Email not registered. Please sign up first.");
        } else if (error.response.status === 401) {
          setError("Invalid credentials. Please try again.");
        } else if (error.response.status === 500) {
          setError("Server error. Please try again later.");
        } else {
          setError("Login failed. Please try again.");
        }
      } else if (error.request) {
        // Request made but no response received
        setError("Cannot connect to server. Please check your internet connection.");
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="main1">
        <input type="checkbox" id="chk" aria-hidden="true" />

        {/* Signup Form */}
        <div className="signup">
          <form onSubmit={handleSignupSubmit}>
            <label htmlFor="chk" aria-hidden="true">
              Sign up
            </label>
            <input
              type="text"
              name="username"
              placeholder="User name"
              value={signupData.username}
              onChange={handleSignupChange}
              required
            />
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={signupData.email}
              onChange={handleSignupChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={signupData.password}
              onChange={handleSignupChange}
              required
            />
            <button type="submit" onClick={handleSignupSubmit}>Sign up</button>
          </form>
        </div>

        {/* Login Form */}
        <div className="login">
          <form onSubmit={handleLoginSubmit}>
            <label htmlFor="chk" aria-hidden="true">
              Login
            </label>
            {error && <div className="error-message">{error}</div>}
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={loginData.email}
              onChange={handleLoginChange}
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={loginData.password}
              onChange={handleLoginChange}
              required
            />
            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        </div>
      </div>
  );
};

export default LoginPage;
