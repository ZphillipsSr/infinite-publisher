const { app, BrowserWindow } = require("electron");
const path = require("path");

const isDev = process.env.NODE_ENV === "development";

let mainWindow;

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
    const indexPath = path.join(__dirname, "client", "dist", "index.html");
    console.log("Loading index.html from:", indexPath);
    mainWindow.loadFile(indexPath);

    // Optional: open devtools in prod while debugging
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
