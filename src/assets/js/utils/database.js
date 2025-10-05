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
            const dbPath = dev ? `${userDataPath}/../..` : `${userDataPath}/databases`;
            
            const table = await nodedatabase.intilize({
                databaseName: 'Databases',
                fileType: dev ? 'sqlite' : 'db',
                tableName: tableName,
                path: dbPath,
                tableColumns: tableConfig,
            });

            // Mettre en cache
            this.tableCache.set(cacheKey, table);
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
}

export default database;