import React, { useEffect, useState } from 'react'; 
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import LoginPage from './components/login';
import HomePage from './components/home';
import SuggestPage from './components/suggest';
import Summary from './components/summary';
import Questions from './components/query';
import SavedRoutes from './components/SavedRoutes';
import TravelPackage from './components/travelpackage';
import PrebuiltRoute from './components/prebuilt';
import './design/prebuilt.css'; // Import the CSS for the prebuilt component


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
      setPageClass("suggest-container");}
     else if(location.pathname==="/saver"){
       setPageClass("saver-container");}
    else if(location.pathname==="/summary" || location.pathname.startsWith("/summary/")){
      setPageClass("summary-container");
    }
    else if(location.pathname==="/packages"){
      setPageClass("package-container");
    }
    else if(location.pathname==="/prebuilt"){
      setPageClass("prebuilt-container");
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
        <Route path="/suggestions" element={<SuggestPage/>} />
        <Route path="/queries" element={<Questions />} /> 
        <Route path="/saver" element={<SavedRoutes />} /> 
        <Route path="/summary" element={<Summary />} />
        <Route path="/summary/:routeId" element={<Summary />} />
        <Route path="/packages" element={<TravelPackage />} /> 
        <Route path="/prebuilt" element={<PrebuiltRoute />} />
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
