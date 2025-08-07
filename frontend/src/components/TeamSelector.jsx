import './../styles/TeamSelector.css';

export default function TeamSelector({ onSelect }) {
  return (
    <div className="team-selector">
      <h2>CHOOSE TEAM</h2>
      <div className="team-options">
        <div className="team-card ct" onClick={() => onSelect('CT')}>
          <h3>CT</h3>
          <img src="/images/ct.png" alt="CT" />
          <p>COUNTER-TERRORIST</p>
        </div>
        <div className="team-card t" onClick={() => onSelect('T')}>
          <h3>T</h3>
          <img src="/images/tt.png" alt="T" />
          <p>TERRORIST</p>
        </div>
      </div>
    </div>
  );
}
