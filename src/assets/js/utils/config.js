/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const path = require('path');

let pkg;
try {
    pkg = require(path.join(process.cwd(), 'package.json'));
    console.log('Package.json loaded successfully:', pkg.name, pkg.version);
} catch (error) {
    console.error('Erreur lors du chargement de package.json:', error);
    // Valeurs par défaut en cas d'erreur
    pkg = {
        name: 'multigames-studio-launcher',
        version: '1.0.0',
        url: 'http://lancheur-set.multigames-studio.fr:6730'
    };
}

const nodeFetch = require("node-fetch");
const convert = require('xml-js');

let url = pkg.user ? `${pkg.url}/${pkg.user}` : pkg.url;
let config = `${url}/launcher/config-launcher/config.json`;
let news = `${url}/launcher/news-launcher/news.json`;

// ajout : endpoints RSS prod/dev
const RSS_PROD = 'https://multigames-studio.fr/api/news/rss.xml';
const RSS_DEV = 'http://localhost:3000/api/news/rss.xml';
let defaultRss = (process.env.NODE_ENV === 'dev') ? RSS_DEV : RSS_PROD;

class Config {
    constructor() {
        // Optimisation : Cache pour éviter les requêtes répétées
        this.configCache = null;
        this.configCacheTime = 0;
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }

    async GetConfig() {
        try {
            console.log('Tentative de chargement de la configuration depuis:', config);
            
            // Optimisation : Utiliser le cache si encore valide
            const now = Date.now();
            if (this.configCache && (now - this.configCacheTime) < this.CACHE_DURATION) {
                console.log('Utilisation de la configuration en cache');
                return this.configCache;
            }

            const response = await nodeFetch(config, {
                timeout: 10000, // Timeout de 10 secondes
                headers: {
                    'User-Agent': `${pkg.name}/${pkg.version}`,
                    'Accept': 'application/json'
                }
            });

            if (response.status === 200) {
                const configData = await response.json();
                
                // Mise à jour du cache
                this.configCache = configData;
                this.configCacheTime = now;
                
                console.log('Configuration chargée avec succès');
                return configData;
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Erreur lors du chargement de la configuration:', error.message);
            console.error('URL tentée:', config);
            console.error('Type d\'erreur:', error.name);
            
            // Retourner le cache si disponible en cas d'erreur
            if (this.configCache) {
                console.warn('Utilisation de la configuration en cache');
                return this.configCache;
            }
            
            // Retourner une configuration par défaut en cas d'échec total
            console.warn('Utilisation de la configuration par défaut');
            const defaultConfig = {
                maintenance: false,
                game_news: [],
                java: {
                    java_8: {
                        path: "",
                        url: ""
                    },
                    java_17: {
                        path: "",
                        url: ""
                    }
                },
                launcher_news: [],
                modpacks: []
            };
            
            return defaultConfig;
        }
    }

    async getInstanceList() {
        try {
            const urlInstance = `${url}/files`;
            console.log('Tentative de chargement des instances depuis:', urlInstance);
            
            const response = await nodeFetch(urlInstance, {
                timeout: 15000,
                headers: {
                    'User-Agent': `${pkg.name}/${pkg.version}`,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const instances = await response.json();
            const instancesList = [];
            const instanceEntries = Object.entries(instances);

            for (const [name, data] of instanceEntries) {
                const instance = { ...data };
                instance.name = name;
                instancesList.push(instance);
            }

            console.log(`${instancesList.length} instances chargées avec succès`);
            return instancesList;
        } catch (error) {
            console.error('Erreur lors du chargement de la liste des instances:', error.message);
            console.error('URL tentée:', `${url}/files`);
            
            // Retourner une instance par défaut en cas d'erreur
            const defaultInstance = [{
                name: 'default',
                whitelistActive: false,
                status: 'Prêt à jouer',
                url: '',
                whitelist: []
            }];
            
            console.warn('Utilisation d\'une instance par défaut');
            return defaultInstance;
        }
    }

    async getNews() {
        try {
            const cfg = await this.GetConfig().catch(() => ({}));

            // Priorité : cfg.rss (config distant) -> defaultRss -> json fallback
            const rssUrl = cfg.rss || defaultRss;
            const jsonUrl = cfg.news || news;

            // Essayer RSS en premier
            try {
                const rssResponse = await nodeFetch(rssUrl, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': `${pkg.name}/${pkg.version}`,
                        'Accept': 'application/rss+xml, application/xml, text/xml'
                    }
                });

                if (rssResponse.ok) {
                    const text = await rssResponse.text();
                    const jsonData = JSON.parse(convert.xml2json(text, { compact: true }));
                    let items = jsonData?.rss?.channel?.item || [];
                    
                    if (!Array.isArray(items)) items = [items];

                    if (items.length > 0) {
                        const parsed = items.map(item => ({
                            title: item.title?._text || '',
                            content: (item['content:encoded']?._text) || (item.description?._text) || '',
                            author: item['dc:creator']?._text || null,
                            publish_date: item.pubDate?._text || ''
                        }));
                        
                        // Retourner le premier élément (le plus récent)
                        return parsed[0] || null;
                    }
                }
            } catch (rssError) {
                console.warn('Erreur RSS, tentative JSON:', rssError.message);
            }

            // Fallback vers l'endpoint JSON
            try {
                const jsonResponse = await nodeFetch(jsonUrl, {
                    timeout: 10000,
                    headers: {
                        'User-Agent': `${pkg.name}/${pkg.version}`,
                        'Accept': 'application/json'
                    }
                });

                if (jsonResponse.ok) {
                    const json = await jsonResponse.json();
                    
                    // Si l'endpoint retourne un tableau, retourner le premier élément
                    if (Array.isArray(json)) {
                        return json.length ? json[0] : null;
                    }
                    
                    // Si le JSON contient un tableau items
                    if (json && Array.isArray(json.items)) {
                        return json.items.length ? json.items[0] : null;
                    }
                    
                    // Sinon retourner l'objet tel quel
                    return json;
                }
            } catch (jsonError) {
                console.warn('Erreur JSON:', jsonError.message);
            }

            // Aucune source de news disponible
            return null;
            
        } catch (error) {
            console.error('Erreur lors du chargement des news:', error);
            return null;
        }
    }
}

export default new Config;