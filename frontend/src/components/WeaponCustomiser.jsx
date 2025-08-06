// WeaponCustomizer.jsx
import { useEffect, useState } from 'react';
import './../styles/WeaponCustomizer.css';
import StickerPopup from './StickerPopupUI';
import KeychainPopup from './KeychainPopup';

export default function WeaponCustomizer({ weapon, onClose, onSave }) {
  const [skins, setSkins] = useState([]);
  const [selectedSkin, setSelectedSkin] = useState(null);
  const [wear, setWear] = useState(0);
  const [seed, setSeed] = useState(0);
  const [nametag, setNametag] = useState('');
  const [statTrakEnabled, setStatTrakEnabled] = useState(false);
  const [statTrakKills, setStatTrakKills] = useState(0);
  const [keychains, setKeychains] = useState([]);
  const [keychainId, setKeychainId] = useState('');
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [stickers, setStickers] = useState([]);
  const [selectedStickers, setSelectedStickers] = useState([null, null, null, null]); 
  const [showStickerPopup, setShowStickerPopup] = useState(false);
  const [showKeychainPopup, setShowKeychainPopup] = useState(false);
const isKnife = weapon.name.includes('knife') || weapon.name.includes('bayonet');


  useEffect(() => {
    //console.log('Weapon data:', JSON.stringify(weapon, null, 2));

    fetch('/data/skins_en.json')
    .then(res => res.json())
    .then(data => {
      const matchingSkins = data.filter(s => s.weapon_name.endsWith(weapon.name));
      setSkins(matchingSkins);
      const selected = matchingSkins.find(skin =>
        Number(skin.paint) === Number(weapon.savedPaint) 
      );
     // console.log('Matching skins:', matchingSkins);
       // console.log('Selected skin:', selected);
      setSelectedSkin(selected || null);
    });

    fetch('/data/keychains_en.json')
      .then(res => res.json())
      .then(setKeychains);

      fetch('/data/stickers_en.json')
        .then(res => res.json())
        .then(setStickers);
  }, [weapon]);

    useEffect(() => {
        // var dump weapon data
        //console.log('Weapon data:', JSON.stringify(weapon, null, 2));
        setWear(weapon.savedWear ?? 0);
        setSeed(weapon.savedSeed ?? 0);
        setNametag(weapon.savedNametag ?? '');
        setStatTrakEnabled(weapon.savedStatTrakEnabled ?? false);
        setStatTrakKills(weapon.savedStatTrakKills ?? 0);
        setKeychainId(weapon.savedKeychainId ?? '');
        setOffsetX(weapon.savedKeychainOffsetX ?? 0);
        setOffsetY(weapon.savedKeychainOffsetY ?? 0);
       // setSelectedStickers(weapon.savedStickers ?? [null, null, null, null]);
    }, [weapon]);

   useEffect(() => {
        if (!stickers.length || !weapon.savedStickers) return;

    // console.log('>>> weapon.savedStickers:', weapon.savedStickers);
        //console.log('>>> stickers (first 5):', stickers.slice(0, 5)); 

    const converted = weapon.savedStickers.map(id =>
        stickers.find(st => Number(st.id) === Number(id)) || null
        );

    // console.log('>>> Converted stickers:', converted);
        setSelectedStickers(converted);
    }, [stickers, weapon]);

    useEffect(() => {
        if (!isKnife) {
            setKeychainId(weapon.savedKeychainId ?? '');
            setOffsetX(weapon.savedKeychainOffsetX ?? 0);
            setOffsetY(weapon.savedKeychainOffsetY ?? 0);
            setSelectedStickers(weapon.savedStickers ?? [null, null, null, null]);
        }
    }, [weapon]);

    const handleSave = () => {
        onSave({
            weapon_defindex: weapon.cs2_id,
            paint: selectedSkin?.paint ?? 0,
            wear,
            seed,
            nametag,
            statTrak: statTrakEnabled ? statTrakKills : null,
            keychainId: isKnife ? null : keychainId,
            offsetX: isKnife ? 0 : offsetX,
            offsetY: isKnife ? 0 : offsetY,
            stickers: isKnife ? [] : selectedStickers.map(s => s?.id ?? 0),
            image: selectedSkin?.image ?? null
        });
    };


  return (
    <div className="weapon-customizer-container">
      <div className="weapon-customizer-header">
        <span>Weapon: {weapon.name.replace('weapon_', '').replace(/_/g, ' ')}</span>
        <button onClick={onClose}>Change another skin</button>
      </div>
      <div className="weapon-customizer-body">
      {showStickerPopup && (
        <StickerPopup
            stickers={stickers}
            selectedStickers={selectedStickers}
            onSelect={(slot, sticker) => {
                const updated = [...selectedStickers];
                updated[slot] = sticker;
                setSelectedStickers(updated);
            }}
            onClose={() => setShowStickerPopup(false)}
            />

      )}
     {showKeychainPopup && (
        <KeychainPopup
            keychains={keychains}
            selectedKeychainId={keychainId}
            offsetX={offsetX}
            offsetY={offsetY}
            onSelect={(id, x, y) => {
            setKeychainId(id);
            setOffsetX(x);
            setOffsetY(y);
            }}
            onClose={() => setShowKeychainPopup(false)} // ✅ zamyka dopiero tutaj
        />
      )}


        <div className="left-panel">
            <div className="skin-list">
            {skins.map(skin => (
                <button
                key={skin.paint}
                className={`skin-button ${Number(selectedSkin?.paint) === Number(skin.paint) ? 'selected' : ''}`}
                onClick={() => setSelectedSkin(skin)}
                >
                <img
                    src={skin.image}
                    alt={skin.paint_name}
                    className="skin-thumb"
                />
                </button>
            ))}
            </div>
          <label>Wear:
            <input type="number" min="0" max="1" step="0.01" value={wear} onChange={e => setWear(Number(e.target.value))} />
          </label>
          <label>Seed:
            <input type="number" min="0" max="999" value={seed} onChange={e => setSeed(Number(e.target.value))} />
          </label>
          <label>NameTag:
            <input type="text" value={nametag} onChange={e => setNametag(e.target.value)} placeholder="Brak (NULL)" />
          </label>
          <label>StatTrak:
            <input type="checkbox" checked={statTrakEnabled} onChange={e => setStatTrakEnabled(e.target.checked)} />
          </label>
          {statTrakEnabled && (
            <label>Kills:
              <input type="number" value={statTrakKills} onChange={e => setStatTrakKills(Number(e.target.value))} />
            </label>
          )}
          {!isKnife && (
            <>
                <label>Stickers:</label>
                <button onClick={() => setShowStickerPopup(true)}>Choose Stickers</button>

                <label>Keychain:</label>
                <button onClick={() => setShowKeychainPopup(true)}>Choose Keychain</button>
            </>
            )}
          <div className="buttons">
            <button onClick={onClose}>Cancel</button>
            <button onClick={handleSave}>Save</button>
          </div>
        </div>

        <div className="right-panel">
            <div className="weapon-preview">
                {selectedSkin ? (
                <img
                    src={selectedSkin.image}
                    alt={selectedSkin.paint_name}
                    className="preview-image"
                />
                ) : (
                <div className="no-skin">Wybierz skin</div>
                )}
               <div className="preview-details">
                <h3>{weapon.name.replace('weapon_', '').replace(/_/g, ' ')}</h3>
                {selectedSkin && (
                    <>
                    <p>Skin: {selectedSkin.paint_name}</p>
                    <p className='nametag_prev'>Nametag: {nametag || 'Brak'}</p>
                    <p>Wear: {wear} | Seed: {seed}</p>
                    <p>StatTrak: {statTrakEnabled ? statTrakKills : 'Brak'}</p>
                        {!isKnife && (
                        <>
                            <div className="preview-keychain">
                                <p>Keychain:</p>
                                {keychainId ? (
                                <div className="keychain-preview">
                                    <img
                                    src={keychains.find(k => k.id === keychainId)?.image}
                                    alt="Keychain"
                                    className="keychain-img"
                                    />
                                    <span>{keychains.find(k => k.id === keychainId)?.name}</span>
                                    <p>X: {offsetX} Y: {offsetY}</p>
                                </div>
                                ) : (
                                <p>Brak</p>
                                )}
                            </div>

                            <div className="preview-stickers">
                                <p>Stickers:</p>
                                <div className="sticker-preview-list">
                                {selectedStickers.map((sticker, i) =>
                                    sticker ? (
                                    <div key={i} className="sticker-preview">
                                        <img src={sticker.image} alt={sticker.name} className="sticker-img" />
                                        <span>{sticker.name}</span>
                                    </div>
                                    ) : (
                                    <div key={i} className="sticker-preview empty">Brak</div>
                                    )
                                )}
                                </div>
                            </div>
                        </>
                        )}
                    </>
                )}
                </div>

            </div>
        </div>
      </div>
    </div>
  );
}
