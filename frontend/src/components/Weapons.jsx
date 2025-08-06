import { useState, useEffect, useRef } from 'react';
import './../styles/Weapons.css';
import WeaponCustomizer from './WeaponCustomiser';

export default function Weapons({ team }) {
  const [weapons, setWeapons] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('Rifle');
  const [selectedKnifeModel, setSelectedKnifeModel] = useState('knife');
  const [isDropdownOpen, setDropdownOpen] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const [dbSkins, setDbSkins] = useState([]);
  const API_URL = import.meta.env.VITE_API_URL || "/api/";

  const dropdownRef = useRef(null);

    useEffect(() => {
    const loadAll = async () => {
        try {
        // 1. Wczytaj weapons.json i przefiltruj po teamie
        const resWeapons = await fetch('/weapons.json');
        const weaponsData = await resWeapons.json();
        const filtered = weaponsData.filter(w =>
            w.team === 'Both' || w.team === team
        );

        // 2. Pobierz aktualny knife model z bazy
        const resKnife = await fetch(`${API_URL}/knife.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            credentials: 'include',
            body: new URLSearchParams({
            action: 'get',
            team
            })
        });

        const knifeData = await resKnife.json();
        if (knifeData.knife) {
            setSelectedKnifeModel(knifeData.knife);
        }

        // 3. Pobierz wszystkie ustawione skiny gracza z bazy
        const resSkins = await fetch(`${API_URL}/skins.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            credentials: 'include',
            body: new URLSearchParams({
            action: 'getall',
            team
            })
        });

        const dbSkins = await resSkins.json(); // [{ weapon_defindex, weapon_paint_id }, ...]
        setDbSkins(dbSkins);
        // 4. Pobierz mapowanie skinów z pliku
        const resSkinMap = await fetch('/data/skins_en.json');
        const skinMap = await resSkinMap.json();

        // 5. Połącz dane
        const finalWeapons = filtered.map(w => {
            const dbSkin = dbSkins.find(s => s.weapon_defindex === w.cs2_id);
            if (dbSkin) {
            const matchedSkin = skinMap.find(s =>
                Number(s.weapon_defindex) === Number(dbSkin.weapon_defindex) &&
                Number(s.paint) === Number(dbSkin.weapon_paint_id)
            );
            if (matchedSkin?.image) {
                return { ...w, image: matchedSkin.image };
            }
            }
            return w;
        });

        setWeapons(finalWeapons);

        } catch (err) {
        console.error('Błąd ładowania danych:', err);
        }
    };

    loadAll();
    }, [team]);


  // knife modele
  const knifeModels = weapons.filter(w => w.category === 'Knife');

  const categories = [...new Set(weapons.map(w => w.category))];
  const filteredByCategory = weapons.filter(w => w.category === selectedCategory);

  // zamykanie dropdowna po kliknięciu poza
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


const handleWeaponClick = (weapon) => {
  const weaponSkin = dbSkins.find(s => s.weapon_defindex === weapon.cs2_id);
  //console.log('Selected weapon skin:', weaponSkin);

  if (!weaponSkin) {
    setSelectedWeapon(weapon);
    return;
  }

  // wyciąganie ID z formatu id;x;y;wear;scale;rotation
  const parseStickerId = (val) => {
    if (!val || val === '0;0;0;0;0;0;0') return null;
    const parts = val.split(';');
    const id = parseInt(parts[0]);
    return isNaN(id) || id === 0 ? null : id;
  };

  // wyciąganie ID i offsetów z weapon_keychain
  const parseKeychain = (val) => {
    if (!val || val === '0;0;0;0;0') return { id: '', offsetX: 0, offsetY: 0 };
    const parts = val.split(';');
    return {
      id: parts[0] || '',
      offsetX: parseInt(parts[1]) || 0,
      offsetY: parseInt(parts[2]) || 0,
    };
  };

  const keychainData = parseKeychain(weaponSkin.weapon_keychain);

  setSelectedWeapon({
    ...weapon,
    savedPaint: weaponSkin.weapon_paint_id,
    savedWear: weaponSkin.weapon_wear,
    savedSeed: weaponSkin.weapon_seed,
    savedNametag: weaponSkin.weapon_nametag,
    savedStatTrakEnabled: weaponSkin.weapon_stattrak === 1,
    savedStatTrakKills: weaponSkin.weapon_stattrak_count,

    savedKeychainId: keychainData.id,
    savedKeychainOffsetX: keychainData.offsetX,
    savedKeychainOffsetY: keychainData.offsetY,

    savedStickers: [
      parseStickerId(weaponSkin.weapon_sticker_0),
      parseStickerId(weaponSkin.weapon_sticker_1),
      parseStickerId(weaponSkin.weapon_sticker_2),
      parseStickerId(weaponSkin.weapon_sticker_3)
    ]
  });
};

