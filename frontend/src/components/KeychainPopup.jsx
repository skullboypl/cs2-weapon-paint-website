// KeychainPopup.jsx
import { useState, useEffect } from 'react';
import './../styles/KeychainPopup.css'; // styl możesz skopiować ze StickerPopup

export default function KeychainPopup({ keychains, selectedKeychainId, offsetX, offsetY, onSelect, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [localOffsetX, setLocalOffsetX] = useState(offsetX);
  const [localOffsetY, setLocalOffsetY] = useState(offsetY);

  const filteredKeychains = keychains.filter(kc =>
    kc.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="keychain-popup">
      <h3>Choose keychain</h3>

      <input
        type="text"
        className="keychain-search"
        placeholder="Find keychain..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="keychain-list">
        {filteredKeychains.map(kc => (
          <div
            key={kc.id}
            className={`keychain-item ${kc.id === selectedKeychainId ? 'selected' : ''}`}
           onClick={() => {
            onSelect(kc.id, localOffsetX, localOffsetY);
            }}
          >
            <img src={kc.image} alt={kc.name} />
            <span>{kc.name}</span>
          </div>
        ))}
      </div>

      <div className="offset-controls">
        <label>Offset X:
          <input type="number" value={localOffsetX} onChange={e => setLocalOffsetX(Number(e.target.value))} />
        </label>
        <label>Offset Y:
          <input type="number" value={localOffsetY} onChange={e => setLocalOffsetY(Number(e.target.value))} />
        </label>
      </div>

      <button
        className="close-btn"
        onClick={() => {
            onSelect(selectedKeychainId, localOffsetX, localOffsetY);
            onClose();
        }}
        >
        Close
    </button>

    </div>
  );
}
