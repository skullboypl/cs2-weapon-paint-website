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
## 🖥 Screenshots
<img width="1327" height="1076" alt="{93C08B69-A1E7-4756-B014-69D8D943CB60}" src="https://github.com/user-attachments/assets/4dfd099e-e8a8-441d-b468-f54f0a6dd391" />
<img width="1262" height="885" alt="{3B1D71E3-FAE8-473B-A93B-9DE7984DBDF7}" src="https://github.com/user-attachments/assets/d6023847-9835-4c1b-9fdc-fa565474e2db" />
<img width="1304" height="1024" alt="{D142B961-4FD2-4BB9-9A7F-819C1634E3DB}" src="https://github.com/user-attachments/assets/ccbf4117-7c19-4d7d-b88d-f989e6b81ce2" />
<img width="1959" height="1367" alt="{EB4E2F8F-BBE5-4DD8-9B5A-F8448C5B8C59}" src="https://github.com/user-attachments/assets/110e1946-3341-4ea6-a66e-166a40e7fcb5" />

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
