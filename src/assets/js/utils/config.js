/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const pkg = require('../package.json');
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
    GetConfig() {
        return new Promise((resolve, reject) => {
            nodeFetch(config).then(async config => {
                if (config.status === 200) return resolve(config.json());
                else return reject({ error: { code: config.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            })
        })
    }

    async getInstanceList() {
        let urlInstance = `${url}/files`
        let instances = await nodeFetch(urlInstance).then(res => res.json()).catch(err => err)
        let instancesList = []
        instances = Object.entries(instances)

        for (let [name, data] of instances) {
            let instance = data
            instance.name = name
            instancesList.push(instance)
        }
        return instancesList
    }

    async getNews() {
        let cfg = await this.GetConfig() || {};

        // priorité : cfg.rss (remote config) -> defaultRss -> json fallback
        const rssUrl = cfg.rss || defaultRss;
        const jsonUrl = cfg.news || news;

        // try RSS first
        try {
            const res = await nodeFetch(rssUrl);
            if (res.status === 200) {
                const text = await res.text();
                let items = (JSON.parse(convert.xml2json(text, { compact: true })))?.rss?.channel?.item || [];
                if (!Array.isArray(items)) items = [items];

                const parsed = items.map(item => ({
                    title: item.title?._text || '',
                    content: (item['content:encoded']?._text) || (item.description?._text) || '',
                    author: item['dc:creator']?._text || null,
                    publish_date: item.pubDate?._text || ''
                }));
                // Return only the latest item (first entry) to keep API simple
                return parsed && parsed.length ? parsed[0] : null;
            }
        } catch (err) {
            // ignore and try JSON fallback
        }

        // fallback to JSON endpoint
        return new Promise((resolve, reject) => { 
            nodeFetch(jsonUrl).then(async res => {
                if (res.status === 200) {
                    const json = await res.json().catch(() => null);
                    // If endpoint returns an array, return the first (latest) element
                    if (Array.isArray(json)) return resolve(json.length ? json[0] : null);
                    // If the JSON contains an items array: try that
                    if (json && Array.isArray(json.items)) return resolve(json.items.length ? json.items[0] : null);
                    // otherwise return the object as-is
                    return resolve(json);
                }
                else return reject({ error: { code: res.statusText, message: 'server not accessible' } });
            }).catch(error => {
                return reject({ error });
            });
        });
    }
}

export default new Config;