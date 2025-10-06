/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { ipcRenderer } = require('electron')
const { Status } = require('minecraft-java-core')
const fs = require('fs');
const path = require('path');

let pkg;
try {
    pkg = require(path.join(process.cwd(), 'package.json'));
    console.log('Utils.js: Package.json loaded successfully');
} catch (error) {
    console.error('Utils.js: Erreur lors du chargement de package.json:', error);
    // Valeurs par défaut
    pkg = {
        name: 'multigames-studio-launcher',
        version: '1.0.0',
        productName: 'MultiGames Studio Launcher'
    };
}

import config from './utils/config.js';
import database from './utils/database.js';
import logger from './utils/logger.js';
import popup from './utils/popup.js';
import { skin2D } from './utils/skin.js';
import slider from './utils/slider.js';

async function setBackground(theme) {
    if (typeof theme == 'undefined') {
        let databaseLauncher = new database();
        let configClient = await databaseLauncher.readData('configClient');
        theme = configClient?.launcher_config?.theme || "auto"
        theme = await ipcRenderer.invoke('is-dark-theme', theme).then(res => res)
    }
    let background
    let body = document.body;
    body.className = theme ? 'dark global' : 'light global';
    if (fs.existsSync(`${__dirname}/assets/images/background/easterEgg`) && Math.random() < 0.005) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/easterEgg`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `url(./assets/images/background/easterEgg/${Background})`;
    } else if (fs.existsSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`)) {
        let backgrounds = fs.readdirSync(`${__dirname}/assets/images/background/${theme ? 'dark' : 'light'}`);
        let Background = backgrounds[Math.floor(Math.random() * backgrounds.length)];
        background = `linear-gradient(#00000080, #00000080), url(./assets/images/background/${theme ? 'dark' : 'light'}/${Background})`;
    }
    body.style.backgroundImage = background ? background : theme ? '#000' : '#fff';
    body.style.backgroundSize = 'cover';
}

async function changePanel(id) {
    let panel = document.querySelector(`.${id}`);
    let active = document.querySelector(`.active`)
    if (active) active.classList.toggle("active");
    panel.classList.add("active");
}

async function appdata() {
    return await ipcRenderer.invoke('appData').then(path => path)
}

async function addAccount(data) {
    try {
        // Optimisation : Validation des données du compte
        if (!data || !data.name) {
            console.error('Données de compte invalides:', data);
            return null;
        }

        // Utiliser le nom correct selon le type de compte
        let accountName = data.name;
        
        // Pour les comptes Microsoft, vérifier différentes propriétés possibles
        if (data.meta && data.meta.type === 'Xbox') {
            accountName = data.name || data.profile?.name || data.username || 'Compte Microsoft';
        }
        
        // S'assurer qu'on a un nom valide
        if (!accountName || accountName === 'undefined' || accountName === undefined) {
            accountName = data.profile?.name || data.username || `Compte ${data.meta?.type || 'Inconnu'}`;
        }

        console.log('Ajout du compte:', accountName, 'Type:', data.meta?.type);

        // Skin à gauche, infos à droite, style Tailwind moderne
        let skinUrl = `https://mc-heads.net/avatar/${accountName}`;
        let div = document.createElement("div");
        div.className = "account flex items-center justify-between gap-4 p-4 bg-[#181818]/60 rounded-2xl shadow-lg glass-sidebar transition hover:scale-105 hover:shadow-2xl w-full";
        div.id = data.ID;
        div.innerHTML = `
            <div class="w-20 h-20 rounded-xl overflow-hidden border-4 border-[#F8BA59] shadow bg-[#232323] flex-shrink-0">
                <img src="${skinUrl}" alt="Skin ${accountName}" class="w-full h-full object-cover" draggable="false" onerror="this.src='./assets/images/default/setve.png'" />
            </div>
            <div class="flex flex-col flex-1 min-w-0 ml-4">
                <div class="profile-pseudo text-[#F8BA59] font-bold text-lg truncate">${accountName}</div>
                <div class="profile-type text-gray-400 text-sm">${data.meta?.type || 'Type inconnu'}</div>
                <button class="delete-profile mt-3 px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition w-max" id="${data.ID}">
                    <span class="icon-account-delete delete-profile-icon align-middle"></span> Supprimer
                </button>
            </div>
        `;
        
        const accountsList = document.querySelector('.accounts-list');
        if (accountsList) {
            return accountsList.appendChild(div);
        } else {
            console.error('Element .accounts-list non trouvé');
            return null;
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du compte:', error);
        return null;
    }
}

async function accountSelect(data) {
    let account = document.getElementById(`${data.ID}`);
    let activeAccount = document.querySelector('.account-select')

    if (activeAccount) activeAccount.classList.toggle('account-select');
    account.classList.add('account-select');
    if (data?.profile?.skins[0]?.base64) headplayer(data.profile.skins[0].base64);
}

async function headplayer(skinBase64) {
    let skin = await new skin2D().creatHeadTexture(skinBase64);
    document.querySelector(".player-head").style.backgroundImage = `url(${skin})`;
}

async function setStatus(opt) {
    let nameServerElement = document.querySelector('.server-status-name')
    let statusServerElement = document.querySelector('.server-status-text')
    let playersOnline = document.querySelector('.status-player-count .player-count')

    if (!opt) {
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = `Ferme - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
        return
    }

    let { ip, port, nameServer } = opt
    nameServerElement.innerHTML = nameServer
    let status = new Status(ip, port);
    let statusServer = await status.getStatus().then(res => res).catch(err => err);

    if (!statusServer.error) {
        statusServerElement.classList.remove('red')
        document.querySelector('.status-player-count').classList.remove('red')
        statusServerElement.innerHTML = `En ligne - ${statusServer.ms} ms`
        playersOnline.innerHTML = statusServer.playersConnect
    } else {
        statusServerElement.classList.add('red')
        statusServerElement.innerHTML = `Ferme - 0 ms`
        document.querySelector('.status-player-count').classList.add('red')
        playersOnline.innerHTML = '0'
    }
}


export {
    appdata as appdata,
    changePanel as changePanel,
    config as config,
    database as database,
    logger as logger,
    popup as popup,
    setBackground as setBackground,
    skin2D as skin2D,
    addAccount as addAccount,
    accountSelect as accountSelect,
    slider as Slider,
    pkg as pkg,
    setStatus as setStatus
}