import React from 'react'; 
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './components/login';
import HomePage from './components/home';
import Newr from './components/newr';
import Summary from './components/summary';

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/newr" element={<Newr />} />
        <Route path="/summary" element={<Summary />} />
      </Routes>
    </Router>
  );
};
export default App
