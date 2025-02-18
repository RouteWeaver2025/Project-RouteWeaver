import React, { useEffect, useState } from 'react'; 
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './components/login';
import HomePage from './components/home';
import Timeline from './components/suggest';
import Summary from './components/summary';
import Questions from './components/query';
import SavedRoutes from './components/saver';


const AppWrapper = () => {
  const location = useLocation();
  const [pageClass, setPageClass] = useState("");

  useEffect(() => {
    if (location.pathname === "/") {
      setPageClass("login-container");
    } else if (location.pathname === "/home") {
      setPageClass("home-container");
    }else if (location.pathname === "/queries") {
      setPageClass("query-container");} 
    else if(location.pathname==="/suggestions"){
      setPageClass("timeline-container");}
    // else if(location.pathname==="/saver"){
    //   setPageClass("timeline-container");}
    else if(location.pathname==="/summary"){
      setPageClass("timeline-container");
    }
    else {
      setPageClass(""); // Default class for other pages
    }
  }, [location.pathname]);

  return (
    <div className={pageClass}>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/suggestions" element={<Timeline/>} />
        <Route path="/queries" element={<Questions />} /> 
        {/* <Route path="/saver" element={<SavedRoutes />} /> */}
        <Route path="/summary" element={<Summary />} />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <AppWrapper />
    </Router>
  );
};

export default App;
