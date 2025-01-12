import './App.css'
import React from 'react';
import DataComponent from './components/FetchData';  // Adjust path if needed
import LoginPage from './components/login';

const App = () => {
  return (
    <div>
      <h1>Welcome to My App</h1>
      <DataComponent />  {/* This renders the data-fetching component */}*/
      <LoginPage/>
    </div>
  );
};
export default App
