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
  const API_URL = import.meta.env.VITE_API_URL || "/api";
  const [agent_T, setAgent_T] = useState(null);
  const [agent_CT, setAgent_CT] = useState(null);

  const [gloves_T, setGloves_T] = useState(null);
  const [gloves_CT, setGloves_CT] = useState(null);

  const dropdownRef = useRef(null);

  useEffect(() => {
    const loadAll = async () => {
        try {
          // load weapons json base
        const resWeapons = await fetch('/weapons.json');
        const weaponsData = await resWeapons.json();
        const filtered = weaponsData.filter(w =>
            w.team === 'Both' || w.team === team
        );
        //load info about knife from API
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
        if (knifeData.errorDB) {
            alert(knifeData.errorDB);
            return;
        }
        if (knifeData.error) {
          console.warn(knifeData.error);
        }
        if (knifeData.knife) {
            setSelectedKnifeModel(knifeData.knife);
        }

        // load all skins weapons from DB
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
        //console.log('DB Skins:', dbSkins);
        if (dbSkins.errorDB) {
            alert(dbSkins.errorDB);
            return;
        }
        if (dbSkins.error) {
            console.warn(dbSkins.error);
        }
        // Pobierz agentów gracza
        const resAgents = await fetch(`${API_URL}/skins.php`, {
           method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            credentials: 'include',
            body: new URLSearchParams({
            action: 'agent_get',
            team
            })
        });
        const agentsJson = await resAgents.json();
        //console.log('Agents data:', agentsJson);
        if (agentsJson.errorDB) {
            alert(agentsJson.errorDB);  
            return;
        }
        if (agentsJson.error) {
            console.warn(agentsJson.error);
        }
        const agentsMap = await fetch('/data/agents_en.json');
        const agentsData = await agentsMap.json();
        const agentT = agentsData.find(a => a.model === agentsJson.agent_t);
        const agentCT = agentsData.find(a => a.model === agentsJson.agent_ct);
        setAgent_T(agentT);
        setAgent_CT(agentCT);

        // download gloves_defiinition from DB of models cuz skins defindex are 0 of gloves
        const resGloves = await fetch(`${API_URL}/skins.php`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            credentials: 'include',
            body: new URLSearchParams({
            action: 'gloves_addon_data',
            team
            })
        });
        const glovesData = await resGloves.json();
        //console.log('Gloves data:', glovesData);
        if (glovesData.errorDB) {
            alert(glovesData.errorDB);
            return;
        }
        if (glovesData.error) {
          console.warn(glovesData.error);
        }
        const mergedGloves = glovesData.gloves_models.map(model => {
          const skin = glovesData.gloves_skins?.find(s => Number(s.weapon_team) === Number(model.weapon_team)
        );
          return {
            team: model.weapon_team,
            defindex: model.weapon_defindex,
            paint_id: skin?.weapon_paint_id ?? 0,
            wear: skin?.weapon_wear ?? 0,
            seed: skin?.weapon_seed ?? 0
          };
        });
        const glovesMap = await fetch('/data/gloves_en.json');
        const glovesJson = await glovesMap.json();

        const buildGloves = (teamId) => {
            const base = mergedGloves.find(g => Number(g.team) === Number(teamId));
            if (!base) return null;

            const skin = glovesJson.find(g =>
              Number(g.weapon_defindex) === Number(base.defindex) &&
              Number(g.paint) === Number(base.paint_id ?? 0)
            );

            return {
              team: teamId,
              defindex: base.defindex,
              paint: base.paint_id ?? 0,
              wear: base.wear ?? 0,
              seed: base.seed ?? 0,
              image: skin?.image || `/others/${teamId === 2 ? 'tt' : 'ct'}_gloves.png`,
              name: skin?.name, 
            };
        };

        const glovesT  = buildGloves(2);
        const glovesCT = buildGloves(3);

        setGloves_T(glovesT);
        setGloves_CT(glovesCT);
         //console.log('Gloves T:', glovesT);
        //console.log('Gloves CT:', glovesCT);

        setDbSkins(dbSkins);
        // map skins with img
        const resSkinMap = await fetch('/data/skins_en.json');
        const skinMap = await resSkinMap.json();
        // merge final skins weapon list
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
        //find weapon.name = "ct_agent" or "tt_agent"
        const updatedWeapons = finalWeapons.map(w => {
          if (w.name === 'ct_agent') {
            return {
              ...w,
              image: agentCT?.image || '/agents/ct_sas.png',
              model: agentCT?.model || 'null',
              team: 3 // CT
            };
          }
          if (w.name === 'tt_agent') {
            return {
              ...w,
              image: agentT?.image || '/agents/tt_phoenix.png',
              model: agentT?.model || 'null',
              team: 2 // T
            };
          }
          if(w.name === 'tt_gloves') {
            return {
              ...w,
              image: glovesT?.image || '/others/tt_gloves.png',
              type: 'gloves' ,
              team: 2, // T,
              defindex: glovesT?.defindex || 0,
              paint: glovesT?.paint || 0,
              wear: glovesT?.wear || 0,
              seed: glovesT?.seed || 0
            };
          }
          if(w.name === 'ct_gloves') {
            return {
              ...w,
              image: glovesCT?.image || '/others/ct_gloves.png',
              type: 'gloves',
              team: 3, // CT
              defindex: glovesCT?.defindex || 0,
              paint: glovesCT?.paint || 0,
              wear: glovesCT?.wear || 0,
              seed: glovesCT?.seed || 0
            };
          }
          return w;
        });
        const toPreload = updatedWeapons.map(w => w.image).filter(Boolean).slice(0, 24);
        await preloadImages(toPreload); // preload images for performance
        setWeapons(updatedWeapons);

        } catch (err) {
        console.error('Error loading data:', err);
        }
    };

    loadAll();
    }, [team]);
