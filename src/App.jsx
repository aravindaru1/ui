// App.jsx
import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import NewsFeed from '././components/NewsFeed'; // Assuming this is your main content component
import AboutPage from '././components/AboutPage'; // Create this component separately
import BottomNavbar from '././components/BottomNavbar';

function App() {
  return (
    <Router>
      <div className="app">
        <Routes>
          <Route path="/" element={<NewsFeed />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
        <BottomNavbar />
      </div>
    </Router>
  );
}

export default App;
