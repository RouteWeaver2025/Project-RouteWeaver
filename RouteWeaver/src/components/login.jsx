import React, { useState } from "react";
import axios from "axios";
import "../design/login.css" // Your CSS file

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
    //e.preventDefault();
    try {
      const response = await axios.post("http://localhost:5000/user/signup", signupData);
      console.log("Signup Response:", response.data);
      
    } catch (error) {
      console.error("Signup Error:", error.message);
    }
  };

  // Handle Login Submit
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post("http://localhost:5000/user/login", loginData);
      console.log("Login Response:", response.data);
    } catch (error) {
      console.error("Login Error:", error.message);
    }
  };

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


    //     <div className="login-container">
    //   <h1>Welcome to RouteWeaver</h1>
    //   <h2>{isNewUser ? 'Sign Up' : 'Log In'}</h2>

    //   <form onSubmit={handleLogin} className="login-form">
    //     {isNewUser && (
    //       <div className="form-group">
    //         <label htmlFor="name" className="form-label">Full Name:</label>
    //         <input type="text" id="name" placeholder="Enter your full name" required className="form-input" />
    //       </div>
    //     )}

    //     <div className="form-group">
    //       <label htmlFor="email" className="form-label">Email:</label>
    //       <input type="email" id="email" placeholder="Enter your email" required className="form-input" />
    //     </div>

    //     <div className="form-group">
    //       <label htmlFor="password" className="form-label">Password:</label>
    //       <input type="password" id="password" placeholder="Enter your password" required className="form-input" />
    //     </div>

    //     <button type="submit" className="submit-button">
    //       {isNewUser ? 'Sign Up' : 'Log In'}
    //     </button>
    //   </form>

    //   <p className="toggle-text">
    //     {isNewUser ? 'Already have an account?' : "Don't have an account?"}{' '}
    //     <button onClick={handleToggleUser} className="toggle-button">
    //       {isNewUser ? 'Log In' : 'Sign Up'}
    //     </button>
    //   </p>
    // </div>

//   );
// };

export default LoginPage;
