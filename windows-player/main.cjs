'use strict';

const { app, BrowserWindow, dialog, powerSaveBlocker, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { PLAYER_ORIGIN, isTrustedNavigation, isAllowedResourceRequest, getSafeOrigin } = require('./security.cjs');

const PLAYER_URL = PLAYER_ORIGIN + '/';
const PARTITION = 'persist:pontoview-player';
const MAX_LOG_BYTES = 2 * 1024 * 1024;
const MAX_RECENT_CRASHES = 5;
const CRASH_WINDOW_MS = 10 * 60 * 1000;
const RESTART_DELAY_MS = 5000;
const NETWORK_RETRY_MS = 30_000;

let window = null;
let powerBlockerId = null;
let restartTimer = null;
let retryTimer = null;
let quitting = false;
let restarting = false;
let currentOffline = false;
const recentCrashes = [];

app.setName('PontoView Player');
if (process.platform === 'win32') app.setAppUserModelId('br.com.pontoview.player');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('disable-background-timer-throttling');

function log(event, details = {}) {
  try {
    const file = path.join(app.getPath('userData'), 'player.log');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_LOG_BYTES) {
      fs.renameSync(file, file + '.previous');
    }
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), event, ...details }) + '\n');
  } catch (error) {
    console.error('[PontoView] Falha ao registrar log:', error);
  }
}

function clearTimers() {
  clearTimeout(restartTimer);
  clearTimeout(retryTimer);
  restartTimer = null;
  retryTimer = null;
}

function showOffline() {
  if (!window || window.isDestroyed()) return;
  currentOffline = true;
  window.loadFile(path.join(__dirname, 'offline.html')).catch((error) => {
    log('offline-screen-failed', { message: error.message });
  });
}

function scheduleRetry() {
  clearTimeout(retryTimer);
  if (quitting) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (window && !window.isDestroyed()) void loadPlayer();
  }, NETWORK_RETRY_MS);
}

async function loadPlayer() {
  if (!window || window.isDestroyed() || quitting) return;
  try {
    await window.loadURL(PLAYER_URL);
    currentOffline = false;
    log('player-loaded');
  } catch (error) {
    log('player-load-failed', { code: String(error.code || 'LOAD_FAILED').slice(0, 48) });
    showOffline();
    scheduleRetry();
  }
}

function handleCrash(reason, exitCode) {
  if (quitting || restartTimer) return;
  log('renderer-crash', { reason, exitCode });
  recentCrashes.push(Date.now());
  while (recentCrashes.length && Date.now() - recentCrashes[0] > CRASH_WINDOW_MS) {
    recentCrashes.shift();
  }
  clearTimers();
  const extraDelay = recentCrashes.length >= MAX_RECENT_CRASHES ? 60_000 : RESTART_DELAY_MS;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    restarting = true;
    try {
      if (window && !window.isDestroyed()) window.destroy();
      window = null;
      createWindow();
    } finally {
      restarting = false;
    }
  }, extraDelay);
}

function restrictWebContents(contents) {
  // Do not allow remote HTML to open external links in the user's browser.
  contents.setWindowOpenHandler(({ url }) => {
    log('blocked-popup', { origin: getSafeOrigin(url) });
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url)) {
      event.preventDefault();
      log('blocked-navigation', { origin: getSafeOrigin(url) });
    }
  });
  contents.on('will-redirect', (event, url, _isInPlace, isMainFrame) => {
    if (isMainFrame && !isTrustedNavigation(url)) {
      event.preventDefault();
      log('blocked-redirect', { origin: getSafeOrigin(url) });
    }
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.on('devtools-opened', () => contents.closeDevTools());
}

function createWindow() {
  if (quitting) return;
  const player = new BrowserWindow({
    title: 'PontoView Player',
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 450,
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    backgroundColor: '#030b19',
    webPreferences: {
      partition: PARTITION,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      devTools: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  window = player;
  currentOffline = false;
  player.setMenuBarVisibility(false);
  restrictWebContents(player.webContents);
  player.webContents.on('render-process-gone', (_event, details) => {
    handleCrash(details.reason, details.exitCode);
  });
  player.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3 || currentOffline || !isTrustedNavigation(validatedURL)) return;
    log('load-error', { code });
  });
  player.on('closed', () => {
    if (window === player) window = null;
  });
  player.once('ready-to-show', () => {
    if (!player.isDestroyed()) player.show();
  });
  // Keep an escape hatch for on-site administrators without revealing browser UI.
  player.webContents.on('before-input-event', (event, input) => {
    if (!input.control || !input.shift || input.type !== 'keyDown') return;
    if (input.key.toLowerCase() === 'q') {
      event.preventDefault();
      app.quit();
    } else if (input.key.toLowerCase() === 'r') {
      event.preventDefault();
      void loadPlayer();
    }
  });
  void loadPlayer();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (window && !window.isDestroyed()) {
      window.show();
      window.focus();
    }
  });
  app.whenReady().then(() => {
    log('app-start', { version: app.getVersion(), platform: process.platform });
    // Respect users who disable autostart. Only configure it on first installed launch.
    if (process.platform === 'win32' && app.isPackaged) {
      const marker = path.join(app.getPath('userData'), 'startup-preference-initialized');
      if (!fs.existsSync(marker)) {
        try {
          app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
          fs.writeFileSync(marker, new Date().toISOString());
          log('login-startup', { enabled: app.getLoginItemSettings().openAtLogin });
        } catch (error) {
          log('login-startup-failed', { reason: String(error.message).slice(0, 100) });
        }
      }
    }
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    const playerSession = session.fromPartition(PARTITION);
    playerSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    playerSession.setPermissionCheckHandler(() => false);
    playerSession.on('will-download', (event) => { event.preventDefault(); log('blocked-download'); });
    const offlineUrl = pathToFileURL(path.join(__dirname, 'offline.html')).href;
    playerSession.webRequest.onBeforeRequest((details, callback) => {
      const allowed = details.url === offlineUrl || isAllowedResourceRequest(details.url);
      if (!allowed) log('blocked-insecure-request', { origin: getSafeOrigin(details.url) });
      callback({ cancel: !allowed });
    });
    createWindow();
  }).catch((error) => {
    dialog.showErrorBox('PontoView Player', error.message);
    app.quit();
  });
}

app.on('before-quit', () => {
  quitting = true;
  clearTimers();
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
  }
  log('app-exit');
});
app.on('window-all-closed', () => {
  if (!quitting && !restarting && !restartTimer) app.quit();
});
