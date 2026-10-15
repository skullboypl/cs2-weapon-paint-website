import React from 'react'
import { logout } from '../lib/session'

export default function UserHeader({ user }) {
  const handleLogout = () => {
    logout()
  }

  return (
    <div>
      <img src={user.avatar} alt="Avatar" draggable={false} />
      <span>{user.personaname}</span>
      <button onClick={handleLogout}>Wyloguj</button>
    </div>
  )
}
