/**
 * Utilitaire de migration de base de données
 * Migre les données de l'ancien emplacement vers le nouveau dossier .multigameslauncher
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

class DatabaseMigration {
    constructor() {
        this.oldPaths = [
            // Anciens emplacements possibles
            path.join(os.homedir(), 'AppData', 'Roaming', 'Multigames-studio-lancheur'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'multigames-studio-launcher'),
        ];
        this.newPath = path.join(os.homedir(), 'AppData', 'Roaming', '.multigameslauncher');
    }

    /**
     * Vérifie s'il y a des données à migrer
     */
    needsMigration() {
        for (const oldPath of this.oldPaths) {
            if (fs.existsSync(oldPath)) {
                const files = fs.readdirSync(oldPath);
                const dbFiles = files.filter(file => 
                    file.endsWith('.db') || 
                    file.endsWith('.sqlite') ||
                    file.includes('MultiGamesLauncher')
                );
                if (dbFiles.length > 0) {
                    return { needed: true, path: oldPath, files: dbFiles };
                }
            }
        }
        return { needed: false };
    }

    /**
     * Effectue la migration des données
     */
    async migrate() {
        const migrationInfo = this.needsMigration();
        
        if (!migrationInfo.needed) {
            console.log('🔄 Aucune migration de base de données nécessaire');
            return { success: true, migrated: false };
        }

        try {
            // Créer le nouveau dossier s'il n'existe pas
            if (!fs.existsSync(this.newPath)) {
                fs.mkdirSync(this.newPath, { recursive: true });
                console.log(`📁 Dossier créé : ${this.newPath}`);
            }

            // Copier les fichiers
            let migratedFiles = 0;
            for (const file of migrationInfo.files) {
                const oldFilePath = path.join(migrationInfo.path, file);
                const newFilePath = path.join(this.newPath, file);
                
                if (!fs.existsSync(newFilePath)) {
                    fs.copyFileSync(oldFilePath, newFilePath);
                    console.log(`📦 Migré : ${file}`);
                    migratedFiles++;
                }
            }

            // Optionnel : Créer un fichier de marqueur pour indiquer que la migration a été effectuée
            const migrationMarker = path.join(this.newPath, '.migration_completed');
            fs.writeFileSync(migrationMarker, JSON.stringify({
                date: new Date().toISOString(),
                fromPath: migrationInfo.path,
                migratedFiles: migratedFiles
            }));

            console.log(`✅ Migration terminée : ${migratedFiles} fichiers migrés`);
            console.log(`📂 Nouveau dossier : ${this.newPath}`);
            
            return { 
                success: true, 
                migrated: true, 
                filesCount: migratedFiles,
                newPath: this.newPath
            };

        } catch (error) {
            console.error('❌ Erreur lors de la migration :', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Nettoie les anciens fichiers après confirmation
     */
    async cleanupOldFiles() {
        const migrationInfo = this.needsMigration();
        
        if (!migrationInfo.needed) {
            return { success: true, cleaned: false };
        }

        try {
            // Vérifier que la migration a bien été effectuée
            const migrationMarker = path.join(this.newPath, '.migration_completed');
            if (!fs.existsSync(migrationMarker)) {
                console.log('⚠️ Migration non confirmée, nettoyage annulé');
                return { success: false, reason: 'Migration not confirmed' };
            }

            // Supprimer les anciens fichiers de base de données
            for (const file of migrationInfo.files) {
                const oldFilePath = path.join(migrationInfo.path, file);
                if (fs.existsSync(oldFilePath)) {
                    fs.unlinkSync(oldFilePath);
                    console.log(`🗑️ Supprimé : ${oldFilePath}`);
                }
            }

            console.log('🧹 Nettoyage terminé');
            return { success: true, cleaned: true };

        } catch (error) {
            console.error('❌ Erreur lors du nettoyage :', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Vérifie l'intégrité des données migrées
     */
    verifyMigration() {
        try {
            const migrationMarker = path.join(this.newPath, '.migration_completed');
            if (!fs.existsSync(migrationMarker)) {
                return { success: false, reason: 'No migration marker found' };
            }

            const migrationData = JSON.parse(fs.readFileSync(migrationMarker, 'utf8'));
            const files = fs.readdirSync(this.newPath);
            const dbFiles = files.filter(file => 
                file.endsWith('.db') || 
                file.endsWith('.sqlite') ||
                file.includes('MultiGamesLauncher')
            );

            return {
                success: true,
                migrationDate: migrationData.date,
                expectedFiles: migrationData.migratedFiles,
                actualFiles: dbFiles.length,
                isValid: dbFiles.length >= migrationData.migratedFiles
            };

        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

// Export de la classe et fonction d'aide
const dbMigration = new DatabaseMigration();

// Fonction d'initialisation automatique
async function initializeDatabaseMigration() {
    console.log('🔄 Vérification de la migration de base de données...');
    
    const result = await dbMigration.migrate();
    if (result.success && result.migrated) {
        console.log('✅ Migration de base de données terminée avec succès');
        
        // Optionnel : vérification de l'intégrité
        const verification = dbMigration.verifyMigration();
        if (verification.success && verification.isValid) {
            console.log('✅ Intégrité des données vérifiée');
        }
    }
    
    return result;
}

module.exports = {
    DatabaseMigration,
    dbMigration,
    initializeDatabaseMigration
};