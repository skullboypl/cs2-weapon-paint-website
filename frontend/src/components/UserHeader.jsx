import React from 'react'
import { apiUrl } from '../lib/api'

export default function UserHeader({ user }) {
  const handleLogout = () => {
    window.location.href = apiUrl('steamauth/logout.php')
  }

  return (
    <div>
      <img src={user.avatar} alt="Avatar" draggable={false} />
      <span>{user.personaname}</span>
      <button onClick={handleLogout}>Wyloguj</button>
    </div>
  )
}
