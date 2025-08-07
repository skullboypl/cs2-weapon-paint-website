import { useEffect, useState } from 'react';
import './../styles/StickerPopup.css';

export default function StickerPopup({ stickers, selectedStickers, onSelect, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(0); 
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedQuery = searchTerm.toLowerCase().trim();
  const searchWords = normalizedQuery.split(/\s+/);

  const filteredStickers = stickers.filter(sticker => {
    const name = sticker.name.toLowerCase();
    return searchWords.every(word => name.includes(word));
  });

  const maxLimit = 600; // max first results for performance
  const displayedStickers = filteredStickers.slice(0, maxLimit);

  useEffect(() => {
    setLoaded(true); // lazy load sticker list only when popup is open
  }, []);

  const handleStickerClick = (sticker) => {
    if (selectedSlot !== null) {
      onSelect(selectedSlot, sticker); 
    }
  };

  return (
    <div className="sticker-popup">
      <h3>Choose stickers</h3>

      <div className="sticker-slots-preview">
        {selectedStickers.map((sticker, i) => (
          <div
            key={i}
            className={`sticker-slot-box ${selectedSlot === i ? 'selected-slot' : ''}`}
            onClick={() => setSelectedSlot(i)} 
          >
            {sticker ? (
               <>
            <img src={sticker.image} alt={sticker.name} />
            <button
              className="remove-sticker-btn"
              onClick={(e) => {
                e.stopPropagation(); 
                onSelect(i, null); 
              }}
            >
            ✕
          </button>
        </>
            ) : (
              <div className="empty-slot">+</div>
            )}
          </div>
        ))}
      </div>
      <input
        type="text"
        className="sticker-search"
        placeholder="Find sticker..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {loaded && (
        <div className="sticker-list">
            {displayedStickers.map(st => (
            <div
                key={st.id}
                className="sticker-item"
                onClick={() => handleStickerClick(st)}
            >
                <img
                src={st.image}
                alt={st.name}
                loading="lazy"
                />
                <span>{st.name}</span>
            </div>
            ))}
            {filteredStickers.length > maxLimit && (
            <div className="sticker-list-info">
                Shown only {maxLimit} of {filteredStickers.length} results — please refine your search.
            </div>
            )}
        </div>
        )}



      <button className="close-btn" onClick={onClose}>Close</button>
    </div>
  );
}
