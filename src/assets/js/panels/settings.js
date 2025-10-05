/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

import { changePanel, accountSelect, database, Slider, config, setStatus, popup, appdata, setBackground } from '../utils.js'
const { ipcRenderer } = require('electron');
const os = require('os');

class Settings {
    static id = "settings";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.navBTN()
        this.accounts()
        this.ram()
        this.javaPath()
        this.resolution()
        this.launcher()
    }

    navBTN() {
        document.querySelector('.nav-box').addEventListener('click', e => {
            if (e.target.classList.contains('nav-settings-btn')) {
                let id = e.target.id

                let activeSettingsBTN = document.querySelector('.active-settings-BTN')
                let activeContainerSettings = document.querySelector('.active-container-settings')

                if (id == 'save') {
                    if (activeSettingsBTN) activeSettingsBTN.classList.remove('active-settings-BTN');
                    document.querySelector('#account').classList.add('active-settings-BTN');

                    if (activeContainerSettings) activeContainerSettings.classList.remove('active-container-settings');
                    document.querySelector(`#account-tab`).classList.add('active-container-settings');
                    return changePanel('home')
                }

                if (activeSettingsBTN) activeSettingsBTN.classList.remove('active-settings-BTN');
                e.target.classList.add('active-settings-BTN');

                if (activeContainerSettings) activeContainerSettings.classList.remove('active-container-settings');
                document.querySelectorAll('.container-settings').forEach(tab => tab.classList.add('hidden'));
                let targetTab = document.querySelector(`#${id}-tab`);
                if (targetTab) {
                    targetTab.classList.remove('hidden');
                    targetTab.classList.add('active-container-settings');
                }
            }
        })
    }

    accounts() {
        document.querySelector('.accounts-list').addEventListener('click', async e => {
            let popupAccount = new popup()
            try {
                let id = e.target.id
                if (e.target.classList.contains('account')) {
                    popupAccount.openPopup({
                        title: 'Connexion',
                        content: 'Veuillez patienter...',

                    })

                    if (id == 'add') {
                        document.querySelector('.cancel-home').style.display = 'inline'
                        return changePanel('login')
                    }

                    let account = await this.db.readData('accounts', id);
                    let configClient = await this.setInstance(account);
                    await accountSelect(account);
                    configClient.account_selected = account.ID;
                    return await this.db.updateData('configClient', configClient);
                }

                if (e.target.classList.contains("delete-profile")) {
                    popupAccount.openPopup({
                        title: 'Connexion',
                        content: 'Veuillez patienter...',
                        color: 'var(--color)'
                    })
                    await this.db.deleteData('accounts', id);
                    let deleteProfile = document.getElementById(`${id}`);
                    let accountListElement = document.querySelector('.accounts-list');
                    accountListElement.removeChild(deleteProfile);

                    if (accountListElement.children.length == 1) return changePanel('login');

                    let configClient = await this.db.readData('configClient');

                    if (configClient.account_selected == id) {
                        let allAccounts = await this.db.readAllData('accounts');
                        configClient.account_selected = allAccounts[0].ID
                        accountSelect(allAccounts[0]);
                        let newInstanceSelect = await this.setInstance(allAccounts[0]);
                        configClient.instance_selct = newInstanceSelect.instance_selct
                        return await this.db.updateData('configClient', configClient);
                    }
                }
            } catch (err) {
                console.error(err)
            } finally {
                popupAccount.closePopup();
            }
        })
    }

    async setInstance(auth) {
        let configClient = await this.db.readData('configClient')
        let instanceSelect = configClient.instance_selct
        let instancesList = await config.getInstanceList()

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == auth.name)
                if (whitelist !== auth.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        configClient.instance_selct = newInstanceSelect.name
                        await setStatus(newInstanceSelect.status)
                    }
                }
            }
        }
        return configClient
    }

    async ram() {
        try {
            const config = await this.db.readData('configClient');
            
            // Optimisation : Calcul plus précis de la mémoire
            const totalMem = Math.round((os.totalmem() / (1024 ** 3)) * 10) / 10;
            const freeMem = Math.round((os.freemem() / (1024 ** 3)) * 10) / 10;

            // Mettre à jour les informations système
            const totalRamElement = document.getElementById("total-ram");
            const freeRamElement = document.getElementById("free-ram");
            
            if (totalRamElement) totalRamElement.textContent = `${totalMem} Go`;
            if (freeRamElement) freeRamElement.textContent = `${freeMem} Go`;

            // Configuration de la RAM avec valeurs par défaut sécurisées
            const currentRamValue = config?.java_config?.java_memory?.max || Math.min(8, Math.floor(totalMem * 0.5));

            // Optimisation : Limites plus intelligentes
            const minRam = 2;
            const maxRam = Math.min(Math.floor(totalMem * 0.75), 32); // 75% de la RAM ou 32GB max
            const recommendedRam = Math.min(Math.floor(totalMem * 0.5), 16); // 50% ou 16GB max

            const ramSlider = document.getElementById("ram-slider");
            const ramValue = document.getElementById("ram-value");
            const ramMin = document.getElementById("ram-min");
            const ramMax = document.getElementById("ram-max");

            if (!ramSlider || !ramValue || !ramMin || !ramMax) {
                console.warn('Éléments de RAM manquants dans le DOM');
                return;
            }

            // Configurer le slider avec des valeurs sécurisées
            ramSlider.min = minRam;
            ramSlider.max = maxRam;
            ramSlider.value = Math.min(Math.max(currentRamValue, minRam), maxRam);
            
            ramMin.textContent = `${minRam} Go`;
            ramMax.textContent = `${maxRam} Go`;
            ramValue.textContent = `${ramSlider.value} Go`;

            // Ajouter une indication de valeur recommandée
            const recommendedIndicator = document.createElement('span');
            recommendedIndicator.textContent = ` (Recommandé: ${recommendedRam} Go)`;
            recommendedIndicator.style.color = '#F8BA59';
            recommendedIndicator.style.fontSize = '0.8em';
            
            // Nettoyer les anciens indicateurs
            const existingIndicator = ramValue.parentNode.querySelector('.recommended-indicator');
            if (existingIndicator) existingIndicator.remove();
            
            recommendedIndicator.className = 'recommended-indicator';
            ramValue.parentNode.appendChild(recommendedIndicator);

            // Optimisation : Debounce pour éviter trop de sauvegardes
            let saveTimeout;
            const debouncedSave = async (newValue) => {
                clearTimeout(saveTimeout);
                saveTimeout = setTimeout(async () => {
                    try {
                        let config = await this.db.readData('configClient');
                        if (!config.java_config) config.java_config = {};
                        if (!config.java_config.java_memory) config.java_config.java_memory = {};
                        
                        config.java_config.java_memory = {
                            min: Math.min(minRam, newValue),
                            max: newValue
                        };
                        
                        await this.db.updateData('configClient', config);
                        console.log(`RAM mise à jour: ${newValue} Go`);
                    } catch (error) {
                        console.error('Erreur lors de la sauvegarde de la RAM:', error);
                    }
                }, 500); // 500ms de délai
            };

            // Gestionnaire d'événement optimisé
            ramSlider.removeEventListener('input', this.ramInputHandler); // Nettoyer l'ancien
            this.ramInputHandler = (e) => {
                const newValue = parseInt(e.target.value);
                ramValue.textContent = `${newValue} Go`;
                
                // Indication visuelle de la qualité du choix
                if (newValue <= recommendedRam) {
                    ramValue.style.color = '#4ade80'; // Vert
                } else if (newValue <= maxRam * 0.9) {
                    ramValue.style.color = '#f59e0b'; // Orange
                } else {
                    ramValue.style.color = '#ef4444'; // Rouge
                }
                
                debouncedSave(newValue);
            };
            
            ramSlider.addEventListener('input', this.ramInputHandler);

        } catch (error) {
            console.error('Erreur lors de la configuration de la RAM:', error);
        }
    }

    async javaPath() {
        let javaPathText = document.querySelector(".java-path-txt")
        javaPathText.textContent = `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}/runtime`;

        let configClient = await this.db.readData('configClient')
        let javaPath = configClient?.java_config?.java_path || 'Utiliser la version de java livre avec le launcher';
        let javaPathInputTxt = document.querySelector(".java-path-input-text");
        let javaPathInputFile = document.querySelector(".java-path-input-file");
        javaPathInputTxt.value = javaPath;

        document.querySelector(".java-path-set").addEventListener("click", async () => {
            javaPathInputFile.value = '';
            javaPathInputFile.click();
            await new Promise((resolve) => {
                let interval;
                interval = setInterval(() => {
                    if (javaPathInputFile.value != '') resolve(clearInterval(interval));
                }, 100);
            });

            if (javaPathInputFile.value.replace(".exe", '').endsWith("java") || javaPathInputFile.value.replace(".exe", '').endsWith("javaw")) {
                let configClient = await this.db.readData('configClient')
                let file = javaPathInputFile.files[0].path;
                javaPathInputTxt.value = file;
                configClient.java_config.java_path = file
                await this.db.updateData('configClient', configClient);
            } else alert("Le nom du fichier doit être java ou javaw");
        });

        document.querySelector(".java-path-reset").addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            javaPathInputTxt.value = 'Utiliser la version de java livre avec le launcher';
            configClient.java_config.java_path = null
            await this.db.updateData('configClient', configClient);
        });
    }

    async resolution() {
        let configClient = await this.db.readData('configClient')
        let resolution = configClient?.game_config?.screen_size || { width: 1920, height: 1080 };

        let width = document.querySelector(".width-size");
        let height = document.querySelector(".height-size");
        let resolutionReset = document.querySelector(".size-reset");

        width.value = resolution.width;
        height.value = resolution.height;

        width.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.width = width.value;
            await this.db.updateData('configClient', configClient);
        })

        height.addEventListener("change", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size.height = height.value;
            await this.db.updateData('configClient', configClient);
        })

        resolutionReset.addEventListener("click", async () => {
            let configClient = await this.db.readData('configClient')
            configClient.game_config.screen_size = { width: '854', height: '480' };
            width.value = '854';
            height.value = '480';
            await this.db.updateData('configClient', configClient);
        })
    }

    async launcher() {
        try {
            const configClient = await this.db.readData('configClient');

            // Optimisation : Gestion améliorée des téléchargements multiples
            const currentDownloadFiles = configClient?.launcher_config?.download_multi || 5;
            const maxDownloadFilesInput = document.querySelector(".max-files");
            const maxDownloadFilesReset = document.querySelector(".max-files-reset");

            if (!maxDownloadFilesInput || !maxDownloadFilesReset) {
                console.warn('Éléments de configuration des téléchargements manquants');
                return;
            }

            // Validation et limites intelligentes
            const minFiles = 1;
            const maxFiles = 20; // Limiter pour éviter la surcharge
            const recommendedFiles = 5;

            maxDownloadFilesInput.value = Math.min(Math.max(currentDownloadFiles, minFiles), maxFiles);
            maxDownloadFilesInput.min = minFiles;
            maxDownloadFilesInput.max = maxFiles;

            // Ajout d'une indication
            const helpText = document.createElement('small');
            helpText.textContent = `Recommandé: ${recommendedFiles} fichiers. Plus élevé = plus rapide mais plus de charge réseau.`;
            helpText.style.color = '#888';
            helpText.style.display = 'block';
            helpText.style.marginTop = '5px';
            
            // Nettoyer les anciens textes d'aide
            const existingHelp = maxDownloadFilesInput.parentNode.querySelector('.download-help');
            if (existingHelp) existingHelp.remove();
            
            helpText.className = 'download-help';
            maxDownloadFilesInput.parentNode.appendChild(helpText);

            // Optimisation : Debounce pour les changements
            let changeTimeout;
            const debouncedSave = async (value) => {
                clearTimeout(changeTimeout);
                changeTimeout = setTimeout(async () => {
                    try {
                        const validValue = Math.min(Math.max(parseInt(value), minFiles), maxFiles);
                        
                        let configClient = await this.db.readData('configClient');
                        if (!configClient.launcher_config) configClient.launcher_config = {};
                        
                        configClient.launcher_config.download_multi = validValue;
                        await this.db.updateData('configClient', configClient);
                        
                        maxDownloadFilesInput.value = validValue; // Corriger la valeur si nécessaire
                        console.log(`Téléchargements multiples mis à jour: ${validValue}`);
                    } catch (error) {
                        console.error('Erreur lors de la sauvegarde des téléchargements multiples:', error);
                    }
                }, 300);
            };

            // Nettoyer les anciens listeners
            maxDownloadFilesInput.removeEventListener("change", this.downloadChangeHandler);
            maxDownloadFilesReset.removeEventListener("click", this.downloadResetHandler);

            this.downloadChangeHandler = (e) => {
                const value = e.target.value;
                
                // Validation en temps réel
                if (value < minFiles || value > maxFiles) {
                    e.target.style.borderColor = '#ef4444';
                    helpText.textContent = `Valeur invalide! Doit être entre ${minFiles} et ${maxFiles}.`;
                    helpText.style.color = '#ef4444';
                } else {
                    e.target.style.borderColor = '';
                    helpText.textContent = `Recommandé: ${recommendedFiles} fichiers. Plus élevé = plus rapide mais plus de charge réseau.`;
                    helpText.style.color = '#888';
                    debouncedSave(value);
                }
            };

            this.downloadResetHandler = async () => {
                try {
                    let configClient = await this.db.readData('configClient');
                    if (!configClient.launcher_config) configClient.launcher_config = {};
                    
                    maxDownloadFilesInput.value = recommendedFiles;
                    configClient.launcher_config.download_multi = recommendedFiles;
                    await this.db.updateData('configClient', configClient);
                    
                    // Réinitialiser le style
                    maxDownloadFilesInput.style.borderColor = '';
                    helpText.textContent = `Recommandé: ${recommendedFiles} fichiers. Plus élevé = plus rapide mais plus de charge réseau.`;
                    helpText.style.color = '#888';
                } catch (error) {
                    console.error('Erreur lors de la réinitialisation des téléchargements multiples:', error);
                }
            };

            maxDownloadFilesInput.addEventListener("change", this.downloadChangeHandler);
            maxDownloadFilesReset.addEventListener("click", this.downloadResetHandler);

            // Optimisation : Gestion de la fermeture du launcher
            const closeBox = document.querySelector(".close-box");
            if (closeBox) {
                this.setupCloseLauncherConfig(configClient);
            }

        } catch (error) {
            console.error('Erreur lors de la configuration du launcher:', error);
        }
    }

    async setupCloseLauncherConfig(configClient) {
        try {
            const closeBox = document.querySelector(".close-box");
            if (!closeBox) return;

            // Configuration actuelle
            const currentCloseBehavior = configClient?.launcher_config?.closeLauncher || 'close-launcher';
            
            // Mettre à jour l'interface selon la configuration
            const optionElements = closeBox.querySelectorAll('input[name="close-launcher"]');
            optionElements.forEach(element => {
                if (element.value === currentCloseBehavior) {
                    element.checked = true;
                }
            });

            // Gestionnaire de changement optimisé
            const changeHandler = async (e) => {
                try {
                    let configClient = await this.db.readData('configClient');
                    if (!configClient.launcher_config) configClient.launcher_config = {};
                    
                    configClient.launcher_config.closeLauncher = e.target.value;
                    await this.db.updateData('configClient', configClient);
                    
                    console.log(`Comportement de fermeture mis à jour: ${e.target.value}`);
                } catch (error) {
                    console.error('Erreur lors de la sauvegarde du comportement de fermeture:', error);
                }
            };

            // Nettoyer les anciens listeners et ajouter le nouveau
            optionElements.forEach(element => {
                element.removeEventListener('change', changeHandler);
                element.addEventListener('change', changeHandler);
            });

        } catch (error) {
            console.error('Erreur lors de la configuration de la fermeture du launcher:', error);
        }
    }
}

export default Settings;