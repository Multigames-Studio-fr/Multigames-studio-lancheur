/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");
const os = require("os");
const pkg = require("../../../../package.json");
let dev = process.env.DEV_TOOL === 'open';
let mainWindow = undefined;

function getWindow() {
    return mainWindow;
}

function destroyWindow() {
    if (!mainWindow) return;
    
    try {
        // Optimisation : Nettoyer les événements avant la destruction
        if (!mainWindow.isDestroyed()) {
            mainWindow.removeAllListeners();
            mainWindow.close();
        }
        mainWindow = undefined;
        app.quit();
    } catch (error) {
        console.error('Erreur lors de la destruction de la fenêtre:', error);
        app.quit();
    }
}

function createWindow() {
    try {
        destroyWindow();
        
        // Optimisation : Configuration améliorée de la fenêtre avec sécurité
        mainWindow = new BrowserWindow({
            title: pkg.preductname,
            width: 1214,
            height: 720,
            minWidth: 980,
            minHeight: 552,
            resizable: false,
            icon: `./src/assets/images/icon.${os.platform() === "win32" ? "ico" : "png"}`,
            frame: false,
            show: false,
            webPreferences: {
                contextIsolation: false,
                nodeIntegration: true,
                // Optimisation : Désactiver les fonctionnalités non nécessaires pour la performance
                webSecurity: true,
                allowRunningInsecureContent: false,
                experimentalFeatures: false
            },
        });
        
        Menu.setApplicationMenu(null);
        mainWindow.setMenuBarVisibility(false);
        
        // Optimisation : Gestion d'erreur pour le chargement du fichier
        const htmlPath = path.join(`${app.getAppPath()}/src/launcher.html`);
        mainWindow.loadFile(htmlPath).catch(error => {
            console.error('Erreur lors du chargement du fichier HTML:', error);
        });
        
        // Optimisation : Amélioration de l'événement ready-to-show
        mainWindow.once('ready-to-show', () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                if (dev) {
                    mainWindow.webContents.openDevTools({ mode: 'detach' });
                }
                mainWindow.show();
            }
        });
        
        // Optimisation : Gestion des erreurs de la fenêtre
        mainWindow.on('unresponsive', () => {
            console.warn('La fenêtre principale ne répond plus');
        });
        
        mainWindow.webContents.on('crashed', () => {
            console.error('Le contenu web a planté');
        });
        
    } catch (error) {
        console.error('Erreur lors de la création de la fenêtre:', error);
    }
}

module.exports = {
    getWindow,
    createWindow,
    destroyWindow,
};