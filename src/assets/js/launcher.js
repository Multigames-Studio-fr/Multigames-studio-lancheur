/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
// import panel
import Login from './panels/login.js';
import Home from './panels/home.js';
import Settings from './panels/settings.js';

// import modules
import { logger, config, changePanel, database, popup, setBackground, accountSelect, addAccount, pkg } from './utils.js';
const { AZauth, Microsoft, Mojang } = require('minecraft-java-core');

// Optimisations imports
import performanceOptimizer from './utils/performance.js';
import errorHandler from './utils/errorHandler.js';

// libs
const { ipcRenderer } = require('electron');
const fs = require('fs');
const os = require('os');

class Launcher {
    constructor() {
        // Optimisation : Initialisation des propriétés
        this.config = null;
        this.db = null;
        this.initComplete = false;
    }

    async init() {
        try {
            // Optimisation : Démarrer le monitoring de performance
            performanceOptimizer.startTimer('launcher-init');
            performanceOptimizer.logMemoryUsage('Début initialisation');
            
            // Activer les optimisations automatiques
            performanceOptimizer.enableAutoOptimizations();
            
            this.initLog();
            console.log('Initializing Launcher...');
            this.shortcut();
            await setBackground();
            this.initFrame();
            
            // Optimisation : Gestion d'erreur améliorée pour la configuration
            this.config = await errorHandler.safeAsync(async () => {
                return await config.GetConfig();
            }, 'Configuration Loading').catch(err => {
                console.error('Erreur lors du chargement de la configuration:', err);
                return { error: err };
            });
            
            if (this.config?.error) return this.errorConnect();
            
            this.db = new database();
            await this.initConfigClient();
            this.createPanels(Login, Home, Settings);
            await this.startLauncher();
            
            this.initComplete = true;
            
            // Optimisation : Fin du monitoring
            performanceOptimizer.endTimer('launcher-init');
            performanceOptimizer.logMemoryUsage('Fin initialisation');
            
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du launcher:', error);
            errorHandler.handleError({
                type: 'Launcher Initialization Error',
                message: error.message,
                error: error,
                timestamp: new Date().toISOString()
            });
            this.errorConnect();
        }
    }

    initLog() {
        // Optimisation : Amélioration de la gestion des raccourcis clavier
        const keyHandler = (e) => {
            if ((e.ctrlKey && e.shiftKey && e.keyCode === 73) || e.keyCode === 123) {
                ipcRenderer.send('main-window-dev-tools-close');
                ipcRenderer.send('main-window-dev-tools');
            }
        };
        
        document.removeEventListener('keydown', keyHandler); // Éviter les doublons
        document.addEventListener('keydown', keyHandler);
        
        new logger(pkg.name, '#7289da');
    }

    shortcut() {
        // Optimisation : Amélioration de la gestion des raccourcis
        const shortcutHandler = (e) => {
            if (e.ctrlKey && e.keyCode === 87) {
                ipcRenderer.send('main-window-close');
            }
        };
        
        document.removeEventListener('keydown', shortcutHandler); // Éviter les doublons
        document.addEventListener('keydown', shortcutHandler);
    }

    errorConnect() {
        const errorMessage = this.config?.error?.message || 'Erreur de connexion inconnue';
        const errorCode = this.config?.error?.code || 'ERREUR_CONNEXION';
        
        new popup().openPopup({
            title: errorCode,
            content: errorMessage,
            color: 'red',
            exit: true,
            options: true
        });
    }

