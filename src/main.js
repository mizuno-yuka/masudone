const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// データの保存先: C:\Users\<ユーザー>\AppData\Roaming\MasuDone\data.json
const dataFile = () => path.join(app.getPath('userData'), 'data.json');

// 旧名「ToDoBingo」のときの保存データがあれば、新しい場所へコピーして引き継ぐ。
// (コピーするだけで、元のファイルは消さない。新しい場所にすでにデータがあるときは何もしない)
function migrateOldData() {
  try {
    const target = dataFile();
    if (fs.existsSync(target)) return;
    const old = path.join(app.getPath('appData'), 'ToDoBingo', 'data.json');
    if (!fs.existsSync(old) || path.resolve(old).toLowerCase() === path.resolve(target).toLowerCase()) return;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(old, target);
  } catch (e) {
    console.error('旧データの引き継ぎに失敗:', e);
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 820,
    minWidth: 440,
    minHeight: 520,
    title: 'MasuDone!',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    backgroundColor: '#f6efdc',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.handle('data:load', () => {
  try {
    return JSON.parse(fs.readFileSync(dataFile(), 'utf8'));
  } catch {
    return null; // 初回起動、またはファイルが壊れている場合
  }
});

ipcMain.handle('data:save', (_e, data) => {
  // 一時ファイルに書いてから置き換える(書き込み中に落ちてもデータが壊れにくい)
  const file = dataFile();
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return true;
});

app.whenReady().then(() => {
  migrateOldData();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
