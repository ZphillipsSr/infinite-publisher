const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // add safe APIs here later if you need them
});