const handleSaveWeapon = async (data) => {
  const params = new URLSearchParams();
  params.append('action', 'save');
  params.append('team', team); // 'CT' lub 'T'

  // Nazwa broni do weapon_defindex mapujesz po stronie PHP
params.append('weapon_defindex', data.weapon_defindex); 
  params.append('paint', data.paint);
  params.append('wear', data.wear);
  params.append('seed', data.seed);
  params.append('nametag', data.nametag ?? '');
  params.append('stattrak', data.statTrak ?? '');
  params.append('keychainId', data.keychainId);
  params.append('offsetX', data.offsetX || 0);
  params.append('offsetY', data.offsetY || 0);

  // Stickery – każdy slot musi mieć pełny string np. id;0;0;0;1;0
  for (let i = 0; i < 4; i++) {
    const id = data.stickers?.[i] ?? 0;
    //const stickerFull = `${id};0;0;0;1;0`; // id;schema;x;y;scale;rotation
    params.append(`weapon_sticker_${i}`, id);
  }

  try {
    const res = await fetch(`${API_URL}/skins.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      credentials: 'include',
      body: params
    });

    const result = await res.json();
    console.log('Zapisano skina:', result);
  } catch (err) {
    console.error('Błąd zapisu skina:', err);
  }
};



  return (
  <div className="weapons-section">
    {!selectedWeapon ? (
      <>
        <div className="weapon-categories">
          {categories.map(cat => (
            <button
              key={cat}
              className={`category-button ${cat === selectedCategory ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

       
      {selectedCategory === 'Knife' && (
        <div className="knife-dropdown-wrapper" ref={dropdownRef}>
         <div className="dropdown-header" onClick={() => setDropdownOpen(!isDropdownOpen)}>
            {
                (() => {
                const selectedKnife = knifeModels.find(k =>
                    k.name.endsWith(selectedKnifeModel) || k.image.includes(selectedKnifeModel)
                );

                return (
                    <>
                    <img
                        src={selectedKnife?.image || '/weapons/weapon_knife.png'}
                        alt={selectedKnifeModel}
                        width={32}
                        height={32}
                    />
                    <span>
                        {
                        selectedKnife
                            ? selectedKnife.name.replace('weapon_', '').replace(/_/g, ' ')
                            : selectedKnifeModel.replace(/_/g, ' ')
                        }
                    </span>
                    <span className="arrow">{isDropdownOpen ? '▲' : '▼'}</span>
                    </>
                );
                })()
            }
            </div>



          {isDropdownOpen && (
            <div className="dropdown-list">
              {knifeModels.map(knife => (
                <div
                  key={knife.id}
                  className={`dropdown-item ${knife.name === selectedKnifeModel ? 'selected' : ''}`}
                 onClick={() => {
                    setSelectedKnifeModel(knife.name);
                    setDropdownOpen(false);
                    fetch(`${API_URL}/knife.php`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        credentials: 'include',
                        body: new URLSearchParams({
                            action: 'set',
                            team,
                            knife: knife.name
                        })
                    });

                    }}
                >
                  <img src={knife.image} alt={knife.name} width={32} height={32} />
                  <span>{knife.name.replace('weapon_', '').replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

        <div className="weapons-grid">
          {filteredByCategory.map((weapon, index) => {
            if (weapon.name === 'knife') return null;
            const weaponId = weapon.cs2_id ?? `fake-${index}`;

            return (
              <div
                key={weaponId}
                className="weapon-card"
                onClick={() => handleWeaponClick(weapon)}
              >
                <img src={weapon.image} alt={weapon.name} className="weapon-img" />
                <div className="weapon-name">{weapon.name}</div>
              </div>
            );
          })}
        </div>
      </>
    ) : (
      <WeaponCustomizer
        weapon={selectedWeapon}
        onClose={() => setSelectedWeapon(null)}
        onSave={async (data) => {
      await handleSaveWeapon(data); // call API save

  // 1. Update dbSkins[] (to update the database)
    setDbSkins(prev => {
        const copy = [...prev];
        const index = copy.findIndex(s => s.weapon_defindex === data.weapon_defindex);

        if (index !== -1) {
        copy[index] = {
            ...copy[index],
            weapon_paint_id: data.paint,
            weapon_wear: data.wear,
            weapon_seed: data.seed,
            weapon_nametag: data.nametag,
            weapon_stattrak: data.statTrak ? 1 : 0,
            weapon_stattrak_count: data.statTrak || 0,
            weapon_keychain: `${data.keychainId || 0};${data.offsetX || 0};${data.offsetY || 0};0`,
            weapon_sticker_0: `${data.stickers?.[0] ?? 0};0;0;0;1;0`,
            weapon_sticker_1: `${data.stickers?.[1] ?? 0};0;0;0;1;0`,
            weapon_sticker_2: `${data.stickers?.[2] ?? 0};0;0;0;1;0`,
            weapon_sticker_3: `${data.stickers?.[3] ?? 0};0;0;0;1;0`
        };
        } else {
        copy.push({
            weapon_defindex: data.weapon_defindex,
            weapon_paint_id: data.paint,
            weapon_wear: data.wear,
            weapon_seed: data.seed,
            weapon_nametag: data.nametag,
            weapon_stattrak: data.statTrak ? 1 : 0,
            weapon_stattrak_count: data.statTrak || 0,
            weapon_keychain: `${data.keychainId || 0};${data.offsetX || 0};${data.offsetY || 0};0`,
            weapon_sticker_0: `${data.stickers?.[0] ?? 0};0;0;0;1;0`,
            weapon_sticker_1: `${data.stickers?.[1] ?? 0};0;0;0;1;0`,
            weapon_sticker_2: `${data.stickers?.[2] ?? 0};0;0;0;1;0`,
            weapon_sticker_3: `${data.stickers?.[3] ?? 0};0;0;0;1;0`
        });
        }

        return copy;
    });

    // 2. Update weapons[] (to update the image)
    setWeapons(prev => {
        return prev.map(w =>
        w.cs2_id === data.weapon_defindex && data.image
            ? { ...w, image: data.image }
            : w
        );
    });

    // 3. Close Customizer
    setSelectedWeapon(null);
    }}

      />
    )}
  </div>
);

}