//preload images for weapons
  const preloadImages = (urls) =>
    Promise.all(
      urls.map(url => new Promise(resolve => {
        if (!url) return resolve();
        const img = new Image();
        img.onload = img.onerror = () => resolve();
        img.src = url;
      }))
  );

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
  console.log('CLICK WEAPON:', weapon);
  console.log('Weapon name:', weapon.name);
  let weaponSkin = dbSkins.find(s => s.weapon_defindex === weapon.cs2_id);
  if (weapon.category === 'Other') {
      if(weapon.name === 'tt_gloves') {
          // console.log('TT GLOVES: ', gloves_T);
      }
      if(weapon.name === 'ct_gloves') {
         // console.log('CT GLOVES: ', gloves_CT);
      }
      if(weapon.name === 'ct_agent') {
          weaponSkin = agent_CT;
          console.log('CT AGENT: ', agent_CT);
          setSelectedWeapon({
            ...weapon,
            model: weaponSkin.model,
            team: weaponSkin.team,
            paint_name: weaponSkin.agent_name
          });
          return;
      }
      if(weapon.name === 'tt_agent') {
          weaponSkin = agent_T;
          console.log('TT AGENT: ', agent_T);
          setSelectedWeapon({
            ...weapon,
            model: weaponSkin.model,
            team: weaponSkin.team,
            agent_name: weaponSkin.agent_name
          });
          return;
      }
  }
  console.log('Selected weapon skin:', weaponSkin);
  if (!weaponSkin) {
    setSelectedWeapon(weapon);
    return;
  }

  // sticker format id;x;y;wear;scale;rotation
  const parseStickerId = (val) => {
    if (!val || val === '0;0;0;0;0;0;0') return null;
    const parts = val.split(';');
    const id = parseInt(parts[0]);
    return isNaN(id) || id === 0 ? null : id;
  };

  // kechain format id;offsetX;offsetY;scale
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

