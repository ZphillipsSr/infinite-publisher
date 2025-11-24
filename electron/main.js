// electron/main.js
// Electron entry for Infinite Publisher.
// In dev: just loads Vite dev server (you run the API separately).
// In production: auto-starts the compiled Express server (server/dist/index.js)
// inside the Electron main process, then loads the built React app.

const { app, BrowserWindow } = require("electron");
const path = require("path");

let mainWindow;

// More reliable than NODE_ENV for Electron
const isDev = !app.isPackaged;

// ---------- Helper: start API server in production ----------
function startServerInProd() {
  if (isDev) return; // dev uses npm dev scripts

  try {
    const serverEntry = path.join(
      __dirname,
      "..",
      "server",
      "dist",
      "index.js"
    );
    console.log("[Electron] Starting API server from:", serverEntry);

    // Requiring the compiled server bootstraps Express (app.listen(...))
    require(serverEntry);
  } catch (err) {
    console.error("[Electron] Failed to start API server:", err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    },
    title: "Infinite Publisher"
  });

  if (isDev) {
    // In dev mode, load the Vite dev server
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load the built React app from client/dist
    const indexPath = path.join(
      __dirname,
      "..",
      "client",
      "dist",
      "index.html"
    );
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Start API server (only in packaged builds)
  startServerInProd();

  // Create main window
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});