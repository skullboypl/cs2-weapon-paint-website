import { useState, useEffect } from 'react';
import './../styles/Weapons.css';
import WeaponCustomizer from './WeaponCustomiser';
import FullLoadoutModal from './FullLoadoutModal';
import { apiUrl } from '../lib/api';
import { postApi, invalidateApiCache } from '../lib/postApi'
import { askConfirm } from '../lib/dialogs';
import { useI18n } from '../i18n/I18nProvider';
import {
  fetchJsonCached,
  preloadImagesIdle,
} from '../lib/dataCache';
import {
  CATEGORY_ORDER,
  CATEGORY_THUMB,
  getWeaponLabel,
  getWeaponSubtitle,
  resolveWeaponDefindex,
  sortCategories,
} from '../lib/weaponDisplay';
import { parseStickerString, serializeSticker, STICKER_SLOT_COUNT } from '../lib/stickerFormat';

const CATEGORY_I18N = {
  Loadout: 'catLoadout',
  Rifle: 'catRifle',
  Sniper: 'catSniper',
  PM: 'catPM',
  Shotgun: 'catShotgun',
  'Machine Gun': 'catMachineGun',
  Pistol: 'catPistol',
  Knife: 'catKnife',
  Other: 'catOther',
};

function normalizeKnifeKey(name) {
  return String(name || '')
    .replace(/^weapon_/, '')
    .toLowerCase();
}

/** Always store/compare as weapon_* id (plugin format). */
function toWeaponKnifeId(name) {
  const raw = String(name || '').trim();
  if (!raw || raw === 'knife' || raw === 'weapon_knife') return 'weapon_knife';
  return raw.startsWith('weapon_') ? raw : `weapon_${raw}`;
}

function knifeMatches(equipped, weaponName) {
  // Exact only - loose endsWith matched e.g. default "knife" to "knife_gypsy_jackknife"
  return toWeaponKnifeId(equipped) === toWeaponKnifeId(weaponName);
}

function stickerSlotHasId(val) {
  if (val == null || val === '') return false;
  const id = Number.parseInt(String(val).split(';')[0], 10);
  return Number.isFinite(id) && id > 0;
}

function parseStickerSlotId(val) {
  if (!stickerSlotHasId(val)) return null;
  return Number.parseInt(String(val).split(';')[0], 10);
}