const handleSaveAgent = async (data) => {
  const params = new URLSearchParams();
  console.log('Saving agent data:', data);
  params.append('action', 'agent_save');
  params.append('team', team); // '2' lub '3'
  params.append('agent_model', data.model);
  params.append('agent_team', data.team);
  try{
    const res = await fetch(`${API_URL}/skins.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      credentials: 'include',
      body: params
    });

    const result = await res.json();
    console.log('Saved agent:', result);
  } catch (err) {
    console.error('Error saving agent:', err);
  }
}
const handleSaveGloves = async (data) => {
  const params = new URLSearchParams();
  console.log('Saving gloves data:', data);
  params.append('action', 'gloves_save');
  params.append('team', team); // 'CT' lub 'T'
  params.append('weapon_defindex', data.defindex);
  params.append('paint', data.paint);
  params.append('wear', data.wear);
  params.append('seed', data.seed);
  try{
    const res = await fetch(`${API_URL}/skins.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      credentials: 'include',
      body: params
    });

    const result = await res.json();
    console.log('Saved gloves:', result);
  } catch (err) {
    console.error('Error saving gloves:', err);
  }

};
const handleSaveWeapon = async (data) => {
  const params = new URLSearchParams();
 console.log('Saving weapon data:', data);
  params.append('action', 'save');
  params.append('team', team); // 'CT' lub 'T'
  params.append('weapon_defindex', data.weapon_defindex); 
  params.append('paint', data.paint);
  params.append('wear', data.wear);
  params.append('seed', data.seed);
  params.append('nametag', data.nametag ?? '');
  //check if data.statTrack is null
  if (data.statTrak === null || data.statTrak === undefined) {
    params.append('stattrak', '0');
    params.append('stattrak_count', data.statTrak ?? '0');
  } else {
    params.append('stattrak', '0');
    params.append('stattrak_count', data.statTrak ?? '0');
  }
  params.append('keychainId', data.keychainId ?? '0');
  params.append('offsetX', data.offsetX || 0);
  params.append('offsetY', data.offsetY || 0);
  for (let i = 0; i < 4; i++) {
    const id = data.stickers?.[i] ?? 0;
    //const stickerFull = `${id};0;0;0;1;0`; // id;schema;x;y;scale;rotation added on API side
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
    console.log('Saved skin:', result);
  } catch (err) {
    console.error('Error saving skin:', err);
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
          if(data.type === 'custom'){
            // console.log('Custom weapon data:', data);
            if(data.team === null) return; // if no team selected, do not save
            switch(data.other){
              case 'agent':
                //AGENT SAVE TO API we have data.model and data.team
                  await handleSaveAgent(data);
                break;
              case 'gloves':
                //GLOVES SAVE TO API we have data.defindex, data.paint, data.w
                //console.log('Saving gloves:', data);
                await handleSaveGloves(data);
                break;
              default:
                return;
            }
          }
    // Normal weapon save
    if(data.type !== 'custom'){
      await handleSaveWeapon(data); // call API save
    }
    // 1. Update dbSkins[] (to update the database)
    setDbSkins(prev => {
        const copy = [...prev];
        if (!data) return copy; //if no data, return copy
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

    setWeapons(prev => {
                return prev.map(w => {
                    const isNormalWeapon = w.cs2_id && w.cs2_id === data.weapon_defindex;
                    const isCustomWeapon = !w.cs2_id && w.name === data.name_main;

                    if ((isNormalWeapon || isCustomWeapon) && data.image) {
                      //if gloves update defindex and paint
                      if(w.type === 'gloves') {
                        return {
                          ...w,
                          defindex: data.defindex,
                          paint: data.paint,
                          wear: data.wear,
                          seed: data.seed,
                          image: data.image
                        };
                      }
                      return { ...w, image: data.image };
                    }
                    return w;
                  });
    });

    // 3. Close Customizer
    setSelectedWeapon(null);
    }}

      />
    )}
  </div>
);

}
