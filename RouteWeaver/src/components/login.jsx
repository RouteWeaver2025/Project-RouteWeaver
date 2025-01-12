import React, { useState } from 'react';
import './Login.css'; // Add your styles here

const LoginPage = () => {
  const [isNewUser, setIsNewUser] = useState(false);

  const handleToggleUser = () => {
    setIsNewUser(!isNewUser);
  };

  const handleLogin = (e) => {
    //e.preventDefault();
    alert(isNewUser ? 'Sign-Up Form Submitted!' : 'Login Form Submitted!');
  };

  return (
        <div className="login-container">
      <h1>Welcome to RouteWeaver</h1>
      <h2>{isNewUser ? 'Sign Up' : 'Log In'}</h2>

      <form onSubmit={handleLogin} className="login-form">
        {isNewUser && (
          <div className="form-group">
            <label htmlFor="name" className="form-label">Full Name:</label>
            <input type="text" id="name" placeholder="Enter your full name" required className="form-input" />
          </div>
        )}

        <div className="form-group">
          <label htmlFor="email" className="form-label">Email:</label>
          <input type="email" id="email" placeholder="Enter your email" required className="form-input" />
        </div>

        <div className="form-group">
          <label htmlFor="password" className="form-label">Password:</label>
          <input type="password" id="password" placeholder="Enter your password" required className="form-input" />
        </div>

        <button type="submit" className="submit-button">
          {isNewUser ? 'Sign Up' : 'Log In'}
        </button>
      </form>

      <p className="toggle-text">
        {isNewUser ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button onClick={handleToggleUser} className="toggle-button">
          {isNewUser ? 'Log In' : 'Sign Up'}
        </button>
      </p>
    </div>

  );
};

export default LoginPage;
