import React, { useState, useEffect } from 'react';
import TeamSelector from './../components/TeamSelector';
import './../styles/Page.css'; 
import Weapons from './../components/Weapons';

export default function Page({ user, team, setTeam }) {

  const API_URL = import.meta.env.VITE_API_URL || "/api";
  const handleTeamSelect = (side) => {
    setTeam(side);
    console.log(`Team selected: ${side}`);
  };

  const handleLogout = () => {
    window.location.href = `${API_URL}/steamauth/logout.php`;
  };

  return (
    <div className="page">
      <div className="header">
        <div className="user-info">
          <img src={user.avatar} alt="avatar" width={64} height={64} />
          <div className="user-details">
            <h2>{user.personaname}</h2>
            <a href={user.profileurl} target="_blank" rel="noreferrer">View Steam Profile</a>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </div>

        <div className="page-container">
        {team ? (
            <>
            <div className="taskbar">
                <span>Team selected: <strong>{team} </strong> </span>
                <button onClick={() => setTeam(null)} className="change-team-btn">Change Team</button>
            </div>

            <div className="after-team-selection">
                    <Weapons team={team} />
            </div>
            </>
        ) : (
            <TeamSelector onSelect={handleTeamSelect} />
        )}
        </div>

    </div>
  );
}
