// SEPSim desktop shell for Windows 7 and 8. Electron 22 is the last release that runs on
// them. The user interface is the same build the Tauri shell uses (Windows 10 and 11).
const { app, BrowserWindow, Menu, protocol, shell } = require("electron");
const path = require("path");

const ROOT = path.join(__dirname, "app");

// The app is served from app://sepsim/ rather than file://, so the editor's web worker and
// the page share an origin and the saved settings (localStorage) persist.
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function serveApp() {
  protocol.registerFileProtocol("app", (request, respond) => {
    const file = path.normalize(path.join(ROOT, decodeURIComponent(new URL(request.url).pathname)));
    respond(file.startsWith(ROOT + path.sep) ? { path: file } : { error: -6 });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 500,
    title: "SEPSim",
    icon: path.join(ROOT, "icon.png"),
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  });
  win.once("ready-to-show", () => win.show());
  // Everything is offline: links that leave the app open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://")) e.preventDefault();
  });
  win.loadURL("app://sepsim/index.html");
}

// The app draws its own menu bar.
Menu.setApplicationMenu(null);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    serveApp();
    createWindow();
  });
  app.on("window-all-closed", () => app.quit());
}
