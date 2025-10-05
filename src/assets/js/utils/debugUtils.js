/**
 * Utilitaires de debug et de diagnostic pour le développement
 * Fournit des outils pour surveiller et déboguer l'application
 */

const { ipcRenderer } = require('electron');

class DebugUtils {
    constructor() {
        this.debugMode = process.env.NODE_ENV === 'dev';
        this.timers = new Map();
        
        if (this.debugMode) {
            this.initializeDebugConsole();
        }
    }

    /**
     * Initialise la console de debug avec des commandes utiles
     */
    initializeDebugConsole() {
        // Ajouter des méthodes globales pour le debug
        window.launcher_debug = {
            // Test de performance
            perfTest: () => {
                console.log('🔍 Test de performance démarré...');
                const performance = require('./performance');
                const metrics = performance.getMetrics();
                console.table(metrics);
            },

            // Test des comptes
            accountTest: () => {
                console.log('👤 Test des comptes...');
                const database = require('./database');
                database.getAccounts().then(accounts => {
                    console.log(`📊 ${accounts.length} comptes trouvés:`);
                    accounts.forEach((account, index) => {
                        console.log(`${index + 1}. ${account.name} (${account.type})`);
                    });
                }).catch(err => {
                    console.error('❌ Erreur lors du test des comptes:', err);
                });
            },

            // Diagnostic complet
            fullDiagnostic: () => {
                console.log('🔬 Diagnostic complet en cours...');
                this.runFullDiagnostic();
            },

            // Test du système de rapport d'erreurs
            testErrorReport: () => {
                console.log('🚨 Test du système de rapport d\'erreurs...');
                const errorReporter = require('./errorReporter');
                errorReporter.testConnection();
            },

            // Test de la migration de base de données
            testDatabaseMigration: () => {
                console.log('🔄 Test de la migration de base de données...');
                const { dbMigration } = require('./databaseMigration');
                const verification = dbMigration.verifyMigration();
                console.log('📊 Résultat de vérification:', verification);
                
                const needsMigration = dbMigration.needsMigration();
                console.log('📋 État de migration:', needsMigration);
            },

            // Vérifier l'emplacement de la base de données
            checkDatabaseLocation: () => {
                console.log('📂 Vérification de l\'emplacement de la base de données...');
                const os = require('os');
                const path = require('path');
                const fs = require('fs');
                
                const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', '.multigameslauncher');
                console.log(`📍 Dossier de base de données : ${dbPath}`);
                console.log(`✅ Existe : ${fs.existsSync(dbPath)}`);
                
                if (fs.existsSync(dbPath)) {
                    const files = fs.readdirSync(dbPath);
                    console.log(`📁 Fichiers trouvés (${files.length}) :`, files);
                }
            },

            // Afficher les métriques en temps réel
            liveMetrics: () => {
                console.log('📊 Métriques en temps réel activées');
                this.startLiveMetrics();
            },

            // Clear des données de debug
            clearCache: () => {
                console.log('🧹 Nettoyage du cache...');
                this.clearDebugData();
            }
        };

        console.log('🔧 Mode debug activé - Utilisez window.launcher_debug pour les outils');
        console.log('📋 Commandes disponibles:', Object.keys(window.launcher_debug));
    }

    /**
     * Lance un diagnostic complet du système
     */
    async runFullDiagnostic() {
        const diagnostics = {
            timestamp: new Date().toISOString(),
            system: this.getSystemInfo(),
            memory: this.getMemoryInfo(),
            performance: await this.getPerformanceMetrics(),
            accounts: await this.getAccountsStatus(),
            errors: this.getRecentErrors()
        };

        console.log('📋 Diagnostic complet:');
        console.log(JSON.stringify(diagnostics, null, 2));
        
        return diagnostics;
    }

    /**
     * Obtient les informations système
     */
    getSystemInfo() {
        const os = require('os');
        return {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            electronVersion: process.versions.electron,
            chromeVersion: process.versions.chrome,
            memory: {
                total: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100 + ' GB',
                free: Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100 + ' GB'
            }
        };
    }

    /**
     * Obtient les informations mémoire du processus
     */
    getMemoryInfo() {
        const usage = process.memoryUsage();
        return {
            rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100 + ' MB',
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100 + ' MB',
            external: Math.round(usage.external / 1024 / 1024 * 100) / 100 + ' MB'
        };
    }

    /**
     * Obtient les métriques de performance
     */
    async getPerformanceMetrics() {
        try {
            const performance = require('./performance');
            return performance.getMetrics();
        } catch (error) {
            return { error: 'Module de performance non disponible' };
        }
    }

    /**
     * Obtient le statut des comptes
     */
    async getAccountsStatus() {
        try {
            const database = require('./database');
            const accounts = await database.getAccounts();
            
            return {
                total: accounts.length,
                types: accounts.reduce((acc, account) => {
                    acc[account.type] = (acc[account.type] || 0) + 1;
                    return acc;
                }, {}),
                valid: accounts.filter(account => account.name && account.name !== 'undefined').length,
                invalid: accounts.filter(account => !account.name || account.name === 'undefined').length
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Obtient les erreurs récentes
     */
    getRecentErrors() {
        try {
            const errorHandler = require('./errorHandler');
            return errorHandler.getRecentErrors();
        } catch (error) {
            return { error: 'Module de gestion d\'erreurs non disponible' };
        }
    }

    /**
     * Démarre l'affichage des métriques en temps réel
     */
    startLiveMetrics() {
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
        }

        this.metricsInterval = setInterval(() => {
            const memory = this.getMemoryInfo();
            console.log(`⚡ Mémoire: ${memory.heapUsed} | RSS: ${memory.rss}`);
        }, 5000);

        console.log('📊 Métriques en temps réel démarrées (toutes les 5s)');
        console.log('🛑 Utilisez clearInterval(id) pour arrêter');
        
        return this.metricsInterval;
    }

    /**
     * Nettoie les données de debug
     */
    clearDebugData() {
        // Clear des timers
        this.timers.clear();
        
        // Clear de l'interval des métriques
        if (this.metricsInterval) {
            clearInterval(this.metricsInterval);
            this.metricsInterval = null;
        }

        // Clear du cache du navigateur
        if (window.caches) {
            caches.keys().then(names => {
                names.forEach(name => {
                    caches.delete(name);
                });
            });
        }

        console.log('✅ Cache nettoyé');
    }

    /**
     * Timer pour mesurer les performances
     */
    startTimer(label) {
        this.timers.set(label, performance.now());
        if (this.debugMode) {
            console.time(label);
        }
    }

    /**
     * Arrête un timer et affiche le résultat
     */
    endTimer(label) {
        if (this.timers.has(label)) {
            const duration = performance.now() - this.timers.get(label);
            this.timers.delete(label);
            
            if (this.debugMode) {
                console.timeEnd(label);
                console.log(`⏱️ ${label}: ${Math.round(duration * 100) / 100}ms`);
            }
            
            return duration;
        }
        return null;
    }

    /**
     * Log conditionnel (seulement en mode debug)
     */
    log(...args) {
        if (this.debugMode) {
            console.log('🔧', ...args);
        }
    }

    /**
     * Warn conditionnel (seulement en mode debug)
     */
    warn(...args) {
        if (this.debugMode) {
            console.warn('⚠️', ...args);
        }
    }

    /**
     * Error toujours affiché mais avec préfixe debug
     */
    error(...args) {
        console.error('🔥', ...args);
    }
}

// Export de l'instance singleton
const debugUtils = new DebugUtils();
module.exports = debugUtils;