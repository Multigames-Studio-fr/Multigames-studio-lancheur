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

// Modules d'optimisation désactivés temporairement pour stabilité
// TODO: Réactiver après avoir résolu les problèmes de chemins

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
            this.initLog();
            console.log('Initializing Launcher...');
            this.shortcut();
            await setBackground();
            this.initFrame();
            
            // Configuration sans modules d'optimisation pour l'instant
            this.config = await config.GetConfig().catch(err => {
                console.error('Erreur lors du chargement de la configuration:', err);
                // Retourner une configuration par défaut au lieu d'une erreur
                return {
                    maintenance: false,
                    game_news: [],
                    java: {
                        java_8: { path: "", url: "" },
                        java_17: { path: "", url: "" }
                    },
                    launcher_news: [],
                    modpacks: [],
                    // Configuration d'authentification par défaut
                    online: false,
                    client_id: null,
                    dataDirectory: 'multigames-studio-launcher'
                };
            });
            
            // S'assurer que la configuration a les propriétés nécessaires
            if (!this.config.hasOwnProperty('online')) {
                this.config.online = false; // Mode offline par défaut
            }
            if (!this.config.hasOwnProperty('dataDirectory')) {
                this.config.dataDirectory = 'multigames-studio-launcher';
            }
            
            console.log('Configuration utilisée:', {
                online: this.config.online,
                dataDirectory: this.config.dataDirectory,
                client_id: this.config.client_id ? 'Défini' : 'Non défini'
            });
            
            // Supprimer la vérification d'erreur car on retourne toujours une config valide maintenant
            // if (this.config?.error) return this.errorConnect();
            
            this.db = new database();
            await this.initConfigClient();
            this.createPanels(Login, Home, Settings);
            await this.startLauncher();
            
            this.initComplete = true;
            
            // Diagnostic simpliste temporaire
            console.log('✅ Launcher initialisé avec succès');
            
        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation du launcher:', error);
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
                
                // Diagnostic temporairement désactivé
                // if (process.env.NODE_ENV === 'dev') {
                //     await accountDiagnostic.diagnoseAllAccounts(this.db);
                // }
                
                // Compteur d'échecs de reconnexion
                let reconnectionFailures = 0;
                
                // Traitement des comptes
                const accountPromises = accounts.map(account => 
                    this.processAccount(account, account_selected, configClient, popupRefresh)
                        .catch(error => {
                            reconnectionFailures++;
                            console.error(`Échec de reconnexion pour ${account.name}:`, error);
                            return null;
                        })
                );
                await Promise.allSettled(accountPromises);

                // Si tous les comptes ont échoué, proposer de vider la DB
                if (reconnectionFailures === accounts.length && accounts.length > 0) {
                    await this.handleAllReconnectionFailures(popupRefresh);
                    return;
                }

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

    // Nouvelle méthode pour gérer les échecs de reconnexion
    async handleAllReconnectionFailures(popupRefresh) {
        console.warn('🚨 Tous les comptes ont échoué lors de la reconnexion');
        
        popupRefresh.openPopup({
            title: 'Échec de reconnexion',
            content: `
                <div style="text-align: center; padding: 20px;">
                    <p style="margin-bottom: 15px; color: #ff6b6b;">
                        ❌ Impossible de reconnecter tous les comptes
                    </p>
                    <p style="margin-bottom: 20px; font-size: 14px; opacity: 0.8;">
                        Cela peut être dû à des tokens expirés ou des problèmes de réseau.
                    </p>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="clear-db-btn" style="
                            background: #ff6b6b; 
                            color: white; 
                            border: none; 
                            padding: 10px 20px; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            Vider la base de données
                        </button>
                        <button id="retry-btn" style="
                            background: #4ecdc4; 
                            color: white; 
                            border: none; 
                            padding: 10px 20px; 
                            border-radius: 5px; 
                            cursor: pointer;
                            font-weight: bold;
                        ">
                            Réessayer
                        </button>
                    </div>
                </div>
            `,
            color: 'red',
            exit: false,
            options: false
        });

        // Ajouter les gestionnaires d'événements
        setTimeout(() => {
            const clearDbBtn = document.getElementById('clear-db-btn');
            const retryBtn = document.getElementById('retry-btn');

            if (clearDbBtn) {
                clearDbBtn.addEventListener('click', async () => {
                    console.log('🗑️ Utilisateur a choisi de vider la base de données');
                    
                    popupRefresh.openPopup({
                        title: 'Vidage en cours...',
                        content: 'Suppression des données corrompues...',
                        color: 'orange',
                        background: false
                    });

                    const success = await this.db.clearAllData();
                    
                    if (success) {
                        popupRefresh.openPopup({
                            title: 'Base de données vidée',
                            content: 'Toutes les données ont été supprimées. Redirection vers la connexion...',
                            color: 'green',
                            background: false
                        });
                        
                        setTimeout(() => {
                            popupRefresh.closePopup();
                            changePanel('login');
                        }, 2000);
                    } else {
                        popupRefresh.openPopup({
                            title: 'Erreur',
                            content: 'Impossible de vider la base de données. Veuillez redémarrer le launcher.',
                            color: 'red',
                            options: true
                        });
                    }
                });
            }

            if (retryBtn) {
                retryBtn.addEventListener('click', async () => {
                    console.log('🔄 Utilisateur a choisi de réessayer');
                    popupRefresh.closePopup();
                    
                    // Attendre un peu avant de réessayer
                    setTimeout(() => {
                        this.startLauncher();
                    }, 1000);
                });
            }
        }, 100);
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
        console.log(`Account Type: ${account.meta.type} | Username: ${account.name || 'Nom manquant'}`);
        popupRefresh.openPopup({
            title: 'Connexion',
            content: `Vérification du compte Xbox: ${account.name || 'Compte Microsoft'}`,
            color: 'var(--color)',
            background: false
        });

        try {
            const refresh_accounts = await new Microsoft(this.config.client_id).refresh(account);

            if (refresh_accounts.error) {
                console.error(`[Account] ${account.name}: ${refresh_accounts.errorMessage}`);
                await this.db.deleteData('accounts', account_ID);
                if (account_ID === account_selected) {
                    configClient.account_selected = null;
                    await this.db.updateData('configClient', configClient);
                }
                throw new Error(`Échec de reconnexion Xbox: ${refresh_accounts.errorMessage}`);
            }

            // Optimisation : S'assurer que le nom est correct
            if (!refresh_accounts.name && refresh_accounts.profile?.name) {
                refresh_accounts.name = refresh_accounts.profile.name;
            }
            
            // Validation finale du nom
            if (!refresh_accounts.name || refresh_accounts.name === 'undefined') {
                refresh_accounts.name = account.name || `Joueur_${Date.now().toString().slice(-6)}`;
                console.warn('Nom de compte Microsoft corrigé:', refresh_accounts.name);
            }

            refresh_accounts.ID = account_ID;
            await this.db.updateData('accounts', refresh_accounts, account_ID);
            await addAccount(refresh_accounts);
            if (account_ID === account_selected) await accountSelect(refresh_accounts);
            
            console.log('Compte Xbox rafraîchi avec succès:', refresh_accounts.name);
        } catch (error) {
            console.error('Erreur lors du rafraîchissement du compte Xbox:', error);
            await this.db.deleteData('accounts', account_ID);
            if (account_ID === account_selected) {
                configClient.account_selected = null;
                await this.db.updateData('configClient', configClient);
            }
            throw error; // Propager l'erreur pour comptage des échecs
        }
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
            throw new Error(`Échec de reconnexion AZauth: ${refresh_accounts.message}`);
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
            throw new Error(`Échec de reconnexion Mojang: ${refresh_accounts.errorMessage}`);
        }

        refresh_accounts.ID = account_ID;
        await this.db.updateData('accounts', refresh_accounts, account_ID);
        await addAccount(refresh_accounts);
        if (account_ID === account_selected) await accountSelect(refresh_accounts);
    }
}

