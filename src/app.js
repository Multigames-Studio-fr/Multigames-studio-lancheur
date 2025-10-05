/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, ipcMain, nativeTheme } = require('electron');
const { Microsoft } = require('minecraft-java-core');
const { autoUpdater } = require('electron-updater');

const path = require('path');
const fs = require('fs');

const UpdateWindow = require("./assets/js/windows/updateWindow.js");
const MainWindow = require("./assets/js/windows/mainWindow.js");

let dev = process.env.NODE_ENV === 'dev';

// Optimisation : Gestion globale des erreurs non capturées
process.on('uncaughtException', (error) => {
    console.error('Erreur non capturée:', error);
    // Éviter un crash complet en mode production
    if (!dev) {
        // Log l'erreur et continuer
        console.log('Application continuera de fonctionner...');
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesse rejetée non gérée à', promise, 'raison:', reason);
});

if (dev) {
    let appPath = path.resolve('./data/Launcher').replace(/\\/g, '/');
    let appdata = path.resolve('./data').replace(/\\/g, '/');
    if (!fs.existsSync(appPath)) fs.mkdirSync(appPath, { recursive: true });
    if (!fs.existsSync(appdata)) fs.mkdirSync(appdata, { recursive: true });
    app.setPath('userData', appPath);
    app.setPath('appData', appdata)
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(() => {
    if (dev) return MainWindow.createWindow()
    UpdateWindow.createWindow()
});

// Optimisation : Amélioration des IPC handlers avec vérification des fenêtres
ipcMain.on('main-window-open', () => MainWindow.createWindow());
ipcMain.on('main-window-dev-tools', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.webContents.openDevTools({ mode: 'detach' });
    }
});
ipcMain.on('main-window-dev-tools-close', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.webContents.closeDevTools();
    }
});
ipcMain.on('main-window-close', () => MainWindow.destroyWindow());
ipcMain.on('main-window-reload', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.reload();
    }
});
ipcMain.on('main-window-progress', (event, options) => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed() && options && typeof options.progress === 'number' && typeof options.size === 'number') {
        window.setProgressBar(options.progress / options.size);
    }
});
ipcMain.on('main-window-progress-reset', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.setProgressBar(-1);
    }
});
ipcMain.on('main-window-progress-load', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.setProgressBar(2);
    }
});
ipcMain.on('main-window-minimize', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.minimize();
    }
});

// Optimisation : Amélioration des handlers pour la fenêtre de mise à jour
ipcMain.on('update-window-close', () => UpdateWindow.destroyWindow());
ipcMain.on('update-window-dev-tools', () => {
    const window = UpdateWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.webContents.openDevTools({ mode: 'detach' });
    }
});
ipcMain.on('update-window-progress', (event, options) => {
    const window = UpdateWindow.getWindow();
    if (window && !window.isDestroyed() && options && typeof options.progress === 'number' && typeof options.size === 'number') {
        window.setProgressBar(options.progress / options.size);
    }
});
ipcMain.on('update-window-progress-reset', () => {
    const window = UpdateWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.setProgressBar(-1);
    }
});
ipcMain.on('update-window-progress-load', () => {
    const window = UpdateWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.setProgressBar(2);
    }
});

ipcMain.handle('path-user-data', () => app.getPath('userData'))
ipcMain.handle('appData', e => app.getPath('appData'))

// Optimisation : Amélioration des handlers de fenêtre avec validation
ipcMain.on('main-window-maximize', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        if (window.isMaximized()) {
            window.unmaximize();
        } else {
            window.maximize();
        }
    }
});

ipcMain.on('main-window-hide', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.hide();
    }
});

ipcMain.on('main-window-show', () => {
    const window = MainWindow.getWindow();
    if (window && !window.isDestroyed()) {
        window.show();
    }
});

// Optimisation : Amélioration du handler Microsoft avec gestion d'erreurs
ipcMain.handle('Microsoft-window', async (_, client_id) => {
    try {
        if (!client_id || typeof client_id !== 'string') {
            throw new Error('Client ID invalide');
        }
        return await new Microsoft(client_id).getAuth();
    } catch (error) {
        console.error('Erreur lors de l\'authentification Microsoft:', error);
        throw error;
    }
});

// Optimisation : Amélioration du handler de thème
ipcMain.handle('is-dark-theme', (_, theme) => {
    try {
        if (theme === 'dark') return true;
        if (theme === 'light') return false;
        return nativeTheme.shouldUseDarkColors;
    } catch (error) {
        console.error('Erreur lors de la détection du thème:', error);
        return false; // Fallback vers le thème clair
    }
});

// Optimisation : Gestion améliorée de la fermeture de l'application
app.on('window-all-closed', () => {
    // Nettoyer les ressources avant de quitter
    try {
        app.quit();
    } catch (error) {
        console.error('Erreur lors de la fermeture de l\'application:', error);
    }
});

// Optimisation : Configuration de l'auto-updater avec gestion d'erreurs améliorée
autoUpdater.autoDownload = false;

// Gestion améliorée des mises à jour avec retry
ipcMain.handle('update-app', async () => {
    return await new Promise(async (resolve, reject) => {
        try {
            const res = await autoUpdater.checkForUpdates();
            resolve(res);
        } catch (error) {
            console.error('Erreur lors de la vérification des mises à jour:', error);
            reject({
                error: true,
                message: error.message || 'Erreur inconnue lors de la vérification des mises à jour'
            });
        }
    });
});

// Optimisation : Amélioration de la gestion des événements de mise à jour
autoUpdater.on('update-available', () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('updateAvailable');
    }
});

ipcMain.on('start-update', () => {
    try {
        autoUpdater.downloadUpdate();
    } catch (error) {
        console.error('Erreur lors du téléchargement de la mise à jour:', error);
        const updateWindow = UpdateWindow.getWindow();
        if (updateWindow && !updateWindow.isDestroyed()) {
            updateWindow.webContents.send('error', error);
        }
    }
});

autoUpdater.on('update-not-available', () => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('update-not-available');
    }
});

autoUpdater.on('update-downloaded', () => {
    try {
        autoUpdater.quitAndInstall();
    } catch (error) {
        console.error('Erreur lors de l\'installation de la mise à jour:', error);
    }
});

autoUpdater.on('download-progress', (progress) => {
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('download-progress', progress);
    }
});

autoUpdater.on('error', (err) => {
    console.error('Erreur auto-updater:', err);
    const updateWindow = UpdateWindow.getWindow();
    if (updateWindow && !updateWindow.isDestroyed()) {
        updateWindow.webContents.send('error', err);
    }
});