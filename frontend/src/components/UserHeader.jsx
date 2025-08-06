import React from 'react';

export default function UserHeader({ user }) {
  const handleLogout = () => {
    fetch(`/api/steamauth/logout.php`, {
      credentials: 'include',
    }).then(() => {
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
