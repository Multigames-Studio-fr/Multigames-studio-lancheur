/**
 * @author Optimisation
 * Diagnostic des comptes Microsoft
 */

class AccountDiagnostic {
    constructor() {
        this.issues = [];
    }

    async diagnoseAccount(account) {
        this.issues = [];
        
        console.group('🔍 Diagnostic du compte:', account.ID);
        
        // Vérifier la structure de base
        this.checkBasicStructure(account);
        
        // Vérifier le nom
        this.checkAccountName(account);
        
        // Vérifier le type
        this.checkAccountType(account);
        
        // Vérifier les données de profil
        this.checkProfileData(account);
        
        // Vérifier les tokens (pour Microsoft)
        this.checkTokens(account);
        
        console.log('Issues trouvées:', this.issues.length);
        this.issues.forEach(issue => console.warn('⚠️', issue));
        
        console.groupEnd();
        
        return {
            isValid: this.issues.length === 0,
            issues: this.issues,
            account: account
        };
    }

    checkBasicStructure(account) {
        if (!account) {
            this.issues.push('Compte null ou undefined');
            return;
        }
        
        if (!account.ID) {
            this.issues.push('ID de compte manquant');
        }
        
        if (!account.meta) {
            this.issues.push('Métadonnées de compte manquantes');
        }
    }

    checkAccountName(account) {
        const possibleNames = [
            account.name,
            account.profile?.name,
            account.username,
            account.displayName
        ];
        
        const validName = possibleNames.find(name => 
            name && name !== 'undefined' && typeof name === 'string' && name.length > 0
        );
        
        if (!validName) {
            this.issues.push('Aucun nom valide trouvé');
            console.log('Noms possibles vérifiés:', possibleNames);
        } else if (account.name !== validName) {
            this.issues.push(`Nom principal incorrect: "${account.name}", devrait être: "${validName}"`);
        }
    }

    checkAccountType(account) {
        if (!account.meta?.type) {
            this.issues.push('Type de compte manquant');
        } else {
            const validTypes = ['Xbox', 'Mojang', 'AZauth'];
            if (!validTypes.includes(account.meta.type)) {
                this.issues.push(`Type de compte invalide: ${account.meta.type}`);
            }
        }
    }

    checkProfileData(account) {
        if (account.meta?.type === 'Xbox') {
            if (!account.profile) {
                this.issues.push('Données de profil Xbox manquantes');
            } else {
                if (!account.profile.name) {
                    this.issues.push('Nom du profil Xbox manquant');
                }
                if (!account.profile.id) {
                    this.issues.push('ID du profil Xbox manquant');
                }
            }
        }
    }

    checkTokens(account) {
        if (account.meta?.type === 'Xbox') {
            if (!account.access_token) {
                this.issues.push('Token d\'accès Xbox manquant');
            }
            if (!account.refresh_token) {
                this.issues.push('Token de rafraîchissement Xbox manquant');
            }
        }
    }

    async fixAccount(account) {
        console.log('🔧 Tentative de réparation du compte:', account.ID);
        
        const fixed = { ...account };
        let wasFixed = false;
        
        // Réparer le nom
        if (!fixed.name || fixed.name === 'undefined') {
            const newName = fixed.profile?.name || fixed.username || fixed.displayName || `Joueur_${Date.now().toString().slice(-6)}`;
            fixed.name = newName;
            wasFixed = true;
            console.log('✅ Nom réparé:', newName);
        }
        
        // Réparer les métadonnées manquantes
        if (!fixed.meta) {
            fixed.meta = { type: 'Unknown' };
            wasFixed = true;
            console.log('✅ Métadonnées ajoutées');
        }
        
        return {
            fixed: fixed,
            wasFixed: wasFixed
        };
    }

    async diagnoseAllAccounts(database) {
        console.log('🔍 Diagnostic de tous les comptes...');
        
        const accounts = await database.readAllData('accounts');
        const results = [];
        
        for (const account of accounts) {
            const diagnostic = await this.diagnoseAccount(account);
            results.push(diagnostic);
            
            if (!diagnostic.isValid) {
                const fixResult = await this.fixAccount(account);
                if (fixResult.wasFixed) {
                    console.log('🔧 Compte réparé, sauvegarde...');
                    await database.updateData('accounts', fixResult.fixed, account.ID);
                }
            }
        }
        
        const validAccounts = results.filter(r => r.isValid).length;
        const invalidAccounts = results.length - validAccounts;
        
        console.log(`📊 Résultats: ${validAccounts} comptes valides, ${invalidAccounts} comptes avec problèmes`);
        
        return results;
    }

    generateReport(results) {
        const report = {
            timestamp: new Date().toISOString(),
            totalAccounts: results.length,
            validAccounts: results.filter(r => r.isValid).length,
            invalidAccounts: results.filter(r => !r.isValid).length,
            commonIssues: {},
            details: results
        };
        
        // Compter les problèmes communs
        results.forEach(result => {
            result.issues.forEach(issue => {
                if (!report.commonIssues[issue]) {
                    report.commonIssues[issue] = 0;
                }
                report.commonIssues[issue]++;
            });
        });
        
        return report;
    }
}

// Instance globale
const accountDiagnostic = new AccountDiagnostic();

module.exports = accountDiagnostic;