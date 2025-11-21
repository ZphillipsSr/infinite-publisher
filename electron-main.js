// electron-main.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let serverProcess = null;

// ✅ Make sure only ONE instance runs
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    // If user tries to open another instance, just focus the existing window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function startServer() {
    if (isDev) {
      console.log('DEV MODE: not starting bundled server (use npm run dev:server).');
      return;
    }

    if (serverProcess) {
      console.log('Server is already running, skipping start.');
      return;
    }

    const serverEntry = path.join(__dirname, 'server', 'dist', 'index.js');
    console.log('Starting server from:', serverEntry);

    serverProcess = spawn(process.execPath, [serverEntry], {
      env: {
        ...process.env,
        NODE_ENV: 'production'
      },
      stdio: 'inherit'
    });

    serverProcess.on('close', (code) => {
      console.log('Server process exited with code:', code);
      serverProcess = null;
    });
  }

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    if (isDev) {
      console.log('DEV MODE: Loading http://localhost:5173');
      mainWindow.loadURL('http://localhost:5173');
      mainWindow.webContents.openDevTools();
    } else {
      const indexPath = path.join(__dirname, 'client', 'dist', 'index.html');
      console.log('PRODUCTION MODE: Loading:', indexPath);
      mainWindow.loadFile(indexPath);
      mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
      mainWindow = null;
    });
  }

app.whenReady().then(() => {
  // startServer();   // 🔴 Disabled auto-start for now
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
  app.on('before-quit', () => {
    if (serverProcess) {
      console.log('Killing server process...');
      serverProcess.kill();
      serverProcess = null;
    }
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
