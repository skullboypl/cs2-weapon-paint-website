import { useEffect, useState } from 'react';
import './../styles/StickerPopup.css';

export default function StickerPopup({ stickers, selectedStickers, onSelect, onClose }) {
  const [loaded, setLoaded] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null); 
  const [searchTerm, setSearchTerm] = useState('');

  const normalizedQuery = searchTerm.toLowerCase().trim();
  const searchWords = normalizedQuery.split(/\s+/);

    const filteredStickers = stickers.filter(sticker => {
    const name = sticker.name.toLowerCase();
    return searchWords.every(word => name.includes(word));
    });
    const displayedStickers = filteredStickers.slice(0, 500); // max 800 pierwszych


  useEffect(() => {
    //console.log('selectedStickers in popup:', selectedStickers);
    setLoaded(true); // lazy load sticker list only when popup is open
  }, []);

  const handleStickerClick = (sticker) => {
    if (selectedSlot !== null) {
      onSelect(selectedSlot, sticker); // przypisz tylko do wybranego slotu
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
            onClick={() => setSelectedSlot(i)} // klik w slot = aktywacja
          >
            {sticker ? (
              <img src={sticker.image} alt={sticker.name} />
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
            {filteredStickers.length > 500 && (
            <div className="sticker-list-info">
                Shown only 500 of {filteredStickers.length} results — please refine your search.
            </div>
            )}
        </div>
        )}



      <button className="close-btn" onClick={onClose}>Close</button>
    </div>
  );
}
