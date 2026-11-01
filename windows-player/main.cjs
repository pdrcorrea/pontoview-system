'use strict';

const { app, BrowserWindow, dialog, powerSaveBlocker, shell, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const PLAYER_URL = 'https://tv.pontoview.com.br/';
const PLAYER_ORIGIN = new URL(PLAYER_URL).origin;
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
let currentOffline = false;
const recentCrashes = [];

app.setName('PontoView Player');
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
    log('player-load-failed', { message: error.message });
    showOffline();
    scheduleRetry();
  }
}

function handleCrash(reason, exitCode) {
  if (quitting) return;
  log('renderer-crash', { reason, exitCode });
  recentCrashes.push(Date.now());
  while (recentCrashes.length && Date.now() - recentCrashes[0] > CRASH_WINDOW_MS) {
    recentCrashes.shift();
  }
  clearTimers();
  const extraDelay = recentCrashes.length >= MAX_RECENT_CRASHES ? 60_000 : RESTART_DELAY_MS;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (window && !window.isDestroyed()) {
      window.destroy();
    }
    window = null;
    createWindow();
  }, extraDelay);
}

function isTrustedNavigation(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.origin === PLAYER_ORIGIN || parsed.protocol === 'about:';
  } catch {
    return false;
  }
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
      partition: 'persist:pontoview-player',
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  });
  window = player;
  player.setMenuBarVisibility(false);
  player.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  player.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url)) {
      event.preventDefault();
      log('blocked-navigation', { origin: (() => { try { return new URL(url).origin; } catch { return 'invalid'; } })() });
    }
  });
  player.webContents.on('render-process-gone', (_event, details) => {
    handleCrash(details.reason, details.exitCode);
  });
  player.webContents.on('did-fail-load', (_event, code, description, validatedURL, isMainFrame) => {
    if (!isMainFrame || code === -3 || currentOffline || !validatedURL.startsWith(PLAYER_ORIGIN)) return;
    log('load-error', { code, description });
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
    if (process.platform === 'win32' && app.isPackaged) {
      // Startup follows the logged-in Windows user; this does not require elevation.
      const current = app.getLoginItemSettings();
      if (!current.openAtLogin) {
        app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
      }
      log('login-startup', { enabled: app.getLoginItemSettings().openAtLogin });
    }
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
    session.fromPartition('persist:pontoview-player').setPermissionRequestHandler((_wc, permission, callback) => {
      // External pages never receive camera, microphone, geolocation or notification rights.
      callback(false);
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
  if (!quitting && !restartTimer) app.quit();
});