// Optimisation : Ajout de fonctions de diagnostic globales pour le développement
if (typeof window !== 'undefined') {
    window.launcherDiagnostic = {
        async diagnoseAccounts() {
            const launcher = new Launcher();
            launcher.db = new database();
            return await accountDiagnostic.diagnoseAllAccounts(launcher.db);
        },
        
        async fixAccounts() {
            const launcher = new Launcher();
            launcher.db = new database();
            const accounts = await launcher.db.readAllData('accounts');
            
            for (const account of accounts) {
                const fixResult = await accountDiagnostic.fixAccount(account);
                if (fixResult.wasFixed) {
                    await launcher.db.updateData('accounts', fixResult.fixed, account.ID);
                    console.log('✅ Compte réparé:', fixResult.fixed.name);
                }
            }
            
            console.log('🎉 Réparation terminée');
        },
        
        async clearBrokenAccounts() {
            const launcher = new Launcher();
            launcher.db = new database();
            const accounts = await launcher.db.readAllData('accounts');
            
            for (const account of accounts) {
                const diagnostic = await accountDiagnostic.diagnoseAccount(account);
                if (!diagnostic.isValid) {
                    await launcher.db.deleteData('accounts', account.ID);
                    console.log('🗑️ Compte supprimé:', account.ID);
                }
            }
            
            console.log('🧹 Nettoyage terminé');
        },

        // Nouvelles fonctions pour le rapport d'erreurs Discord
        async testErrorReport() {
            console.log('🧪 Test du système de rapport d\'erreurs...');
            await errorReporter.testReport();
        },

        resetErrorReportConsent() {
            errorReporter.resetConsent();
            console.log('✅ Consentement de rapport d\'erreurs réinitialisé');
        },

        getErrorReportStatus() {
            const status = errorReporter.getStatus();
            console.log('� Statut du rapport d\'erreurs:', status);
            return status;
        },

        async sendManualReport(description) {
            const manualError = {
                type: 'Manual Report',
                message: description || 'Rapport manuel envoyé par l\'utilisateur',
                timestamp: new Date().toISOString(),
                error: new Error('Manual report')
            };
            
            await errorReporter.reportError(manualError);
            console.log('📤 Rapport manuel envoyé');
        }
    };
    
    console.log('�🔧 Fonctions de diagnostic disponibles:');
    console.log('- launcherDiagnostic.diagnoseAccounts() : Diagnostiquer tous les comptes');
    console.log('- launcherDiagnostic.fixAccounts() : Réparer les comptes');
    console.log('- launcherDiagnostic.clearBrokenAccounts() : Supprimer les comptes cassés');
    console.log('- launcherDiagnostic.testErrorReport() : Tester le rapport d\'erreurs Discord');
    console.log('- launcherDiagnostic.resetErrorReportConsent() : Réinitialiser le consentement');
    console.log('- launcherDiagnostic.getErrorReportStatus() : Voir le statut');
    console.log('- launcherDiagnostic.sendManualReport("description") : Envoyer un rapport manuel');
}

new Launcher().init();
