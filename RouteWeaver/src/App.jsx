import './App.css'
import React from 'react';
import DataComponent from './components/FetchData';  // Adjust path if needed

const App = () => {
  return (
    <div>
      <h1>Welcome to My App</h1>
      <DataComponent />  {/* This renders the data-fetching component */}
    </div>
  );
};
export default App