function parseKeychainId(val) {
  if (val == null || val === '' || val === '0;0;0;0;0') return null;
  const id = Number.parseInt(String(val).split(';')[0], 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function keychainHasId(val) {
  return parseKeychainId(val) != null;
}

/**
 * Visual extras for weapon cards: sticker/keychain images, ST, nametag text.
 * @param {object|null} dbSkin
 * @param {Map<number, {id:number,name?:string,image?:string}>} stickerById
 * @param {Map<number, {id:number,name?:string,image?:string}>} keychainById
 */
function getWeaponSkinExtras(dbSkin, stickerById, keychainById) {
  if (!dbSkin) {
    return {
      stickers: [],
      keychain: null,
      statTrak: null,
      nametag: null,
      wear: null,
      seed: null,
      hasAny: false,
    };
  }

  const stickers = [0, 1, 2, 3, 4]
    .map((i) => {
      const id = parseStickerSlotId(dbSkin[`weapon_sticker_${i}`]);
      if (id == null) return null;
      const cat = stickerById.get(Number(id));
      return {
        slot: i,
        id,
        name: cat?.name || `#${id}`,
        image: cat?.image || '',
      };
    })
    .filter(Boolean);

  const kcId = parseKeychainId(dbSkin.weapon_keychain);
  const kcCat = kcId != null ? keychainById.get(Number(kcId)) : null;
  const keychain =
    kcId != null
      ? {
          id: kcId,
          name: kcCat?.name || `#${kcId}`,
          image: kcCat?.image || '',
        }
      : null;

  const wearNum = Number(dbSkin.weapon_wear);
  const seedNum = Number(dbSkin.weapon_seed);
  // DB default is often ~0.000001 - only show meaningful wear
  const wear =
    Number.isFinite(wearNum) && wearNum >= 0.001
      ? wearNum >= 0.01
        ? wearNum.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
        : wearNum.toFixed(4)
      : null;
  const seed =
    Number.isFinite(seedNum) && seedNum > 0 ? String(Math.round(seedNum)) : null;

  const nametag = dbSkin.weapon_nametag
    ? String(dbSkin.weapon_nametag).trim()
    : null;
  const statTrak =
    Number(dbSkin.weapon_stattrak) === 1
      ? { kills: Number(dbSkin.weapon_stattrak_count) || 0 }
      : null;

  const hasAny = Boolean(
    stickers.length ||
      keychain ||
      statTrak ||
      nametag ||
      wear ||
      seed,
  );

  return { stickers, keychain, statTrak, nametag, wear, seed, hasAny };
}

/** "AK-47 | Redline" -> "Redline"; skip Default paints. */
function formatSkinPaintLabel(paintName) {
  if (!paintName) return null;
  const raw = String(paintName).trim();
  if (!raw) return null;
  const pipe = raw.indexOf('|');
  const label = (pipe >= 0 ? raw.slice(pipe + 1) : raw).trim();
  if (!label || /^default$/i.test(label)) return null;
  return label;
}

function resolveCardSkinName(weapon, dbSkin, paintNameByKey) {
  if (
    weapon?.type === 'gloves' ||
    weapon?.type === 'music' ||
    weapon?.type === 'pin' ||
    weapon?.type === 'agent'
  ) {
    return formatSkinPaintLabel(weapon.paintLabel) || weapon.paintLabel || null;
  }
  const paint = Number(dbSkin?.weapon_paint_id);
  if (!Number.isFinite(paint) || paint <= 0) return null;
  const def = Number(dbSkin.weapon_defindex);
  if (!Number.isFinite(def)) return null;
  return formatSkinPaintLabel(paintNameByKey.get(`${def}:${paint}`));
}

function skinIsCustomized(dbSkin) {
  if (!dbSkin) return false;
  if (Number(dbSkin.weapon_paint_id) > 0) return true;
  if (Number(dbSkin.weapon_stattrak) === 1) return true;
  if (Number(dbSkin.weapon_wear) > 0) return true;
  if (Number(dbSkin.weapon_seed) > 0) return true;
  if (dbSkin.weapon_nametag) return true;
  if (keychainHasId(dbSkin.weapon_keychain)) return true;
  return [0, 1, 2, 3, 4].some((i) =>
    stickerSlotHasId(dbSkin[`weapon_sticker_${i}`]),
  );
}

function weaponBelongsToTeamView(weapon, team) {
  if (weapon.name === 'ct_gloves' || weapon.name === 'ct_agent' || weapon.name === 'ct_music' || weapon.name === 'ct_pin') return team === 'CT';
  if (weapon.name === 'tt_gloves' || weapon.name === 'tt_agent' || weapon.name === 'tt_music' || weapon.name === 'tt_pin') return team === 'T';
  return true;
}
export default function Weapons({ team, category = 'Rifle', onCategoryChange }) {
  const { t } = useI18n();
  const [weapons, setWeapons] = useState([]);
  const selectedCategory = category || 'Rifle';
  const setSelectedCategory = (cat) => {
    if (typeof onCategoryChange === 'function') onCategoryChange(cat);
  };
  const [knifeEquipped, setKnifeEquipped] = useState('weapon_knife');
  const [selectedWeapon, setSelectedWeapon] = useState(null);
  const [dbSkins, setDbSkins] = useState([]);
  const [agent_T, setAgent_T] = useState(null);
  const [agent_CT, setAgent_CT] = useState(null);

  const [gloves_T, setGloves_T] = useState(null);
  const [gloves_CT, setGloves_CT] = useState(null);
  const [musicId, setMusicId] = useState(null);
  const [pinId, setPinId] = useState(null);
  const [dbError, setDbError] = useState(null);
  const [dbBubbleOpen, setDbBubbleOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stickerById, setStickerById] = useState(() => new Map());
  const [keychainById, setKeychainById] = useState(() => new Map());
  const [paintNameByKey, setPaintNameByKey] = useState(() => new Map());
  const [fullLoadoutOpen, setFullLoadoutOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadAll = async () => {
      setLoading(true);
      setDbError(null);
      setDbBubbleOpen(true);
      // Avoid showing previous team's knife while reloading
      setKnifeEquipped('weapon_knife');

      // Catalogs from cache (memory/session) - parallel
      const [
        weaponsData,
        skinMap,
        agentsData,
        glovesJson,
        stickersJson,
        keychainsJson,
        musicJson,
        pinsJson,
      ] = await Promise.all([
        fetchJsonCached('/weapons.json'),
        fetchJsonCached('/data/skins_en.json'),
        fetchJsonCached('/data/agents_en.json'),
        fetchJsonCached('/data/gloves_en.json'),
        fetchJsonCached('/data/stickers_en.json'),
        fetchJsonCached('/data/keychains_en.json'),
        fetchJsonCached('/data/music_en.json'),
        fetchJsonCached('/data/collectibles_en.json'),
      ]);
      if (cancelled) return;

      const sMap = new Map();
      for (const s of stickersJson || []) {
        const id = Number(s.id);
        if (Number.isFinite(id)) sMap.set(id, s);
      }
      const kMap = new Map();
      for (const k of keychainsJson || []) {
        const id = Number(k.id);
        if (Number.isFinite(id)) kMap.set(id, k);
      }
      setStickerById(sMap);
      setKeychainById(kMap);

      const pMap = new Map();
      for (const s of skinMap || []) {
        pMap.set(
          `${Number(s.weapon_defindex)}:${Number(s.paint)}`,
          s.paint_name,
        );
      }
      setPaintNameByKey(pMap);

      const filtered = weaponsData.filter((w) => w.team === 'Both' || w.team === team);

      // Show base list ASAP (before DB / image preload)
      setWeapons(filtered);
      setLoading(false);

      let skinsRows = [];
      let agentsJson = { agent_t: null, agent_ct: null };
      let glovesData = { gloves_models: [], gloves_skins: [] };
      let bootMusicId = null;
      let bootPinId = null;

      try {
        // Single remote MySQL round-trip (was 4 parallel PHP+PDO connects)
        const boot = await postApi(
          'skins.php',
          { action: 'bootstrap', team },
          { ttlMs: 4000 },
        );
        if (cancelled) return;

        if (boot?.errorDB) {
          throw new Error(boot.errorDB);
        }

        if (boot.knife) {
          setKnifeEquipped(toWeaponKnifeId(boot.knife));
        } else {
          setKnifeEquipped('weapon_knife');
        }

        skinsRows = Array.isArray(boot.skins) ? boot.skins : [];
        agentsJson = boot.agents || { agent_t: null, agent_ct: null };
        glovesData = boot.gloves || { gloves_models: [], gloves_skins: [] };
        if (!Array.isArray(glovesData.gloves_models)) glovesData.gloves_models = [];
        if (!Array.isArray(glovesData.gloves_skins)) glovesData.gloves_skins = [];
        bootMusicId = boot.music_id != null ? Number(boot.music_id) : null;
        bootPinId = boot.pin_id != null ? Number(boot.pin_id) : null;
        setMusicId(bootMusicId);
        setPinId(bootPinId);
      } catch (err) {
        console.error('Error loading data:', err);
        if (!cancelled) setDbError(err.message || String(err));
        skinsRows = [];
        agentsJson = { agent_t: null, agent_ct: null };
        glovesData = { gloves_models: [], gloves_skins: [] };
        bootMusicId = null;
        bootPinId = null;
        setMusicId(null);
        setPinId(null);
      }

      if (cancelled) return;

      let agentT = agentsData.find((a) => a.model === agentsJson.agent_t);
      if (!agentT) agentT = { model: 'null', name: 'Agent | Default' };
      let agentCT = agentsData.find((a) => a.model === agentsJson.agent_ct);
      if (!agentCT) agentCT = { model: 'null', name: 'Agent | Default' };
      setAgent_T(agentT);
      setAgent_CT(agentCT);

      const mergedGloves = (glovesData.gloves_models || []).map((model) => {
        const skin = glovesData.gloves_skins?.find(
          (s) => Number(s.weapon_team) === Number(model.weapon_team),
        );
        return {
          team: model.weapon_team,
          defindex: model.weapon_defindex,
          paint_id: skin?.weapon_paint_id ?? 0,
          wear: skin?.weapon_wear ?? 0,
          seed: skin?.weapon_seed ?? 0,
        };
      });

      const buildGloves = (teamId) => {
        const base = mergedGloves.find((g) => Number(g.team) === Number(teamId));
        if (!base) return null;
        const skin = glovesJson.find(
          (g) =>
            Number(g.weapon_defindex) === Number(base.defindex) &&
            Number(g.paint) === Number(base.paint_id ?? 0),
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

      const glovesT = buildGloves(2);
      const glovesCT = buildGloves(3);
      setGloves_T(glovesT);
      setGloves_CT(glovesCT);
      setDbSkins(skinsRows);

      const finalWeapons = filtered.map((w) => {
        const def = resolveWeaponDefindex(w);
        const dbSkin =
          def != null
            ? skinsRows.find((s) => Number(s.weapon_defindex) === def)
            : null;
        if (dbSkin) {
          const matchedSkin = skinMap.find(
            (s) =>
              Number(s.weapon_defindex) === Number(dbSkin.weapon_defindex) &&
              Number(s.paint) === Number(dbSkin.weapon_paint_id),
          );
          if (matchedSkin?.image) return { ...w, image: matchedSkin.image };
        }
        return w;
      });

      const updatedWeapons = finalWeapons.map((w) => {
        if (w.name === 'ct_agent') {
          return {
            ...w,
            type: 'agent',
            image: agentCT?.image || '/agents/ct_sas.png',
            model: agentCT?.model || 'null',
            team: 3,
            paintLabel: agentCT?.agent_name || agentCT?.name || null,
          };
        }
        if (w.name === 'tt_agent') {
          return {
            ...w,
            type: 'agent',
            image: agentT?.image || '/agents/tt_phoenix.png',
            model: agentT?.model || 'null',
            team: 2,
            paintLabel: agentT?.agent_name || agentT?.name || null,
          };
        }
        if (w.name === 'tt_gloves') {
          return {
            ...w,
            image: glovesT?.image || '/others/tt_gloves.png',
            type: 'gloves',
            team: 2,
            defindex: glovesT?.defindex || 0,
            paint: glovesT?.paint || 0,
            wear: glovesT?.wear || 0,
            seed: glovesT?.seed || 0,
            paintLabel: glovesT?.name || null,
          };
        }
        if (w.name === 'ct_gloves') {
          return {
            ...w,
            image: glovesCT?.image || '/others/ct_gloves.png',
            type: 'gloves',
            team: 3,
            defindex: glovesCT?.defindex || 0,
            paint: glovesCT?.paint || 0,
            wear: glovesCT?.wear || 0,
            seed: glovesCT?.seed || 0,
            paintLabel: glovesCT?.name || null,
          };
        }
        if (w.name === 'ct_music' || w.name === 'tt_music') {
          const row =
            bootMusicId != null
              ? (musicJson || []).find((m) => Number(m.id) === Number(bootMusicId))
              : null;
          return {
            ...w,
            type: 'music',
            team: w.name === 'ct_music' ? 3 : 2,
            musicId: bootMusicId,
            image: row?.image || w.image,
            paintLabel: row?.name || null,
          };
        }
        if (w.name === 'ct_pin' || w.name === 'tt_pin') {
          const row =
            bootPinId != null
              ? (pinsJson || []).find((p) => Number(p.id) === Number(bootPinId))
              : null;
          return {
            ...w,
            type: 'pin',
            team: w.name === 'ct_pin' ? 3 : 2,
            pinId: bootPinId,
            image: row?.image || w.image,
            paintLabel: row?.name || null,
          };
        }
        return w;
      });

      setWeapons(updatedWeapons);

      // Progressive preload - don't block UI
      const visible = updatedWeapons
        .filter((w) => w.category === 'Rifle')
        .map((w) => w.image)
        .filter(Boolean);
      const rest = updatedWeapons.map((w) => w.image).filter(Boolean);
      preloadImagesIdle(visible, { limit: 24, concurrency: 6 });
      preloadImagesIdle(rest, { limit: 80, concurrency: 4 });
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [team, reloadTick]);

  const refreshWeapons = () => setReloadTick((n) => n + 1);
  const loadoutWeapons = weapons
    .filter((w) => {
      if (w.name === 'knife') return false;
      if (!weaponBelongsToTeamView(w, team)) return false;
      // Loadout: only the ACTIVE knife for this team (not every painted knife)
      if (w.category === 'Knife') {
        return knifeMatches(knifeEquipped, w.name);
      }
      if (w.type === 'music' && Number(w.musicId) > 0) return true;
      if (w.type === 'pin' && Number(w.pinId) > 0) return true;
      if (w.type === 'agent' && w.model && w.model !== 'null') return true;
      const def = resolveWeaponDefindex(w);
      const dbSkin =
        def != null ? dbSkins.find((s) => Number(s.weapon_defindex) === def) : null;
      if (skinIsCustomized(dbSkin)) return true;
      if (w.type === 'gloves' && Number(w.paint) > 0) return true;
      return false;
    })
    .sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.category);
      const ib = CATEGORY_ORDER.indexOf(b.category);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

  const weaponCategories = sortCategories([
    ...new Set(weapons.map((w) => w.category)),
  ]);

  const filteredByCategory =
    selectedCategory === 'Loadout'
      ? loadoutWeapons
      : weapons.filter((w) => w.category === selectedCategory);

  // Equal card heights only for the visible category, and only when at least
  // one card actually shows extras (stickers / ST / nametag / wear / seed).
  const needsEqualHeights = filteredByCategory.some((weapon) => {
    if (weapon.name === 'knife') return false;
    const def = resolveWeaponDefindex(weapon);
    if (def == null) return false;
    const dbSkin = dbSkins.find((s) => Number(s.weapon_defindex) === def);
    return getWeaponSkinExtras(dbSkin, stickerById, keychainById).hasAny;
  });

  const categoryCounts = weaponCategories.reduce((acc, cat) => {
    acc[cat] = weapons.filter((w) => w.category === cat && w.name !== 'knife').length;
    return acc;
  }, {});

  const categoryLabel = (cat) => t[CATEGORY_I18N[cat]] || cat;

  // Stable collage of up to 4 skin images from current loadout
  const loadoutCollage = (() => {
    const unique = [];
    const seen = new Set();
    for (const w of loadoutWeapons) {
      if (!w.image || seen.has(w.image)) continue;
      seen.add(w.image);
      unique.push(w.image);
    }
    if (unique.length <= 4) return unique;
    let seed = loadoutWeapons.length * 2654435761;
    for (let i = 0; i < team.length; i++) seed = (seed + team.charCodeAt(i) * (i + 1)) >>> 0;
    const arr = [...unique];
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
      const j = seed % (i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr.slice(0, 4);
  })();

  const equippedForCurrentTeam = (knifeWeapon) =>
    knifeMatches(knifeEquipped, knifeWeapon.name);

  const knifeKey = normalizeKnifeKey(knifeEquipped);
  const hasSpecialKnife = Boolean(knifeKey) && knifeKey !== 'knife';
  const equippedKnifeCard = hasSpecialKnife
    ? weapons.find(
        (w) =>
          w.category === 'Knife' &&
          w.name !== 'knife' &&
          knifeMatches(knifeEquipped, w.name),
      )
    : null;
  const teamLabel = team === 'CT' ? t.teamCtShort : t.teamTShort;

  const setKnifeForCurrentTeam = async (knifeWeapon, enabled) => {
    const knifeName = enabled
      ? toWeaponKnifeId(knifeWeapon?.name || knifeWeapon)
      : 'weapon_knife';
    setKnifeEquipped(knifeName);
    try {
      const res = await postApi('knife.php', {
        action: 'set',
        team,
        knife: knifeName,
      });
      if (res?.error || res?.errorDB) {
        throw new Error(res.error || res.errorDB);
      }
      // Confirm what DB stored (plugin format)
      if (res?.knife) {
        setKnifeEquipped(toWeaponKnifeId(res.knife));
      }
      invalidateApiCache('skins.php');
      return true;
    } catch (err) {
      console.error('Error saving knife:', err);
      return false;
    }
  };

const handleWeaponClick = (weapon) => {
  const weaponDef = resolveWeaponDefindex(weapon);
  let weaponSkin =
    weaponDef != null
      ? dbSkins.find((s) => Number(s.weapon_defindex) === weaponDef)
      : null;
  if (weapon.category === 'Other') {
      if(weapon.name === 'ct_agent') {
          weaponSkin = agent_CT;
          setSelectedWeapon({
            ...weapon,
            model: weaponSkin?.model,
            team: weaponSkin?.team,
            paint_name: weaponSkin?.agent_name
          });
          return;
      }
      if(weapon.name === 'tt_agent') {
          weaponSkin = agent_T;
          setSelectedWeapon({
            ...weapon,
            model: weaponSkin?.model,
            team: weaponSkin?.team,
            agent_name: weaponSkin?.agent_name
          });
          return;
      }
      if (weapon.name.includes('music')) {
        setSelectedWeapon({
          ...weapon,
          musicId: weapon.musicId ?? musicId,
        });
        return;
      }
      if (weapon.name.includes('pin')) {
        setSelectedWeapon({
          ...weapon,
          pinId: weapon.pinId ?? pinId,
        });
        return;
      }
  }
  // No DB row yet = first paint for this weapon/team (normal for knives)
  if (!weaponSkin) {
    setSelectedWeapon(weapon);
    return;
  }

  // keychain format id;x;y;z;seed (plugin)
  const parseKeychain = (val) => {
    if (!val || val === '0;0;0;0;0') {
      return { id: '', offsetX: 0, offsetY: 0, offsetZ: 0, seed: 0 };
    }
    const parts = String(val).split(';');
    return {
      id: parts[0] && parts[0] !== '0' ? parts[0] : '',
      offsetX: Number(parts[1]) || 0,
      offsetY: Number(parts[2]) || 0,
      offsetZ: Number(parts[3]) || 0,
      seed: Number(parts[4]) || 0,
    };
  };

  const keychainData = parseKeychain(weaponSkin.weapon_keychain);

  setSelectedWeapon({
    ...weapon,
    savedPaint: weaponSkin.weapon_paint_id,
    savedWear: weaponSkin.weapon_wear,
    savedSeed: weaponSkin.weapon_seed,
    savedNametag: weaponSkin.weapon_nametag,
    savedStatTrakEnabled: Number(weaponSkin.weapon_stattrak) === 1,
    savedStatTrakKills: Number(weaponSkin.weapon_stattrak_count) || 0,

    savedKeychainId: keychainData.id,
    savedKeychainOffsetX: keychainData.offsetX,
    savedKeychainOffsetY: keychainData.offsetY,
    savedKeychainOffsetZ: keychainData.offsetZ,
    savedKeychainSeed: keychainData.seed,

    savedStickers: [
      parseStickerString(weaponSkin.weapon_sticker_0),
      parseStickerString(weaponSkin.weapon_sticker_1),
      parseStickerString(weaponSkin.weapon_sticker_2),
      parseStickerString(weaponSkin.weapon_sticker_3),
      parseStickerString(weaponSkin.weapon_sticker_4),
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
    const res = await fetch(`${apiUrl('skins.php')}`, {
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
  params.append('action', 'gloves_save');
  params.append('team', team); // 'CT' lub 'T'
  params.append('weapon_defindex', data.defindex);
  params.append('paint', data.paint);
  params.append('wear', data.wear);
  params.append('seed', data.seed);
  try{
    const res = await fetch(`${apiUrl('skins.php')}`, {
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

const handleSaveMusic = async (data) => {
  try {
    const mid = Number(data.music_id) || 0;
    await postApi('skins.php', {
      action: 'music_save',
      team,
      music_id: mid,
      both_teams: data.both_teams ? '1' : '0',
    });
    setMusicId(mid > 0 ? mid : null);
    invalidateApiCache();
  } catch (err) {
    console.error('Error saving music:', err);
  }
};

const handleSavePin = async (data) => {
  try {
    const pid = Number(data.pin_id) || 0;
    await postApi('skins.php', {
      action: 'pin_save',
      team,
      pin_id: pid,
      both_teams: data.both_teams ? '1' : '0',
    });
    setPinId(pid > 0 ? pid : null);
    invalidateApiCache();
  } catch (err) {
    console.error('Error saving pin:', err);
  }
};

const handleSaveWeapon = async (data) => {
  const params = new URLSearchParams();
  const defindex = Number(data.weapon_defindex);
  if (!Number.isFinite(defindex) || defindex <= 0) {
    throw new Error('Invalid weapon_defindex');
  }
  params.append('action', 'save');
  params.append('team', team); // 'CT' lub 'T'
  params.append('weapon_defindex', String(defindex));
  params.append('paint', data.paint);
  params.append('wear', data.wear);
  params.append('seed', data.seed);
  params.append('nametag', data.nametag ?? '');
  const stOn = data.statTrak !== null && data.statTrak !== undefined;
  params.append('stattrak', stOn ? '1' : '0');
  params.append('stattrak_count', stOn ? String(data.statTrak) : '0');
  params.append('keychainId', data.keychainId ?? '0');
  params.append('offsetX', data.offsetX || 0);
  params.append('offsetY', data.offsetY || 0);
  params.append('offsetZ', data.offsetZ || 0);
  params.append('keychainSeed', data.keychainSeed || 0);
  for (let i = 0; i < STICKER_SLOT_COUNT; i++) {
    const slot = data.stickers?.[i];
    params.append(
      `weapon_sticker_${i}`,
      typeof slot === 'string' ? slot : serializeSticker(slot),
    );
  }

  const res = await fetch(`${apiUrl('skins.php')}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    credentials: 'include',
    body: params
  });

  const result = await res.json().catch(() => ({}));
  if (!res.ok || result.error || result.errorDB) {
    throw new Error(result.error || result.errorDB || `Save failed (${res.status})`);
  }
  invalidateApiCache('skins.php');
  return result;
};

  const restoreBaseWeaponImages = async (defindexes = null) => {
    const weaponsData = await fetchJsonCached('/weapons.json');
    const allow = defindexes
      ? new Set(defindexes.map((d) => Number(d)).filter((n) => Number.isFinite(n)))
      : null;
    setWeapons((prev) =>
      prev.map((w) => {
        const def = resolveWeaponDefindex(w);
        if (allow && (def == null || !allow.has(def))) return w;
        const base = weaponsData.find((b) => b.name === w.name);
        return base ? { ...w, image: base.image } : w;
      }),
    );
  };

  const handleResetWeapon = async (data) => {
    const defindex = Number(data.weapon_defindex);
    setSelectedWeapon(null);
    try {
      await postApi('skins.php', {
        action: 'reset',
        team,
        weapon_defindex: String(defindex),
      });
      invalidateApiCache('skins.php');
      setDbSkins((prev) =>
        prev.filter((s) => Number(s.weapon_defindex) !== defindex),
      );
      await restoreBaseWeaponImages([defindex]);
    } catch (err) {
      console.error('Error resetting skin:', err);
    }
  };

  const handleResetTeamSkins = async () => {
    const teamLabel = team === 'CT' ? t.teamCtShort : t.teamTShort;
    const ok = await askConfirm({
      title: t.resetTeamSkins,
      message: t.resetTeamSkinsConfirm.replace('{team}', teamLabel),
      confirmLabel: t.resetTeamSkins,
      cancelLabel: t.cancel,
      danger: true,
    });
    if (!ok) return;
    try {
      await postApi('skins.php', { action: 'reset_team', team });
      invalidateApiCache('skins.php');
      setDbSkins([]);
      setKnifeEquipped('weapon_knife');
      setMusicId(null);
      setPinId(null);
      await restoreBaseWeaponImages(null);
      refreshWeapons();
    } catch (err) {
      console.error('Error resetting team skins:', err);
    }
  };


  return (
  <div className="weapons-section">
    {dbError && dbBubbleOpen && (
      <div className="db-bubble" role="alert">
        <div className="db-bubble__icon" aria-hidden="true">!</div>
        <div className="db-bubble__body">
          <strong className="db-bubble__title">{t.dbBubbleTitle}</strong>
          <p className="db-bubble__text">{t.dbBubbleBody}</p>
          <p className="db-bubble__detail">{dbError}</p>
        </div>
        <button
          type="button"
          className="db-bubble__close"
          onClick={() => setDbBubbleOpen(false)}
          aria-label={t.dbBubbleDismiss}
        >
          ×
        </button>
      </div>
    )}
    {loading && weapons.length === 0 && (
      <p className="weapons-loading">{t.weaponsLoading}</p>
    )}
    {!selectedWeapon ? (
      <>
        <header className="weapons-toolbar">
          <div className="weapons-toolbar__copy">
            <p className="weapons-toolbar__eyebrow">{t.weaponsPickCategory}</p>
            <h2 className="weapons-toolbar__title">{categoryLabel(selectedCategory)}</h2>
            {selectedCategory === 'Other' && (
              <p className="weapons-toolbar__hint">{t.otherCategoryHint}</p>
            )}
          </div>
          <div className="weapons-toolbar__actions">
            {selectedCategory === 'Loadout' && (
              <button
                type="button"
                className="weapons-reset-team"
                onClick={handleResetTeamSkins}
                title={t.resetTeamSkinsHint}
              >
                {t.resetTeamSkins}
              </button>
            )}
          </div>
        </header>

        <div className="loadout-category-slot">
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'Loadout'}
            className={
              selectedCategory === 'Loadout'
                ? 'category-button category-button--loadout is-active'
                : 'category-button category-button--loadout'
            }
            onClick={() => setSelectedCategory('Loadout')}
          >
            <span
              className={
                loadoutCollage.length >= 3
                  ? 'category-button__collage category-button__collage--grid'
                  : 'category-button__collage category-button__collage--row'
              }
              aria-hidden
            >
              {loadoutCollage.map((src) => (
                <img key={src} src={src} alt="" draggable={false} loading="lazy" />
              ))}
            </span>
            <span className="category-button__text">
              <strong title={categoryLabel('Loadout')}>{categoryLabel('Loadout')}</strong>
              <em>{loadoutWeapons.length}</em>
            </span>
          </button>
          <p className="loadout-category-slot__hint">{t.loadoutCategoryHint}</p>
        </div>

        <div className="weapon-categories" role="tablist" aria-label={t.weaponsPickCategory}>
          {weaponCategories.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={cat === selectedCategory}
              className={
                cat === selectedCategory
                  ? `category-button category-button--${cat.toLowerCase().replace(/\s+/g, '-')} is-active`
                  : `category-button category-button--${cat.toLowerCase().replace(/\s+/g, '-')}`
              }
              onClick={() => setSelectedCategory(cat)}
            >
              <span className="category-button__thumb" aria-hidden>
                <img
                  src={CATEGORY_THUMB[cat] || '/weapons/weapon_ak47.png'}
                  alt=""
                  draggable={false}
                />
              </span>
              <span className="category-button__text">
                <strong title={categoryLabel(cat)}>{categoryLabel(cat)}</strong>
                <em>{categoryCounts[cat] || 0}</em>
              </span>
            </button>
          ))}
        </div>

       
      {selectedCategory === 'Knife' && (
        <div
          className={
            team === 'CT'
              ? 'knife-status knife-status--ct'
              : 'knife-status knife-status--t'
          }
          role="status"
        >
          {equippedKnifeCard ? (
            <>
              <span className="knife-status__eyebrow">
                {t.knifeSelectedEyebrow.replace('{team}', teamLabel)}
              </span>
              <strong className="knife-status__name">
                {getWeaponLabel(equippedKnifeCard.name)}
              </strong>
              <span className="knife-status__hint">{t.knifeEquipHint}</span>
            </>
          ) : (
            <>
              <span className="knife-status__eyebrow">
                {t.knifeSelectEyebrow.replace('{team}', teamLabel)}
              </span>
              <strong className="knife-status__name knife-status__name--empty">
                {t.knifeSelectEmpty}
              </strong>
              <span className="knife-status__hint">{t.knifeEquipHint}</span>
            </>
          )}
        </div>
      )}

      {selectedCategory === 'Loadout' && (
        <div
          className={
            team === 'CT'
              ? 'loadout-status loadout-status--ct'
              : 'loadout-status loadout-status--t'
          }
          role="status"
        >
          <span className="loadout-status__eyebrow">
            {t.loadoutActiveEyebrow.replace('{team}', teamLabel)}
          </span>
          <strong className="loadout-status__title">{t.catLoadout}</strong>
          <span className="loadout-status__hint">
            {loadoutWeapons.length > 0 ? t.loadoutActiveHint : t.loadoutActiveEmpty}
          </span>
        </div>
      )}

        <p className="weapons-grid-label">
          {selectedCategory === 'Loadout' ? t.weaponsPickLoadout : t.weaponsPickWeapon}
        </p>
        <div
          className={
            needsEqualHeights ? 'weapons-grid weapons-grid--equalize' : 'weapons-grid'
          }
        >
          {filteredByCategory.map((weapon, index) => {
            if (weapon.name === 'knife') return null;
            const weaponId = resolveWeaponDefindex(weapon) ?? `fake-${index}`;
            const isKnifeCard = weapon.category === 'Knife';
            const onCurrent = isKnifeCard && equippedForCurrentTeam(weapon);
            const dbSkin = dbSkins.find(
              (s) =>
                Number(s.weapon_defindex) ===
                Number(resolveWeaponDefindex(weapon)),
            );
            const extras = getWeaponSkinExtras(dbSkin, stickerById, keychainById);
            const skinName = resolveCardSkinName(weapon, dbSkin, paintNameByKey);

            return (
              <div
                key={weaponId}
                className={
                  isKnifeCard && onCurrent
                    ? 'weapon-card-shell is-knife-equipped'
                    : 'weapon-card-shell'
                }
              >
                <button
                  type="button"
                  className="weapon-card"
                  onClick={() => handleWeaponClick(weapon)}
                >
                  <span className="weapon-card__glow" aria-hidden />
                  <img src={weapon.image} alt={getWeaponLabel(weapon.name)} className="weapon-img" draggable={false} />
                  <span
                    className={
                      extras.hasAny
                        ? 'weapon-card__extras'
                        : 'weapon-card__extras weapon-card__extras--empty'
                    }
                    aria-hidden
                  >
                      {extras.statTrak && (
                        <span className="weapon-card__chip weapon-card__chip--st" title="StatTrak">
                          ST
                          {extras.statTrak.kills > 0 ? (
                            <em>{extras.statTrak.kills}</em>
                          ) : null}
                        </span>
                      )}
                      {extras.nametag && (
                        <span
                          className="weapon-card__chip weapon-card__chip--name"
                          title={extras.nametag}
                        >
                          "{extras.nametag}"
                        </span>
                      )}
                      {extras.stickers.length > 0 && (
                        <span className="weapon-card__sticker-row">
                          {extras.stickers.map((st) =>
                            st.image ? (
                              <img
                                key={`st-${st.slot}-${st.id}`}
                                className="weapon-card__addon-img"
                                src={st.image}
                                alt=""
                                title={st.name}
                                loading="lazy"
                                draggable={false}
                              />
                            ) : (
                              <span
                                key={`st-${st.slot}-${st.id}`}
                                className="weapon-card__addon-fallback"
                                title={st.name}
                              >
                                S
                              </span>
                            ),
                          )}
                        </span>
                      )}
                      {extras.keychain && (
                        extras.keychain.image ? (
                          <img
                            className="weapon-card__addon-img weapon-card__addon-img--kc"
                            src={extras.keychain.image}
                            alt=""
                            title={extras.keychain.name}
                            loading="lazy"
                            draggable={false}
                          />
                        ) : (
                          <span
                            className="weapon-card__addon-fallback"
                            title={extras.keychain.name}
                          >
                            KC
                          </span>
                        )
                      )}
                      {(extras.wear || extras.seed) && (
                        <span className="weapon-card__meta-chips">
                          {extras.wear && (
                            <span className="weapon-card__chip weapon-card__chip--dim">
                              W {extras.wear}
                            </span>
                          )}
                          {extras.seed && (
                            <span className="weapon-card__chip weapon-card__chip--dim">
                              Seed {extras.seed}
                            </span>
                          )}
                        </span>
                      )}
                  </span>
                  <span className="weapon-card__meta">
                    <strong className="weapon-name">
                      <span className="weapon-name__text">{getWeaponLabel(weapon.name)}</span>
                      {(weapon.name.includes('music') || weapon.name.includes('pin')) && (
                        <span className="wp-beta-badge wp-beta-badge--inline" title={t.betaFeatureHint}>
                          {t.betaBadge}
                        </span>
                      )}
                    </strong>
                    {skinName ? (
                      <em className="weapon-skin">{skinName}</em>
                    ) : (
                      <em className="weapon-sub">{getWeaponSubtitle(weapon.name)}</em>
                    )}
                  </span>
                </button>
                {isKnifeCard && (
                  <div
                    className="knife-equip"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-checked={onCurrent}
                      className={
                        onCurrent
                          ? team === 'CT'
                            ? 'knife-equip__btn knife-equip__btn--ct is-on'
                            : 'knife-equip__btn knife-equip__btn--t is-on'
                          : team === 'CT'
                            ? 'knife-equip__btn knife-equip__btn--ct'
                            : 'knife-equip__btn knife-equip__btn--t'
                      }
                      onClick={() => setKnifeForCurrentTeam(weapon, !onCurrent)}
                    >
                      <span className="knife-equip__track" aria-hidden>
                        <span className="knife-equip__thumb" />
                      </span>
                      <span className="knife-equip__copy">
                        {onCurrent
                          ? t.knifeEquippedForTeam.replace('{team}', teamLabel)
                          : t.knifeUseForTeam.replace('{team}', teamLabel)}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedCategory === 'Loadout' && (
          <div className="full-loadout-cta">
            <button
              type="button"
              className="full-loadout-cta__btn"
              onClick={() => setFullLoadoutOpen(true)}
            >
              {t.fullLoadoutOpen}
            </button>
            <p className="full-loadout-cta__hint">{t.fullLoadoutOpenHint}</p>
          </div>
        )}

        <FullLoadoutModal
          open={fullLoadoutOpen}
          onClose={() => setFullLoadoutOpen(false)}
          onChanged={refreshWeapons}
        />
      </>
    ) : (
      <WeaponCustomizer
        weapon={selectedWeapon}
        onClose={() => setSelectedWeapon(null)}
        onReset={handleResetWeapon}
        onSave={async (data) => {
          if (data.type === 'custom' && data.other === 'agent' && data.team == null) return;

          const knifeToEquip =
            selectedWeapon?.category === 'Knife' &&
            selectedWeapon?.name &&
            selectedWeapon.name !== 'knife'
              ? selectedWeapon
              : null;

          // Close first so Save always leaves the editor
          setSelectedWeapon(null);

          try {
            if (data.type === 'custom') {
              switch (data.other) {
                case 'agent':
                  await handleSaveAgent(data);
                  break;
                case 'gloves':
                  await handleSaveGloves(data);
                  break;
                case 'music':
                  await handleSaveMusic(data);
                  refreshWeapons();
                  break;
                case 'pin':
                  await handleSavePin(data);
                  refreshWeapons();
                  break;
                default:
                  break;
              }
            } else {
              // Equip knife first so active model is never lost if skin save is slow/fails
              if (knifeToEquip) {
                await setKnifeForCurrentTeam(knifeToEquip, true);
              }
              await handleSaveWeapon(data);
            }
          } catch (err) {
            console.error('Error saving:', err);
          }

          setDbSkins((prev) => {
            const copy = [...prev];
            if (!data || data.type === 'custom') return copy;
            const def = Number(data.weapon_defindex);
            const index = copy.findIndex((s) => Number(s.weapon_defindex) === def);

            const nextRow = {
              weapon_defindex: def,
              weapon_paint_id: data.paint,
              weapon_wear: data.wear,
              weapon_seed: data.seed,
              weapon_nametag: data.nametag,
              weapon_stattrak: data.statTrak ? 1 : 0,
              weapon_stattrak_count: data.statTrak || 0,
              weapon_keychain: `${data.keychainId || 0};${data.offsetX || 0};${data.offsetY || 0};${data.offsetZ || 0};${data.keychainSeed || 0}`,
              weapon_sticker_0: serializeSticker(data.stickers?.[0]),
              weapon_sticker_1: serializeSticker(data.stickers?.[1]),
              weapon_sticker_2: serializeSticker(data.stickers?.[2]),
              weapon_sticker_3: serializeSticker(data.stickers?.[3]),
              weapon_sticker_4: serializeSticker(data.stickers?.[4]),
            };

            if (index !== -1) {
              copy[index] = { ...copy[index], ...nextRow };
            } else {
              copy.push(nextRow);
            }
            return copy;
          });

          setWeapons((prev) =>
            prev.map((w) => {
              const isNormalWeapon =
                resolveWeaponDefindex(w) != null &&
                resolveWeaponDefindex(w) === Number(data.weapon_defindex);
              const isCustomWeapon = !w.cs2_id && w.name === data.name_main;

              if ((isNormalWeapon || isCustomWeapon) && data.image) {
                if (w.type === 'gloves') {
                  return {
                    ...w,
                    defindex: data.defindex,
                    paint: data.paint,
                    wear: data.wear,
                    seed: data.seed,
                    image: data.image,
                    paintLabel: data.paint_name || data.paintLabel || w.paintLabel || null,
                  };
                }
                return { ...w, image: data.image };
              }
              return w;
            }),
          );
        }}
      />
    )}
  </div>
);

}
