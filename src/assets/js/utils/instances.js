const all = getAllInstances(); // ['mgs', 'mgs-no-mods']
const mgsConfig = getInstanceConfig('mgs');

const INSTANCES = {
    "mgs": {
        name: "mgs",
        url: "http://lancheur-set.multigames-studio.fr/files?instance=mgs",
        loadder: {
            minecraft_version: "1.21.4",
            loadder_type: "forge",
            loadder_version: "latest"
        },
        verify: true,
        ignored: [
            "config",
            "logs",
            "resourcepacks",
            "saves",
            "screenshots",
            "shaderpacks",
            "options.txt",
            "optionsof.txt"
        ],
        whitelist: [],
        whitelistActive: false,
        status: {
            nameServer: "Multigames-Studio.fr",
            ip: "play.multigames-studio.fr",
            port: 25565
        }
    },
    "mgs-no-mods": {
        name: "mgs",
        url: "http://lancheur-set.multigames-studio.fr/files?instance=mgs",
        loadder: {
            minecraft_version: "1.21.4",
            loadder_type: "",
            loadder_version: ""
        },
        verify: true,
        ignored: [
            "config",
            "logs",
            "resourcepacks",
            "saves",
            "screenshots",
            "shaderpacks",
            "options.txt",
            "optionsof.txt"
        ],
        whitelist: [],
        whitelistActive: false,
        status: {
            nameServer: "Multigames-Studio.fr",
            ip: "play.multigames-studio.fr",
            port: 25565
        }
    }
};

export function getInstanceConfig(instanceName) {
    return INSTANCES[instanceName] || null;
}

export function getAllInstances() {
    return Object.keys(INSTANCES);
}