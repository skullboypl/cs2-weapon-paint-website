import React from 'react';

import './../styles/Login.css'; // pamiętaj o imporcie CSS

export default function Login() {
  
  const API_URL = import.meta.env.VITE_API_URL || "/api/";
  const handleSteamLogin = () => {
    window.location.href = `${API_URL}/login-steam.php`;
  };

  return (
    <div className="login-box">
      <h2>Weapon Paints Login</h2>
        <p>Log in to access your profile and manage your loadouts.</p>
        <button onClick={handleSteamLogin}>
            <img
            src="https://steamcommunity-a.akamaihd.net/public/images/signinthroughsteam/sits_01.png"
            alt="Weapon Paints Login with Steam"
            />
        </button>
    </div>
  );
}
