// WeaponCustomizer.jsx
import React, { useEffect, useState } from 'react';
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
  const isAgent = weapon.name.includes('agent');
  const isGloves = weapon.name.includes('gloves');
  const isPin = weapon.name.includes('pin');
  const isCustom = weapon.category === 'Other';

 useEffect(() => {
    if (!isCustom) return;
    if (isAgent) {
      weapon.custom = 'agent';
    } else if (isGloves) {
      weapon.custom = 'gloves';
    } else if (isPin) {
      weapon.custom = 'pin';
    } else {
      weapon.custom = 'other';
    }
  }, [weapon]);
  useEffect(() => {
    //console.log('isCustom:', isCustom, ' Is Agent:', isAgent, ' Is Knife:', isKnife, ' Is Gloves:', isGloves, ' Is Pin:', isPin);
    //console.log('Weapon data:', JSON.stringify(weapon, null, 2));
    if (isCustom) return;
    fetch('/data/skins_en.json')
    .then(res => res.json())
    .then(data => {
      const matchingSkins = data.filter(s => s.weapon_name.endsWith(weapon.name));
      setSkins(matchingSkins);
      const selected = matchingSkins.find(skin =>
        Number(skin.paint) === Number(weapon.savedPaint) 
      );
      //add key to 
      matchingSkins.forEach((skin, index) => {
        skin.key = `skin_${skin.paint}_${index}`;
      });
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
        if (isCustom) return;
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
        if (isCustom) return;
        if (!stickers.length || !weapon.savedStickers) return;
        const converted = weapon.savedStickers.map(id =>
            stickers.find(st => Number(st.id) === Number(id)) || null
        );
        setSelectedStickers(converted);
    }, [stickers, weapon]);

    useEffect(() => {
        if (isCustom) return;
        if (!isKnife) {
            setKeychainId(weapon.savedKeychainId ?? '');
            setOffsetX(weapon.savedKeychainOffsetX ?? 0);
            setOffsetY(weapon.savedKeychainOffsetY ?? 0);
            setSelectedStickers(weapon.savedStickers ?? [null, null, null, null]);
        }
    }, [weapon]);

    useEffect(() => {
       if(!isCustom) return;
       let name = weapon.name;
       if (name.includes('ct_agent')) {
           weapon.customname = "Agent | Default";
           weapon.team = 3; // CT
       }
        if (name.includes('tt_agent')) {
            weapon.customname = "Agent | Default";
            weapon.team = 2; // T
        }
        if (weapon.image) {
            setSelectedSkin({
                paint_name: name,
                image: weapon.image,
                model: weapon.model ? weapon.model : "Default Model",
            });
        } 
    }, [weapon]);


      useEffect(() => {
          if (!isCustom || !isAgent) return;
          console.log('AGENT data:', JSON.stringify(weapon, null, 2));
          const team = weapon.team ?? '3'; // domyślnie CT jeśli brak

          fetch('/data/agents_en.json')
            .then(res => res.json())
            .then(data => {
              const matchingSkins = data;
              const filteredSkins = matchingSkins.filter(skin => skin.team === team);
              const filteredSkinsNoIMG = filteredSkins.filter(skin => skin.image && skin.image.trim() !== '');
              //add LP to filteredSkinsNoIMG as .paint 
              let i = 0;
              filteredSkinsNoIMG.forEach(skin => {
                skin.key = `agent_${i}`;
                skin.paint_name = skin.agent_name || 'Default Agent';
                i++;
              });
              setSelectedSkin({
                paint_name: weapon.agent_name || 'Default Agent',
                image: weapon.image,
                model: weapon.model ? weapon.model : "Default Model",
            });
              setSkins(filteredSkinsNoIMG);
            });
    }, [weapon]);

    useEffect(() => {
          if (!isCustom || !isGloves) return;
          //console.log('Weapon data:', JSON.stringify(weapon, null, 2));
          let team = weapon.team ?? '3'; // domyślnie CT jeśli brak
          setWear(weapon.wear ?? 0);
          setSeed(weapon.seed ?? 0);
          fetch('/data/gloves_en.json')
            .then(res => res.json())
            .then(data => {
              const matchingSkins = data;
              matchingSkins.forEach(skin => {
                if (!skin.image || skin.image.trim() === '') {
                  if(Number(team) === 2) {
                    skin.image = '/others/tt_gloves.png'; // default image for T
                  } else {
                    skin.image = '/others/ct_gloves.png'; // default image for CT
                  }
                }
                skin.key = `${skin.weapon_defindex}_${skin.paint}`;
              });
              // GLOVES have model as weapon_defindex and paint as PAINT model has to be added to wp_player_gloves table and paint as PAINT in skins table
              const selected = matchingSkins.find(glove =>
                glove.weapon_defindex === weapon.defindex &&
                Number(glove.paint) === Number(weapon.paint)
              );
              setSelectedSkin(selected || null);
              setSkins(matchingSkins);
            });
    }, [weapon]);


    const handleSave = () => {
      if (isCustom){
        if(isAgent) {
          return onSave({
            type: 'custom',
            other: weapon.custom,
            model: selectedSkin?.model || 'Default Model',
            team: selectedSkin?.team || null,
            name_main: weapon.name || 'NONE',
            image: selectedSkin?.image || null,
          });
        }
        if(isGloves) {
          return onSave({
            type: 'custom',
            other: weapon.custom,
            paint: selectedSkin?.paint ?? 0,
            team: weapon.team || null,
            defindex: selectedSkin?.weapon_defindex || 0,
            image: selectedSkin?.image || null,
            name_main: weapon.name || 'NONE',
            wear: wear,
            seed: seed,
          });
        }
      }
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
            image: selectedSkin?.image ?? null,
            type: weapon.type ? weapon.type : '_'
        });
    };


  return (
    <div className="weapon-customizer-container">
      <div className="weapon-customizer-header">
        <span>Weapon: {weapon.name.replace('weapon_', '').replace(/_/g, ' ')}</span>
        <button onClick={onClose}>Change another skin</button>
      </div>
      <div className="weapon-customizer-body">
      {!isCustom && (
        <>
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
        </>
      )}


        <div className="left-panel">
            <div className="skin-list">
            {skins.map(skin => (
                <React.Fragment key={skin.key}>
                  <button
                  className={`skin-button ${Number(selectedSkin?.paint) === Number(skin.paint) ? 'selected' : ''}`}
                  onClick={() => setSelectedSkin(skin)}
                  >
                  <img
                      src={skin.image}
                      alt={skin.paint_name}
                      className="skin-thumb"
                  />
                  </button>
                </React.Fragment>
            ))}
            </div>
          <div className="skin-details-settings">
            <div className="skin-details-settings-labels">
              {(!isCustom || isGloves) && (
                <>
                  <div className="skin-details-group">
                    <label>Wear (ex. 0,15):
                      <input type="number" min="0" max="1" step="0.01" value={wear} onChange={e => setWear(Number(e.target.value))} />
                    </label>
                    <label>Seed (ex. 123):
                      <input type="number" min="0" max="999" value={seed} onChange={e => setSeed(Number(e.target.value))} />
                    </label>
                  </div>
                  {!isGloves && (
                    <>
                      <label>NameTag:
                        <input type="text" maxLength={25} value={nametag} onChange={e => setNametag(e.target.value)} placeholder="None (NULL)" />
                      </label>
                      <div className="skin-details-group">
                        <label>StatTrak:
                          <input type="checkbox" checked={statTrakEnabled} onChange={e => setStatTrakEnabled(e.target.checked)} />
                        </label>
                        {statTrakEnabled && (
                          <label>Kills:
                            <input type="number" maxLength={10} value={statTrakKills} onChange={e => setStatTrakKills(Number(e.target.value))} />
                          </label>
                        )}
                      </div>
                    </>
                  )}
                  {(!isKnife && !isGloves) && (
                    <>
                        <div className="skin-details-group">
                          <label>Stickers:</label>
                          <button onClick={() => setShowStickerPopup(true)}>Choose Stickers</button>

                          <label>Keychain:</label>
                          <button onClick={() => setShowKeychainPopup(true)}>Choose Keychain</button>
                        </div>
                    </>
                    )}
                </>
              )}
            </div>
            <div className="buttons">
              <button onClick={onClose}>Cancel</button>
              <button onClick={handleSave}>Save</button>
            </div>
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
                    {!isCustom || isGloves ? (
                      <>
                      {!isGloves && (
                        <>
                          <p className='nametag_prev'>Nametag: {nametag || 'None'}</p>
                        </>
                      )}
                      <p>Wear: {wear} | Seed: {seed}</p>
                      {!isGloves && (
                        <>
                      <p>StatTrak: {statTrakEnabled ? statTrakKills : 'None'}</p>
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
                                  <p>None</p>
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
                                      <div key={i} className="sticker-preview empty">None</div>
                                      )
                                  )}
                                  </div>
                              </div>
                          </>
                          )}
                      </>
                      )}
                      </>
                    ) : (
                      <>
                      <label>Model: {selectedSkin.model || "Default Model"}</label>
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
