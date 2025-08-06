import React from 'react';

export default function UserHeader({ user }) {
  const API_URL = import.meta.env.VITE_API_URL || "/api";
  const handleLogout = () => {
    fetch(`${API_URL}/steamauth/logout.php`, {
      credentials: 'include',
    }).then(() => {
      // Wyczyść dane lokalnie i przeładuj
      localStorage.removeItem('steamid');
      window.location.reload();
    });
  };

  return (
    <div>
      <img src={user.avatar} alt="Avatar" />
      <span>{user.personaname}</span>
      <button onClick={handleLogout}>Wyloguj</button>
    </div>
  );
}
