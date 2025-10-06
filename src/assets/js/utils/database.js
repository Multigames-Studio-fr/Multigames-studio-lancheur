/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { NodeBDD, DataType } = require('node-bdd');
const nodedatabase = new NodeBDD()
const { ipcRenderer } = require('electron')

let dev = process.env.NODE_ENV === 'dev';

class database {
    constructor() {
        // Optimisation : Cache des tables pour éviter les recreations répétées
        this.tableCache = new Map();
    }

    async creatDatabase(tableName, tableConfig) {
        try {
            // Optimisation : Utiliser le cache pour éviter les créations répétées
            const cacheKey = `${tableName}_${JSON.stringify(tableConfig)}`;
            if (this.tableCache.has(cacheKey)) {
                return this.tableCache.get(cacheKey);
            }

            const userDataPath = await ipcRenderer.invoke('path-user-data');
            const os = require('os');
            const path = require('path');
            
            // Optimisation : Stockage dans le dossier spécifique .multigameslauncher
            let dbPath;
            if (dev) {
                // Mode développement : dans le dossier data local
                dbPath = `${userDataPath}/../..`;
            } else {
                // Mode production : dans AppData\Roaming\.multigameslauncher
                dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '.multigameslauncher');
                
                // S'assurer que le dossier existe
                const fs = require('fs');
                if (!fs.existsSync(dbPath)) {
                    fs.mkdirSync(dbPath, { recursive: true });
                }
            }
            
            const table = await nodedatabase.intilize({
                databaseName: 'MultiGamesLauncher', // Nom plus spécifique pour la production
                fileType: dev ? 'sqlite' : 'db',
                tableName: tableName,
                path: dbPath,
                tableColumns: tableConfig,
            });

            // Mettre en cache
            this.tableCache.set(cacheKey, table);
            
            console.log(`📂 Base de données ${tableName} initialisée:`, dbPath);
            return table;
            
        } catch (error) {
            console.error(`Erreur lors de la création de la base de données ${tableName}:`, error);
            throw error;
        }
    }

    async getDatabase(tableName) {
        return await this.creatDatabase(tableName, {
            json_data: DataType.TEXT.TEXT,
        });
    }

    async createData(tableName, data) {
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('Les données doivent être un objet valide');
            }

            const table = await this.getDatabase(tableName);
            const createdData = await nodedatabase.createData(table, { 
                json_data: JSON.stringify(data) 
            });
            
            const id = createdData.id;
            const parsedData = JSON.parse(createdData.json_data);
            parsedData.ID = id;
            
            return parsedData;
        } catch (error) {
            console.error(`Erreur lors de la création des données dans ${tableName}:`, error);
            throw error;
        }
    }

    async readData(tableName, key = 1) {
        try {
            const table = await this.getDatabase(tableName);
            const data = await nodedatabase.getDataById(table, key);
            
            if (data) {
                const id = data.id;
                const parsedData = JSON.parse(data.json_data);
                parsedData.ID = id;
                return parsedData;
            }
            
            return undefined;
        } catch (error) {
            console.error(`Erreur lors de la lecture des données de ${tableName}:`, error);
            return undefined;
        }
    }

    async readAllData(tableName) {
        try {
            const table = await this.getDatabase(tableName);
            const data = await nodedatabase.getAllData(table);
            
            return data.map(info => {
                const id = info.id;
                const parsedInfo = JSON.parse(info.json_data);
                parsedInfo.ID = id;
                return parsedInfo;
            });
        } catch (error) {
            console.error(`Erreur lors de la lecture de toutes les données de ${tableName}:`, error);
            return [];
        }
    }

    async updateData(tableName, data, key = 1) {
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('Les données doivent être un objet valide');
            }

            const table = await this.getDatabase(tableName);
            await nodedatabase.updateData(table, { 
                json_data: JSON.stringify(data) 
            }, key);
        } catch (error) {
            console.error(`Erreur lors de la mise à jour des données de ${tableName}:`, error);
            throw error;
        }
    }

    async deleteData(tableName, key = 1) {
        try {
            const table = await this.getDatabase(tableName);
            await nodedatabase.deleteData(table, key);
        } catch (error) {
            console.error(`Erreur lors de la suppression des données de ${tableName}:`, error);
            throw error;
        }
    }

    // Optimisation : Méthode pour nettoyer le cache
    clearCache() {
        this.tableCache.clear();
    }

    // Méthode pour vider complètement la base de données
    async clearAllData() {
        try {
            console.log('🗑️ Vidage de la base de données en cours...');
            
            // Supprimer tous les comptes
            const accounts = await this.readAllData('accounts');
            for (const account of accounts) {
                await this.deleteData('accounts', account.ID);
            }
            
            // Réinitialiser la configuration client
            const defaultConfig = {
                account_selected: null,
                instance_select: null,
                java_config: {
                    java_path: null,
                    java_memory: {
                        min: 2,
                        max: 8
                    }
                },
                game_config: {
                    screen_size: {
                        width: 1280,
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
            
            await this.updateData('configClient', defaultConfig);
            
            // Nettoyer le cache
            this.clearCache();
            
            console.log('✅ Base de données vidée avec succès');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur lors du vidage de la base de données:', error);
            return false;
        }
    }

    // Méthode pour supprimer tous les comptes uniquement
    async clearAccounts() {
        try {
            console.log('🗑️ Suppression de tous les comptes...');
            
            const accounts = await this.readAllData('accounts');
            for (const account of accounts) {
                await this.deleteData('accounts', account.ID);
            }
            
            // Réinitialiser la sélection de compte
            const configClient = await this.readData('configClient');
            if (configClient) {
                configClient.account_selected = null;
                await this.updateData('configClient', configClient);
            }
            
            console.log('✅ Tous les comptes ont été supprimés');
            return true;
            
        } catch (error) {
            console.error('❌ Erreur lors de la suppression des comptes:', error);
            return false;
        }
    }
}

export default database;