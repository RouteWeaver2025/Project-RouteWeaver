import React, { useState } from "react";
import axios from "axios";
import bcrypt from "bcryptjs";
import { useNavigate } from "react-router-dom";
import validator from "validator";
import "../design/login.css"; // Your CSS file
import HomePage from "./home";

const LoginPage = () => {
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
    // e.preventDefault(); // Commenting out to keep logic intact
    if (!validator.isEmail(signupData.email)) {
      alert("Invalid email address! Please enter a valid email."); // Set the error message
      return; // Stop form submission
    }
    try {
      const salt = await bcrypt.genSalt(11);
      signupData.password = await bcrypt.hash(signupData.password, salt);
      const response = await axios.post("http://localhost:5000/user/signup", signupData);
      if (response.data.message === "User Added!") {
        HomePage(signupData.email);
      }
      console.log("Signup Response:", response.data);
    } catch (error) {
      console.error("Signup Error:", error.message);
    }
  };

  // Handle Login Submit (Redirect without validation)
  const handleLoginSubmit = async (e) => {
    e.preventDefault(); // Prevent form submission from refreshing the page
    window.location.href = "/home"; // Redirect to Home Page*/
    /*window.open("/home","_blank");// Commenting out the login validation code so we redirect without checking
    // try {
    //   const salt = await bcrypt.genSalt(11);
    //   loginData.password = await bcrypt.hash(loginData.password, salt);
    //   const response = await axios.post("http://localhost:5000/user/login", loginData);
    //   console.log("Login Response:", response.data);
    //   if (response.data.message === "Login Successful") {
    //     Homepage(loginData.email);
    //   }
    // } catch (error) {
    //   console.error("Login Error:", error.message);
    // }

    // Direct redirect to Home Page without validation
    /*HomePage(loginData.email); // Redirect to HomePage with the login data's email
  */};

  /*const handleclick = () => {
    window.location.href = "/home";
  };*/

  return (
    <div className="main">
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
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
