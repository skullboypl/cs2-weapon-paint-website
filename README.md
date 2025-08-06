# 🎮 CS2 Weapon Customizer (SKIN CHANGER WEBSITE FOR WEAPON PAINT PLUGIN)

A modern, React-powered web app for **customizing Counter-Strike 2 weapon skins**, stickers, nametags and keychains. Includes a full PHP backend with Steam login and MySQL storage.

> 🧪 Educational project — use at your own risk.

---

## 📢 What is this?

This is an **enhanced and extended version** of [cs2-WeaponPaints by Nereziel](https://github.com/Nereziel/cs2-WeaponPaints), redesigned as a complete **full-stack platform**:

- Uses the original **weapon/sticker/keychain data** and images from Nereziel's repo.
- Fully supports the **[CounterStrikeSharp Weapon Paint Plugin](https://github.com/Nereziel/cs2-WeaponPaints/tree/main/server)** for CS2 servers.
- Backend-ready — stores skins per Steam ID, with team (T/CT) separation.
- Designed for server-side skin injection and syncing player preferences.
- Built to be fast, responsive and easy to customize.

---

## 🚀 Features

- 🧩 Select skins, wear, seed, nametag
- 🎨 Choose 4 stickers with real previews
- 🔑 Assign keychains and control offset
- 🧠 Automatically saves to your Steam-linked database profile
- 🛠️ Works with CS2 WeaponPaint plugin for server skin injection

---

## 📦 Structure
# 🎮 CS2 Weapon Customizer

A modern, React-powered web app for **customizing Counter-Strike 2 weapon skins**, stickers, nametags and keychains. Includes a full PHP backend with Steam login and MySQL storage.

> 🧪 Educational project — use at your own risk.

---

## 📢 What is this?

This is an **enhanced and extended version** of [cs2-WeaponPaints by Nereziel](https://github.com/Nereziel/cs2-WeaponPaints), redesigned as a complete **full-stack platform**:

- Uses the original **weapon/sticker/keychain data** and images from Nereziel's repo.
- Fully supports the **[CounterStrikeSharp Weapon Paint Plugin](https://github.com/Nereziel/cs2-WeaponPaints/tree/main/server)** for CS2 servers.
- Backend-ready — stores skins per Steam ID, with team (T/CT) separation.
- Designed for server-side skin injection and syncing player preferences.
- Built to be fast, responsive and easy to customize.

---

## 🚀 Features

- 🧩 Select skins, wear, seed, nametag
- 🎨 Choose 4 stickers with real previews
- 🔑 Assign keychains and control offset
- 🧠 Automatically saves to your Steam-linked database profile
- 🛠️ Works with CS2 WeaponPaint plugin for server skin injection

---

## 📦 Structure
- /frontend → React (Vite) interface
- /backend → PHP backend (Steam Auth + MySQL)
- /config.sample.php → Config template for API keys and DB



---

## 🖥️ Demo website 
[SKINS WEBSITE DEMO](https://skiny.blazepro.pl/)

## ⚙️ Setup Instructions

### 🔧 Backend + Frontend (Production-Ready)

1. **Download the latest release** from the [Releases](../../releases) tab.  
   It contains:
   - `/` — prebuilt React app (Vite) 
   - `/api/` — backend PHP API (`/backend` folder renamed to `/api/`)

2. **Configure the backend**
   - Rename `api/config.sample.php` → `config.php`
   - Fill in your:
     - **Steam Web API Key**
     - **Domain name**
     - **MySQL database credentials**

3. **Upload the project to your server**
   - Upload the full release folder to your web server

4. **Done!**  
   Visit your domain in the browser and enjoy 🎉

> ✅ No need to compile anything — the frontend is already built using `vite build`.

> ⚠️ Make sure your PHP hosting supports **PDO + MySQL** and HTTPS is enabled.

---

## 🔐 Steam Authentication
- Uses OpenID login via steamauth/

- Automatically stores user skins by their SteamID (wp_player_skins table)

- Logout via /steamauth/logout.php

## 📸 Skin Images & Data
All images, weapon definitions, sticker JSONs, and keychains are loaded from:
 - https://github.com/Nereziel/cs2-WeaponPaints (used under open license)
 - All rights belong to their respective owners (Valve, Nereziel, community).

## ⚠️ Legal & Safety
- This project is for educational and hobbyist purposes only.

- Use on your own servers only.

- This is not affiliated with Valve or Steam.

- Do not use to bypass in-game purchases or monetization.