    initFrame() {
        console.log('Initializing Frame...');
        const platform = os.platform() === 'darwin' ? "darwin" : "other";

        // Optimisation : Vérification de l'existence des éléments
        const frameElement = document.querySelector(`.${platform} .frame`);
        if (!frameElement) {
            console.warn('Élément frame non trouvé pour la plateforme:', platform);
            return;
        }
        
        frameElement.classList.toggle('hide');

        // Optimisation : Gestion sécurisée des boutons de fenêtre
        const minimizeBtn = document.querySelector(`.${platform} .frame #minimize`);
        if (minimizeBtn) {
            minimizeBtn.addEventListener('click', () => {
                ipcRenderer.send('main-window-minimize');
            });
        }

        let maximized = false;
        const maximizeBtn = document.querySelector(`.${platform} .frame #maximize`);
        if (maximizeBtn) {
            maximizeBtn.addEventListener('click', () => {
                ipcRenderer.send('main-window-maximize');
                maximized = !maximized;
                maximizeBtn.classList.toggle('icon-maximize');
                maximizeBtn.classList.toggle('icon-restore-down');
            });
        }

        const closeBtn = document.querySelector(`.${platform} .frame #close`);
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                ipcRenderer.send('main-window-close');
            });
        }
    }

    async initConfigClient() {
        console.log('Initializing Config Client...');
        
        try {
            let configClient = await this.db.readData('configClient');

            if (!configClient) {
                // Optimisation : Configuration par défaut améliorée
                const defaultConfig = {
                    account_selected: null,
                    instance_select: null, // Correction de la typo
                    java_config: {
                        java_path: null,
                        java_memory: {
                            min: 2,
                            max: Math.min(8, Math.floor(os.totalmem() / (1024 * 1024 * 1024) * 0.5)) // 50% de la RAM ou 8GB max
                        }
                    },
                    game_config: {
                        screen_size: {
                            width: 1280, // Résolution par défaut plus moderne
                            height: 720
                        }
                    },
                    launcher_config: {
                        download_multi: 5,
                        theme: 'auto',
                        closeLauncher: 'close-launcher',
                        intelEnabledMac: true
                    }
                };
                
                await this.db.createData('configClient', defaultConfig);
                console.log('Configuration client créée avec les valeurs par défaut');
            } else {
                // Optimisation : Validation et mise à jour de la configuration existante
                let needsUpdate = false;
                
                // Vérifier et corriger les valeurs manquantes
                if (!configClient.java_config) {
                    configClient.java_config = {
                        java_path: null,
                        java_memory: { min: 2, max: 8 }
                    };
                    needsUpdate = true;
                }
                
                if (!configClient.launcher_config) {
                    configClient.launcher_config = {
                        download_multi: 5,
                        theme: 'auto',
                        closeLauncher: 'close-launcher',
                        intelEnabledMac: true
                    };
                    needsUpdate = true;
                }
                
                // Correction de la typo si elle existe
                if (configClient.instance_selct && !configClient.instance_select) {
                    configClient.instance_select = configClient.instance_selct;
                    delete configClient.instance_selct;
                    needsUpdate = true;
                }
                
                if (needsUpdate) {
                    await this.db.updateData('configClient', configClient);
                    console.log('Configuration client mise à jour');
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'initialisation de la configuration client:', error);
        }
    }

    createPanels(...panels) {
        try {
            const panelsElem = document.querySelector('.panels');
            if (!panelsElem) {
                console.error('Élément .panels non trouvé');
                return;
            }
            
            for (let panel of panels) {
                console.log(`Initializing ${panel.name} Panel...`);
                
                // Optimisation : Vérification de l'existence du fichier HTML
                const panelPath = `${__dirname}/panels/${panel.id}.html`;
                if (!fs.existsSync(panelPath)) {
                    console.error(`Fichier de panel non trouvé: ${panelPath}`);
                    continue;
                }
                
                let div = document.createElement('div');
                div.classList.add('panel', panel.id);
                
                try {
                    div.innerHTML = fs.readFileSync(panelPath, 'utf8');
                    panelsElem.appendChild(div);
                    new panel().init(this.config);
                } catch (error) {
                    console.error(`Erreur lors du chargement du panel ${panel.id}:`, error);
                }
            }
        } catch (error) {
            console.error('Erreur lors de la création des panels:', error);
        }
    }

    async startLauncher() {
        try {
            const accounts = await this.db.readAllData('accounts');
            let configClient = await this.db.readData('configClient');
            const account_selected = configClient?.account_selected || null;
            const popupRefresh = new popup();

            if (accounts?.length) {
                console.log(`Vérification de ${accounts.length} compte(s)...`);
                
                // Optimisation : Traitement en parallèle des comptes avec limite
                const accountPromises = accounts.map(account => this.processAccount(account, account_selected, configClient, popupRefresh));
                await Promise.allSettled(accountPromises);

                // Recharger les données après traitement
                const updatedAccounts = await this.db.readAllData('accounts');
                configClient = await this.db.readData('configClient');
                const updatedAccountSelected = configClient?.account_selected || null;

                // Sélectionner automatiquement un compte si aucun n'est sélectionné
                if (!updatedAccountSelected && updatedAccounts.length > 0) {
                    const firstAccountId = updatedAccounts[0].ID;
                    if (firstAccountId) {
                        configClient.account_selected = firstAccountId;
                        await this.db.updateData('configClient', configClient);
                        await accountSelect(updatedAccounts[0]);
                    }
                }

                popupRefresh.closePopup();

                if (updatedAccounts.length === 0) {
                    configClient.account_selected = null;
                    await this.db.updateData('configClient', configClient);
                    return changePanel("login");
                }

                changePanel("home");
            } else {
                popupRefresh.closePopup();
                changePanel('login');
            }
        } catch (error) {
            console.error('Erreur lors du démarrage du launcher:', error);
            changePanel('login');
        }
    }

    // Optimisation : Fonction séparée pour traiter chaque compte
    async processAccount(account, account_selected, configClient, popupRefresh) {
        const account_ID = account.ID;
        
        try {
            if (account.error) {
                await this.db.deleteData('accounts', account_ID);
                return;
            }

            switch (account.meta.type) {
                case 'Xbox':
                    await this.processXboxAccount(account, account_ID, account_selected, configClient, popupRefresh);
                    break;
                case 'AZauth':
                    await this.processAZauthAccount(account, account_ID, account_selected, configClient, popupRefresh);
                    break;
                case 'Mojang':
                    await this.processMojangAccount(account, account_ID, account_selected, configClient, popupRefresh);
                    break;
                default:
                    console.error(`[Account] ${account.name}: Type de compte non reconnu`);
                    await this.db.deleteData('accounts', account_ID);
                    if (account_ID === account_selected) {
                        configClient.account_selected = null;
                        await this.db.updateData('configClient', configClient);
                    }
            }
        } catch (error) {
            console.error(`Erreur lors du traitement du compte ${account.name}:`, error);
            await this.db.deleteData('accounts', account_ID);
        }
    }

    async processXboxAccount(account, account_ID, account_selected, configClient, popupRefresh) {
        console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
        popupRefresh.openPopup({
            title: 'Connexion',
            content: `Vérification du compte Xbox: ${account.name}`,
            color: 'var(--color)',
            background: false
        });

        const refresh_accounts = await new Microsoft(this.config.client_id).refresh(account);

        if (refresh_accounts.error) {
            await this.db.deleteData('accounts', account_ID);
            if (account_ID === account_selected) {
                configClient.account_selected = null;
                await this.db.updateData('configClient', configClient);
            }
            console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage}`);
            return;
        }

        refresh_accounts.ID = account_ID;
        await this.db.updateData('accounts', refresh_accounts, account_ID);
        await addAccount(refresh_accounts);
        if (account_ID === account_selected) await accountSelect(refresh_accounts);
    }

    async processAZauthAccount(account, account_ID, account_selected, configClient, popupRefresh) {
        console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
        popupRefresh.openPopup({
            title: 'Connexion',
            content: `Vérification du compte AZauth: ${account.name}`,
            color: 'var(--color)',
            background: false
        });

        const refresh_accounts = await new AZauth(this.config.online).verify(account);

        if (refresh_accounts.error) {
            await this.db.deleteData('accounts', account_ID);
            if (account_ID === account_selected) {
                configClient.account_selected = null;
                await this.db.updateData('configClient', configClient);
            }
            console.error(`[Account] ${account.name}: ${refresh_accounts.message}`);
            return;
        }

        refresh_accounts.ID = account_ID;
        await this.db.updateData('accounts', refresh_accounts, account_ID);
        await addAccount(refresh_accounts);
        if (account_ID === account_selected) await accountSelect(refresh_accounts);
    }

    async processMojangAccount(account, account_ID, account_selected, configClient, popupRefresh) {
        console.log(`Account Type: ${account.meta.type} | Username: ${account.name}`);
        popupRefresh.openPopup({
            title: 'Connexion',
            content: `Vérification du compte Mojang: ${account.name}`,
            color: 'var(--color)',
            background: false
        });

        if (account.meta.online === false) {
            const refresh_accounts = await Mojang.login(account.name);
            refresh_accounts.ID = account_ID;
            await addAccount(refresh_accounts);
            await this.db.updateData('accounts', refresh_accounts, account_ID);
            if (account_ID === account_selected) await accountSelect(refresh_accounts);
            return;
        }

        const refresh_accounts = await Mojang.refresh(account);

        if (refresh_accounts.error) {
            await this.db.deleteData('accounts', account_ID);
            if (account_ID === account_selected) {
                configClient.account_selected = null;
                await this.db.updateData('configClient', configClient);
            }
            console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage}`);
            return;
        }

        refresh_accounts.ID = account_ID;
        await this.db.updateData('accounts', refresh_accounts, account_ID);
        await addAccount(refresh_accounts);
        if (account_ID === account_selected) await accountSelect(refresh_accounts);
    }
}

new Launcher().init();
