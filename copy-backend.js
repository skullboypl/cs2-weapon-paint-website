const fse = require('fs-extra');
const path = require('path');

const backendSrc = path.resolve(__dirname, 'backend');
const backendDest = path.resolve(__dirname, 'dist/api');

// 🔸 Usuń poprzedni backend z dist/api
fse.removeSync(backendDest);

// 🔸 Kopiowanie z filtrem (pomijamy .vscode i OLD)
fse.copySync(backendSrc, backendDest, {
  overwrite: true,
  filter: (src) => {
    const lowerSrc = src.toLowerCase();
    return !lowerSrc.includes('.vscode') && !lowerSrc.includes('/old') && !lowerSrc.includes('\\old') && !lowerSrc.includes('config.php');
  }
});

console.log('✅ Backend skopiowany do dist/api (bez .vscode i OLD)');
