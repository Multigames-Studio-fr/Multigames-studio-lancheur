/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
const { AZauth, Mojang } = require('minecraft-java-core');
const { ipcRenderer } = require('electron');

import { popup, database, changePanel, accountSelect, addAccount, config, setStatus } from '../utils.js';

class Login {
    static id = "login";
    async init(config) {
        this.config = config;
        this.db = new database();

        if (typeof this.config.online == 'boolean') {
            this.config.online ? this.getMicrosoft() : this.getCrack()
        } else if (typeof this.config.online == 'string') {
            if (this.config.online.match(/^(http|https):\/\/[^ "]+$/)) {
                this.getAZauth();
            }
        }
        
        document.querySelector('.cancel-home').addEventListener('click', () => {
            document.querySelector('.cancel-home').style.display = 'none'
            changePanel('settings')
        })
    }

    async getMicrosoft() {
        console.log('Initializing Microsoft login...');
        let popupLogin = new popup();
        let loginHome = document.querySelector('.login-home');
        let microsoftBtn = document.querySelector('.connect-home');
        loginHome.style.display = 'block';

        microsoftBtn.addEventListener("click", () => {
            // Affiche le popup de chargement Tailwind
            document.getElementById('loading-popup').style.display = 'flex';
        
            ipcRenderer.invoke('Microsoft-window', this.config.client_id).then(async account_connect => {
                // Masque le popup de chargement
                document.getElementById('loading-popup').style.display = 'none';
        
                if (account_connect == 'cancel' || !account_connect) {
                    popupLogin.closePopup();
                    return;
                } else {
                    await this.saveData(account_connect)
                    popupLogin.closePopup();
                }
        
            }).catch(err => {
                document.getElementById('loading-popup').style.display = 'none';
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: err,
                    options: true
                });
            });
        });
    }

    async getCrack() {
        console.log('Initializing offline login...');
        let popupLogin = new popup();
        let loginOffline = document.querySelector('.login-offline');

        let emailOffline = document.querySelector('.email-offline');
        let connectOffline = document.querySelector('.connect-offline');
        loginOffline.style.display = 'block';

        connectOffline.addEventListener('click', async () => {
            if (emailOffline.value.length < 3) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo doit faire au moins 3 caractères.',
                    options: true
                });
                return;
            }

