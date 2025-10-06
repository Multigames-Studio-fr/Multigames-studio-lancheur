/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */
import { config, database, logger, changePanel, appdata, setStatus, pkg, popup } from '../utils.js'

const { Launch } = require('minecraft-java-core')
const { shell, ipcRenderer } = require('electron')

class Home {
    static id = "home";
    async init(config) {
        this.config = config;
        this.db = new database();
        this.news()
        this.socialLick()
        this.instancesSelect()
        await this.loadSidebarInstances()
        await this.updateInstanceSelect();
        await this.updateInstanceInfo();
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'))

        // Ajoute ceci :
        document.querySelector('.play-btn').addEventListener('click', e => {
            e.stopPropagation(); // évite la propagation si besoin
            this.startGame();
        });
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        newsElement.innerHTML = "";

        let news = await config.getNews().then(res => res).catch(() => false);

        const createNewsBlock = (title, content, day, month, author = null, isError = false) => {
            const block = document.createElement('div');
            block.className = "rounded-xl bg-black/60 shadow flex flex-col gap-2 p-4 sm:p-6";
            block.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                        <img class="w-10 h-10 rounded-full  border-[#F8BA59]/40" src="assets/images/icon.png" alt="icon">
                        <div>
                            <div class="font-bold text-[#ffffff] text-base sm:text-lg">${title}</div>
                            ${author ? `<div class="text-xs text-[#7c5a5c]">Auteur - <span>${author}</span></div>` : ""}
                        </div>
                    </div>
                    <div class="flex flex-col items-center px-2">
                        <div class="text-xl font-bold text-[#F8BA59] leading-none">${day}</div>
                        <div class="text-xs uppercase text-[#b0b0b0]">${month}</div>
                    </div>
                </div>
                <div class="text-[#e3dede] text-sm sm:text-base mt-2 whitespace-pre-line">${content}</div>
            `;
            if(isError) block.classList.add("border", "border-red-300");
            return block;
        };

        if (news) {
            // news est un objet ou null
            if (!news.title) {
                newsElement.appendChild(
                    createNewsBlock(
                        "Aucune news n'est actuellement disponible.",
                        "Vous pourrez suivre ici toutes les news relatives au serveur.",
                        "1", "Janvier"
                    )
                );
            } else {
                let date = this.getdate(news.publish_date);
                newsElement.appendChild(
                    createNewsBlock(
                        news.title,
                        news.content,
                        date.day,
                        date.month,
                        news.author
                    )
                );
            }
        } else {
            newsElement.appendChild(
                createNewsBlock(
                    "Erreur",
                    "Impossible de contacter le serveur des news.\nMerci de vérifier votre configuration.",
                    "1", "Janvier",
                    null,
                    true
                )
            );
        }
    }

    socialLick() {
        let socials = document.querySelectorAll('.social-block')

        socials.forEach(social => {
            social.addEventListener('click', e => {
                shell.openExternal(e.target.dataset.url)
            })
        });
    }

    async instancesSelect() {
        let configClient = await this.db.readData('configClient')
        let auth = await this.db.readData('accounts', configClient.account_selected)
        let instancesList = await config.getInstanceList()
        let instanceSelect = configClient?.instance_selct

        let instanceBTN = document.querySelector('.play-instance')
        let instancePopup = document.querySelector('.instance-popup')
        let instancesListPopup = document.querySelector('.instances-List')
        let instanceCloseBTN = document.querySelector('.close-popup')

        if (instancesList.length === 1) {
            document.querySelector('.instance-select').style.display = 'none'
            instanceBTN.style.paddingRight = '0'
        }

        if (!instanceSelect) {
            let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
            if (newInstanceSelect) {
                let configClient = await this.db.readData('configClient')
                configClient.instance_selct = newInstanceSelect.name
                instanceSelect = newInstanceSelect.name
                await this.db.updateData('configClient', configClient)
            } else {
                // Aucune instance disponible, utiliser la première de la liste
                if (instancesList.length > 0) {
                    let configClient = await this.db.readData('configClient')
                    configClient.instance_selct = instancesList[0].name
                    instanceSelect = instancesList[0].name
                    await this.db.updateData('configClient', configClient)
                } else {
                    console.warn('Aucune instance disponible')
                    return
                }
            }
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name)
                if (whitelist !== auth?.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        if (newInstanceSelect) {
                            let configClient = await this.db.readData('configClient')
                            configClient.instance_selct = newInstanceSelect.name
                            instanceSelect = newInstanceSelect.name
                            setStatus(newInstanceSelect.status)
                            await this.db.updateData('configClient', configClient)
                        } else {
                            console.warn('Aucune instance publique disponible')
                        }
                    }
                }
            } else console.log(`Initializing instance ${instance.name}...`)
            if (instance.name == instanceSelect) setStatus(instance.status)
        }

        instancePopup.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')

            if (e.target.classList.contains('instance-elements')) {
                let newInstanceSelect = e.target.id
                let activeInstanceSelect = document.querySelector('.active-instance')

                if (activeInstanceSelect) activeInstanceSelect.classList.toggle('active-instance');
                e.target.classList.add('active-instance');

                configClient.instance_selct = newInstanceSelect
                await this.db.updateData('configClient', configClient)
                instanceSelect = instancesList.filter(i => i.name == newInstanceSelect)
                instancePopup.style.display = 'none'
                let instance = await config.getInstanceList()
                let options = instance.find(i => i.name == configClient.instance_selct)
                await setStatus(options.status)
            }
        })

        instanceBTN.addEventListener('click', async e => {
            let configClient = await this.db.readData('configClient')
            let instanceSelect = configClient.instance_selct
            let auth = await this.db.readData('accounts', configClient.account_selected)

            if (e.target.classList.contains('instance-select')) {
                instancesListPopup.innerHTML = ''
                for (let instance of instancesList) {
                    if (instance.whitelistActive) {
                        instance.whitelist.map(whitelist => {
                            if (whitelist == auth?.name) {
                                if (instance.name == instanceSelect) {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                                } else {
                                    instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                                }
                            }
                        })
                    } else {
                        if (instance.name == instanceSelect) {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements active-instance">${instance.name}</div>`
                        } else {
                            instancesListPopup.innerHTML += `<div id="${instance.name}" class="instance-elements">${instance.name}</div>`
                        }
                    }
                }

                instancePopup.style.display = 'flex'
            }

            if (!e.target.classList.contains('instance-select')) this.startGame()
        })

        instanceCloseBTN.addEventListener('click', () => instancePopup.style.display = 'none')
    }

    async startGame() {
        let launch = new Launch();
        let configClient = await this.db.readData('configClient')
        let instancesList = await config.getInstanceList()
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        
        // Vérification de l'authentification
        if (!authenticator) {
            console.error('Aucun utilisateur connecté');
            
            // Si en mode offline, proposer de créer un compte offline
            if (this.config && this.config.online === false) {
                const offlineUsername = prompt("Entrez votre nom d'utilisateur offline (3-16 caractères):");
                if (offlineUsername && offlineUsername.length >= 3 && offlineUsername.length <= 16 && !offlineUsername.includes(' ')) {
                    // Créer un compte offline temporaire
                    const { Mojang } = require('minecraft-java-core');
                    const offlineAccount = await Mojang.login(offlineUsername);
                    if (!offlineAccount.error) {
                        authenticator = offlineAccount;
                        console.log('Compte offline créé:', offlineUsername);
                    } else {
                        alert("Erreur lors de la création du compte offline.");
                        return;
                    }
                } else {
                    alert("Nom d'utilisateur invalide. Il doit faire entre 3 et 16 caractères sans espaces.");
                    return;
                }
            } else {
                alert("Vous devez vous connecter avant de pouvoir jouer !");
                changePanel('login');
                return;
            }
        }
        
        // Trouver l'instance sélectionnée dans la liste
        let options = instancesList.find(instance => instance.name === configClient.instance_selct) || instancesList[0]
        if (!options) {
            console.error('Aucune instance disponible');
            alert("Aucune instance de jeu disponible !");
            return;
        }

        console.log('Démarrage du jeu avec:', {
            instance: options.name,
            user: authenticator.name || authenticator.username,
            version: options.loadder?.minecraft_version
        });

        // Sélectionne les bons éléments
        let playInstanceBTN = document.querySelector('.play-instance');
        let infoStartingBOX = document.querySelector('.info-starting-game');
        let infoStarting = document.querySelector(".info-starting-game-text");
        const bar = document.querySelector('.progress-bar-inner');
        const valueEl = document.querySelector('.progress-value');
        const labelEl = document.querySelector('.progress-label');

        // Affiche la barre, cache le bouton
        playInstanceBTN.style.display = "none";
        infoStartingBOX.style.display = "block";

        function updateProgress(pct, label) {
            bar.style.width = pct + '%';
            valueEl.textContent = pct.toFixed(0) + '%';
            if (label) labelEl.textContent = label;
        }

        let opt = {
            url: options.url || '',
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder?.minecraft_version || '1.20.1',
            detached: configClient.launcher_config?.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config?.download_multi || 5,
            intelEnabledMac: configClient.launcher_config?.intelEnabledMac || false,

            loader: {
                type: options.loadder?.loadder_type || 'none',
                build: options.loadder?.loadder_version || 'latest',
                enable: (options.loadder?.loadder_type && options.loadder.loadder_type !== 'none') ? true : false
            },

            verify: options.verify !== undefined ? options.verify : true,

            ignored: options.ignored ? [...options.ignored] : [],

            java: {
                path: configClient.java_config?.java_path || '',
            },

            JVM_ARGS: options.jvm_args ? options.jvm_args : [],
            GAME_ARGS: options.game_args ? options.game_args : [],

            screen: {
                width: configClient.game_config?.screen_size?.width || 1280,
                height: configClient.game_config?.screen_size?.height || 720
            },

            memory: {
                min: `${(configClient.java_config?.java_memory?.min || 2) * 1024}M`,
                max: `${(configClient.java_config?.java_memory?.max || 4) * 1024}M`
            }
        }

        try {
            launch.Launch(opt);
        } catch (error) {
            console.error('Erreur lors du lancement:', error);
            infoStartingBOX.style.display = "none";
            playInstanceBTN.style.display = "flex";
            updateProgress(0, 'En attente...');
            
            if (error.message && error.message.includes('Authenticator not found')) {
                alert("Erreur d'authentification. Veuillez vous reconnecter.");
                changePanel('login');
            } else {
                alert("Erreur lors du lancement du jeu: " + error.message);
            }
            return;
        }

        launch.on('extract', extract => {
            updateProgress(10, 'Extraction...');
        });

        launch.on('progress', (progress, size) => {
            const pct = (progress / size) * 100;
            updateProgress(pct, 'Téléchargement...');
        });

        launch.on('check', (progress, size) => {
            const pct = (progress / size) * 100;
            updateProgress(pct, 'Vérification...');
        });

        launch.on('finish', () => {
            updateProgress(100, 'Terminé !');
            setTimeout(() => updateProgress(0, 'En attente...'), 1200);
        });

        launch.on('data', (e) => {
            infoStarting.innerHTML = `Démarrage en cours...`;
        });

        launch.on('close', code => {
            infoStartingBOX.style.display = "none";
            playInstanceBTN.style.display = "flex";
            updateProgress(0, 'En attente...');
        });

        launch.on('error', err => {
            console.error('Erreur de lancement:', err);
            infoStartingBOX.style.display = "none";
            playInstanceBTN.style.display = "flex";
            updateProgress(0, 'En attente...');
            
            if (err.error && err.error === 'Authenticator not found') {
                alert("Erreur d'authentification. Veuillez vous reconnecter.");
                changePanel('login');
            } else {
                alert("Erreur lors du lancement: " + (err.message || err.error || 'Erreur inconnue'));
            }
        });
    }

    async loadSidebarInstances() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);
        let instancesObj = await config.getInstanceList(); // objet {mgs: {...}, "mgs-no-mods": {...}}
        let instanceSelect = configClient?.instance_selct;

        // Mapping clé d'instance => icône
        const iconMap = {
            "mgs": "assets/images/mgs_icon.png",
            "mgs-no-mods": "assets/images/mgs_no_mods_icon.png",
            // Ajoute ici d'autres associations si besoin
        };

        const sidebar = document.getElementById('sidebar-instances');
        sidebar.innerHTML = '';

        for (let key in instancesObj) {
            let instance = instancesObj[key];
            // Vérifie la whitelist si besoin
            if (instance.whitelistActive && !instance.whitelist.includes(auth?.name)) continue;

            // Utilise l'icône personnalisée si présente dans le JSON, sinon fallback
            let icon = instance.icon || iconMap[key] || 'assets/images/paladium_icon.png';

const selectedClass = key === instanceSelect ? ' ' : '';
sidebar.innerHTML += `
    <li 
        class="fade-in flex items-center justify-center w-12 h-12 rounded-xl transition cursor-pointer${selectedClass}" 
        data-instance="${key}">
        <img src="${icon}" class="w-10 " alt="${key}" />
    </li>
`;
        }

        // Ajoute une animation d'apparition progressive sur chaque instance
        sidebar.querySelectorAll('li.fade-in').forEach((li, i) => {
            setTimeout(() => {
                li.classList.remove('fade-in');
            }, 120 + i * 60);
        });

        // Ajoute l'événement de sélection
        sidebar.querySelectorAll('li').forEach(li => {
            li.addEventListener('click', async () => {
                let key = li.dataset.instance;
                configClient.instance_selct = key;
                await this.db.updateData('configClient', configClient);
                // Ne recharge plus la sidebar ici !
                await this.updateInstanceSelect(); // refresh select
                await this.updateInstanceInfo();   // refresh infos dynamiques
                // Mets à jour le statut serveur si besoin
                let instances = await config.getInstanceList();
                let selected = instances[key];
                setStatus(selected.status);

                // Mets à jour l'état visuel du bouton sélectionné
                sidebar.querySelectorAll('li').forEach(li2 => li2.classList.remove('ring-2', 'bg-[#F8BA59]/30'));
                li.classList.add('ring-2', 'bg-[#F8BA59]/30');
            });
        });
    }

    async updateInstanceSelect() {
        let configClient = await this.db.readData('configClient');
        let auth = await this.db.readData('accounts', configClient.account_selected);
        let instancesObj = await config.getInstanceList();
        let select = document.querySelector('.instance-select');
        select.innerHTML = '';

        // Génère les options selon whitelist
        for (let key in instancesObj) {
            let instance = instancesObj[key];
            if (instance.whitelistActive && !instance.whitelist.includes(auth?.name)) continue;
            let option = document.createElement('option');
            option.value = key;
            option.textContent = instance.displayName || instance.name;
            if (key === configClient.instance_selct) option.selected = true;
            select.appendChild(option);
        }

        // Affiche ou masque le select selon le nombre d'instances accessibles
        select.parentElement.style.display = select.options.length > 1 ? '' : 'none';
    }

    // Met à jour toutes les infos dynamiques
    async updateInstanceInfo() {
        let configClient = await this.db.readData('configClient');
        let instancesObj = await config.getInstanceList();
        let selectedKey = configClient?.instance_selct;
        let instance = instancesObj[selectedKey];
        if (!instance) return;

       
    if (!instance) {
        document.querySelector('.server-title').textContent = "Veuillez sélectionner une instance";
        document.querySelector('.server-desc').innerHTML = "";
        document.querySelector('.server-version').textContent = "";
        document.querySelector('.server-loader').textContent = "";
        document.querySelector('.server-status-name').textContent = "";
        document.querySelector('.server-status-text').innerHTML = "";
        return;
    }

    document.querySelector('.server-title').textContent = instance.displayName || instance.name || "Multigames-Studio";
    document.querySelector('.server-desc').innerHTML = instance.description || "Aucune description.";
    document.querySelector('.server-version').textContent = instance.loadder?.minecraft_version || "1.21.4";
    document.querySelector('.server-loader').textContent = instance.loadder?.loadder_type || "Forge";
    document.querySelector('.server-status-name').textContent = instance.status?.name || "Multigames-Studio.fr";
    document.querySelector('.server-status-text').innerHTML =
        `${instance.status?.text || "Opérationnel"} • <span class="font-bold text-[#F8BA59] player-count">${instance.status?.players || 0}</span> joueurs`;
    }

    getdate(e) {
        let date = new Date(e)
        let year = date.getFullYear()
        let month = date.getMonth() + 1
        let day = date.getDate()
        let allMonth = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
        return { year: year, month: allMonth[month - 1], day: day }
    }
}
export default Home;