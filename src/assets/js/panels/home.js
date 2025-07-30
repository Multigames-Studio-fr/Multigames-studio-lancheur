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
        await this.loadSidebarInstances() // Ajoute cet appel ici
        await this.updateInstanceSelect();
        await this.updateInstanceInfo();
        document.querySelector('.settings-btn').addEventListener('click', e => changePanel('settings'))

        // Ajoute l'écouteur sur le select
        document.querySelector('.instance-select').addEventListener('change', async (e) => {
            let configClient = await this.db.readData('configClient');
            configClient.instance_selct = e.target.value;
            await this.db.updateData('configClient', configClient);
            await this.loadSidebarInstances();
            await this.updateInstanceInfo();
        });
    }

    async news() {
        let newsElement = document.querySelector('.news-list');
        newsElement.innerHTML = ""; // Nettoie avant d'injecter
    
        let news = await config.getNews().then(res => res).catch(() => false);
    
        const createNewsBlock = (title, content, day, month, author = null, isError = false) => {
            const block = document.createElement('div');
            block.className = "rounded-xl bg-white/80 shadow flex flex-col gap-2 p-4 sm:p-6";
            block.innerHTML = `
                <div class="flex items-center justify-between gap-2">
                    <div class="flex items-center gap-3">
                        <img class="w-10 h-10 rounded-full border-2 border-[#F8BA59]/40 bg-white" src="assets/images/icon.png" alt="icon">
                        <div>
                            <div class="font-bold text-[#451F21] text-base sm:text-lg">${title}</div>
                            ${author ? `<div class="text-xs text-[#7c5a5c]">Auteur - <span>${author}</span></div>` : ""}
                        </div>
                    </div>
                    <div class="flex flex-col items-center px-2">
                        <div class="text-xl font-bold text-[#F8BA59] leading-none">${day}</div>
                        <div class="text-xs uppercase text-[#7c5a5c]">${month}</div>
                    </div>
                </div>
                <div class="text-[#451F21] text-sm sm:text-base mt-2 whitespace-pre-line">${content}</div>
            `;
            if(isError) block.classList.add("border", "border-red-300");
            return block;
        };
    
        if (news) {
            if (!news.length) {
                newsElement.appendChild(
                    createNewsBlock(
                        "Aucune news n'est actuellement disponible.",
                        "Vous pourrez suivre ici toutes les news relatives au serveur.",
                        "1", "Janvier"
                    )
                );
            } else {
                for (let News of news) {
                    let date = this.getdate(News.publish_date);
                    newsElement.appendChild(
                        createNewsBlock(
                            News.title,
                            News.content,
                            date.day,
                            date.month,
                            News.author
                        )
                    );
                }
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
            let configClient = await this.db.readData('configClient')
            configClient.instance_selct = newInstanceSelect.name
            instanceSelect = newInstanceSelect.name
            await this.db.updateData('configClient', configClient)
        }

        for (let instance of instancesList) {
            if (instance.whitelistActive) {
                let whitelist = instance.whitelist.find(whitelist => whitelist == auth?.name)
                if (whitelist !== auth?.name) {
                    if (instance.name == instanceSelect) {
                        let newInstanceSelect = instancesList.find(i => i.whitelistActive == false)
                        let configClient = await this.db.readData('configClient')
                        configClient.instance_selct = newInstanceSelect.name
                        instanceSelect = newInstanceSelect.name
                        setStatus(newInstanceSelect.status)
                        await this.db.updateData('configClient', configClient)
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
        let launch = new Launch()
        let configClient = await this.db.readData('configClient')
        let instance = await config.getInstanceList()
        let authenticator = await this.db.readData('accounts', configClient.account_selected)
        let options = instance.find(i => i.name == configClient.instance_selct)

        let playInstanceBTN = document.querySelector('.play-instance')
        let infoStartingBOX = document.querySelector('.info-starting-game')
        let infoStarting = document.querySelector(".info-starting-game-text")
        let progressBar = document.querySelector('.progress-bar')

        let opt = {
            url: options.url,
            authenticator: authenticator,
            timeout: 10000,
            path: `${await appdata()}/${process.platform == 'darwin' ? this.config.dataDirectory : `.${this.config.dataDirectory}`}`,
            instance: options.name,
            version: options.loadder.minecraft_version,
            detached: configClient.launcher_config.closeLauncher == "close-all" ? false : true,
            downloadFileMultiple: configClient.launcher_config.download_multi,
            intelEnabledMac: configClient.launcher_config.intelEnabledMac,

            loader: {
                type: options.loadder.loadder_type,
                build: options.loadder.loadder_version,
                enable: options.loadder.loadder_type == 'none' ? false : true
            },

            verify: options.verify,

            ignored: [...options.ignored],

            java: {
                path: configClient.java_config.java_path,
            },

            JVM_ARGS:  options.jvm_args ? options.jvm_args : [],
            GAME_ARGS: options.game_args ? options.game_args : [],

            screen: {
                width: configClient.game_config.screen_size.width,
                height: configClient.game_config.screen_size.height
            },

            memory: {
                min: `${configClient.java_config.java_memory.min * 1024}M`,
                max: `${configClient.java_config.java_memory.max * 1024}M`
            }
        }

        launch.Launch(opt);

        playInstanceBTN.style.display = "none"
        infoStartingBOX.style.display = "block"
        progressBar.style.display = "";
        ipcRenderer.send('main-window-progress-load')

        launch.on('extract', extract => {
            ipcRenderer.send('main-window-progress-load')
            console.log(extract);
        });

        launch.on('progress', (progress, size) => {
            infoStarting.innerHTML = `Téléchargement ${((progress / size) * 100).toFixed(0)}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('check', (progress, size) => {
            infoStarting.innerHTML = `Vérification ${((progress / size) * 100).toFixed(0)}%`
            ipcRenderer.send('main-window-progress', { progress, size })
            progressBar.value = progress;
            progressBar.max = size;
        });

        launch.on('estimated', (time) => {
            let hours = Math.floor(time / 3600);
            let minutes = Math.floor((time - hours * 3600) / 60);
            let seconds = Math.floor(time - hours * 3600 - minutes * 60);
            console.log(`${hours}h ${minutes}m ${seconds}s`);
        })

        launch.on('speed', (speed) => {
            console.log(`${(speed / 1067008).toFixed(2)} Mb/s`)
        })

        launch.on('patch', patch => {
            console.log(patch);
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `Patch en cours...`
        });

        launch.on('data', (e) => {
            progressBar.style.display = "none"
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-hide")
            };
            new logger('Minecraft', '#36b030');
            ipcRenderer.send('main-window-progress-load')
            infoStarting.innerHTML = `Demarrage en cours...`
            console.log(e);
        })

        launch.on('close', code => {
            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Vérification`
            new logger(pkg.name, '#7289da');
            console.log('Close');
        });

        launch.on('error', err => {
            let popupError = new popup()

            popupError.openPopup({
                title: 'Erreur',
                content: err.error,
                color: 'red',
                options: true
            })

            if (configClient.launcher_config.closeLauncher == 'close-launcher') {
                ipcRenderer.send("main-window-show")
            };
            ipcRenderer.send('main-window-progress-reset')
            infoStartingBOX.style.display = "none"
            playInstanceBTN.style.display = "flex"
            infoStarting.innerHTML = `Vérification`
            new logger(pkg.name, '#7289da');
            console.log(err);
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

            sidebar.innerHTML += `
                <li 
                    class="fade-in flex items-center justify-center w-12 h-12 rounded-xl bg-[#F8BA59]/10 hover:bg-[#F8BA59]/30 transition cursor-pointer ${key === instanceSelect ? 'ring-2 ring-[#F8BA59] bg-[#F8BA59]/30' : ''}" 
                    data-instance="${key}">
                    <img src="${icon}" class="w-8 h-8" alt="${key}" />
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

        document.querySelector('.server-title').textContent = instance.displayName || instance.name || "PALADIUM";
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