            if (emailOffline.value.match(/ /g)) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Votre pseudo ne doit pas contenir d\'espaces.',
                    options: true
                });
                return;
            }

            let MojangConnect = await Mojang.login(emailOffline.value);

            if (MojangConnect.error) {
                popupLogin.openPopup({
                    title: 'Erreur',
                    content: MojangConnect.message,
                    options: true
                });
                return;
            }
            await this.saveData(MojangConnect)
            popupLogin.closePopup();
        });
    }

    async getAZauth() {
        console.log('Initializing AZauth login...');
        let AZauthClient = new AZauth(this.config.online);
        let PopupLogin = new popup();
        let loginAZauth = document.querySelector('.login-AZauth');
        let loginAZauthA2F = document.querySelector('.login-AZauth-A2F');

        let AZauthEmail = document.querySelector('.email-AZauth');
        let AZauthPassword = document.querySelector('.password-AZauth');
        let AZauthA2F = document.querySelector('.A2F-AZauth');
        let connectAZauthA2F = document.querySelector('.connect-AZauth-A2F');
        let AZauthConnectBTN = document.querySelector('.connect-AZauth');
        let AZauthCancelA2F = document.querySelector('.cancel-AZauth-A2F');

        loginAZauth.style.display = 'block';

        AZauthConnectBTN.addEventListener('click', async () => {
            PopupLogin.openPopup({
                title: 'Connexion en cours...',
                content: 'Veuillez patienter...',
                color: 'var(--color)'
            });

            if (AZauthEmail.value == '' || AZauthPassword.value == '') {
                PopupLogin.openPopup({
                    title: 'Erreur',
                    content: 'Veuillez remplir tous les champs.',
                    options: true
                });
                return;
            }

            let AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value);

            if (AZauthConnect.error) {
                PopupLogin.openPopup({
                    title: 'Erreur',
                    content: AZauthConnect.message,
                    options: true
                });
                return;
            } else if (AZauthConnect.A2F) {
                loginAZauthA2F.style.display = 'block';
                loginAZauth.style.display = 'none';
                PopupLogin.closePopup();

                AZauthCancelA2F.addEventListener('click', () => {
                    loginAZauthA2F.style.display = 'none';
                    loginAZauth.style.display = 'block';
                });

                connectAZauthA2F.addEventListener('click', async () => {
                    PopupLogin.openPopup({
                        title: 'Connexion en cours...',
                        content: 'Veuillez patienter...',
                        color: 'var(--color)'
                    });

                    if (AZauthA2F.value == '') {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: 'Veuillez entrer le code A2F.',
                            options: true
                        });
                        return;
                    }

                    AZauthConnect = await AZauthClient.login(AZauthEmail.value, AZauthPassword.value, AZauthA2F.value);

                    if (AZauthConnect.error) {
                        PopupLogin.openPopup({
                            title: 'Erreur',
                            content: AZauthConnect.message,
                            options: true
                        });
                        return;
                    }

                    await this.saveData(AZauthConnect)
                    PopupLogin.closePopup();
                });
            } else if (!AZauthConnect.A2F) {
                await this.saveData(AZauthConnect)
                PopupLogin.closePopup();
            }
        });
    }

    async saveData(connectionData) {
        try {
            // Optimisation : Validation et nettoyage des données de connexion
            if (!connectionData) {
                throw new Error('Données de connexion manquantes');
            }

            // Debug : Afficher les données reçues pour diagnostiquer
            console.log('Données de connexion reçues:', {
                data: connectionData,
                hasName: !!connectionData.name,
                hasProfile: !!connectionData.profile,
                hasUsername: !!connectionData.username,
                metaType: connectionData.meta?.type
            });

            // S'assurer que le nom est défini correctement selon le type de compte
            if (!connectionData.name) {
                if (connectionData.profile?.name) {
                    connectionData.name = connectionData.profile.name;
                } else if (connectionData.username) {
                    connectionData.name = connectionData.username;
                } else if (connectionData.meta?.type === 'Xbox' && connectionData.uuid) {
                    connectionData.name = `Joueur_${connectionData.uuid.slice(-6)}`;
                } else {
                    connectionData.name = `Joueur_${Date.now().toString().slice(-6)}`;
                }
                console.log('Nom de compte généré automatiquement:', connectionData.name);
            }

            // Validation finale avant sauvegarde
            if (!connectionData.name || connectionData.name === 'undefined') {
                throw new Error('Impossible de déterminer le nom du compte');
            }

            console.log('Sauvegarde des données de connexion:', {
                name: connectionData.name,
                type: connectionData.meta?.type,
                uuid: connectionData.uuid
            });

            let configClient = await this.db.readData('configClient');
            let account = await this.db.createData('accounts', connectionData);
            
            // Correction de la typo
            let instanceSelect = configClient.instance_select || configClient.instance_selct; // Support ancien format
            let instancesList = await config.getInstanceList();
            
            configClient.account_selected = account.ID;

            // Vérification des whitelists
            for (let instance of instancesList) {
                if (instance.whitelistActive) {
                    let whitelist = instance.whitelist.find(whitelist => whitelist === account.name);
                    if (whitelist !== account.name) {
                        if (instance.name === instanceSelect) {
                            let newInstanceSelect = instancesList.find(i => i.whitelistActive === false);
                            if (newInstanceSelect) {
                                configClient.instance_select = newInstanceSelect.name;
                                await setStatus(newInstanceSelect.status);
                            }
                        }
                    }
                }
            }

            // Nettoyer l'ancienne propriété avec typo si elle existe
            if (configClient.instance_selct) {
                configClient.instance_select = configClient.instance_selct;
                delete configClient.instance_selct;
            }

            await this.db.updateData('configClient', configClient);
            
            // Validation finale avant d'ajouter le compte à l'interface
            if (!account || !account.name) {
                throw new Error('Compte créé mais données invalides pour l\'interface');
            }
            
            console.log('Données du compte avant ajout à l\'interface:', {
                ID: account.ID,
                name: account.name,
                meta: account.meta
            });
            
            await addAccount(account);
            await accountSelect(account);
            changePanel('home');
            
            console.log('Compte sauvegardé avec succès:', account.name);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des données:', error);
            console.error('Stack trace:', error.stack);
            console.error('Données qui ont causé l\'erreur:', {
                connectionData: connectionData,
                hasConnectionData: !!connectionData,
                connectionDataName: connectionData?.name
            });
            
            // Afficher un message d'erreur plus détaillé à l'utilisateur
            let popupError = new popup();
            popupError.openPopup({
                title: 'Erreur de sauvegarde',
                content: `Impossible de sauvegarder le compte.<br>
                         Détails: ${error.message}<br>
                         Veuillez réessayer ou contacter le support.`,
                color: 'red',
                options: true
            });
        }
    }
}
export default Login;