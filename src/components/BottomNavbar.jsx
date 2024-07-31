// BottomNavbar.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './BottomNavbar.css'; // Optional: add custom styles here

function BottomNavbar() {
  return (
    <div className="bottom-navbar">
      <Link to="/" className="navbar-link">Home</Link>
      <Link to="/about" className="navbar-link">About</Link>
    </div>
  );
}

export default BottomNavbar;
