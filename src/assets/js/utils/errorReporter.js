/**
 * @author Optimisation
 * Système de rapport d'erreurs automatique vers Discord
 */

const { ipcRenderer } = require('electron');
const os = require('os');
const pkg = require('../package.json');

class ErrorReporter {
    constructor() {
        this.webhookUrl = 'https://discord.com/api/webhooks/1424474469455495280/JdxQIGR5G3mM0ClE88tvFqpw5PaNh954VkC-AtlAr5cG25o0WqL-v-RBYZd45UE_Lv7S';
        this.pendingReports = [];
        this.lastReportTime = 0;
        this.reportCooldown = 30000; // 30 secondes entre les rapports
        this.userConsent = null; // null = pas demandé, true = accepté, false = refusé
    }

    async askUserConsent() {
        return new Promise((resolve) => {
            // Créer une popup de consentement
            const consentPopup = document.createElement('div');
            consentPopup.className = 'error-consent-popup';
            consentPopup.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 99999;
            `;

            consentPopup.innerHTML = `
                <div class="consent-content" style="
                    background: #1a1a1a;
                    border-radius: 12px;
                    padding: 30px;
                    max-width: 500px;
                    color: white;
                    text-align: center;
                    border: 2px solid #F8BA59;
                ">
                    <h3 style="color: #F8BA59; margin-bottom: 20px;">🐛 Erreur détectée</h3>
                    <p style="margin-bottom: 20px; line-height: 1.5;">
                        Le launcher a rencontré une erreur. Voulez-vous envoyer automatiquement 
                        un rapport d'erreur aux développeurs pour les aider à corriger le problème ?
                    </p>
                    <div style="margin-bottom: 15px; font-size: 12px; color: #ccc;">
                        <strong>Données envoyées :</strong><br>
                        • Type d'erreur et message<br>
                        • Version du launcher<br>
                        • Système d'exploitation<br>
                        • Heure de l'erreur<br>
                        <em>Aucune donnée personnelle ne sera envoyée</em>
                    </div>
                    <div style="display: flex; gap: 15px; justify-content: center;">
                        <button id="consent-yes" style="
                            background: #4CAF50;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">Oui, envoyer</button>
                        <button id="consent-no" style="
                            background: #f44336;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">Non, merci</button>
                        <button id="consent-always" style="
                            background: #2196F3;
                            color: white;
                            border: none;
                            padding: 10px 20px;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: bold;
                        ">Toujours envoyer</button>
                    </div>
                </div>
            `;

            document.body.appendChild(consentPopup);

            // Gestionnaires d'événements
            document.getElementById('consent-yes').addEventListener('click', () => {
                this.userConsent = 'once';
                document.body.removeChild(consentPopup);
                resolve(true);
            });

            document.getElementById('consent-no').addEventListener('click', () => {
                this.userConsent = false;
                localStorage.setItem('errorReportingConsent', 'false');
                document.body.removeChild(consentPopup);
                resolve(false);
            });

            document.getElementById('consent-always').addEventListener('click', () => {
                this.userConsent = true;
                localStorage.setItem('errorReportingConsent', 'true');
                document.body.removeChild(consentPopup);
                resolve(true);
            });
        });
    }

    async checkConsent() {
        // Vérifier si l'utilisateur a déjà donné son consentement
        const savedConsent = localStorage.getItem('errorReportingConsent');
        
        if (savedConsent === 'true') {
            this.userConsent = true;
            return true;
        } else if (savedConsent === 'false') {
            this.userConsent = false;
            return false;
        }

        // Demander le consentement
        return await this.askUserConsent();
    }

    async reportError(errorInfo) {
        try {
            // Vérifier le cooldown
            const now = Date.now();
            if (now - this.lastReportTime < this.reportCooldown) {
                console.log('⏳ Rapport d\'erreur en cooldown');
                return;
            }

            // Demander le consentement si nécessaire
            if (this.userConsent === null || this.userConsent === 'once') {
                const hasConsent = await this.checkConsent();
                if (!hasConsent) {
                    console.log('❌ Utilisateur a refusé l\'envoi des rapports d\'erreur');
                    return;
                }
            } else if (this.userConsent === false) {
                return; // L'utilisateur a refusé les rapports
            }

            // Préparer les données du rapport
            const report = await this.prepareReport(errorInfo);
            
            // Envoyer vers Discord
            await this.sendToDiscord(report);
            
            this.lastReportTime = now;
            console.log('✅ Rapport d\'erreur envoyé avec succès');

        } catch (error) {
            console.error('Erreur lors de l\'envoi du rapport:', error);
        }
    }

    async prepareReport(errorInfo) {
        // Obtenir les informations système
        const systemInfo = {
            platform: os.platform(),
            arch: os.arch(),
            release: os.release(),
            totalMem: Math.round(os.totalmem() / (1024 ** 3)) + ' GB',
            nodeVersion: process.version
        };

        // Préparer l'embed Discord
        const embed = {
            title: "🐛 Rapport d'erreur - MultiGames Studio Launcher",
            color: 0xff0000, // Rouge
            timestamp: new Date().toISOString(),
            fields: [
                {
                    name: "📋 Type d'erreur",
                    value: errorInfo.type || 'Erreur inconnue',
                    inline: true
                },
                {
                    name: "💬 Message",
                    value: "```\n" + (errorInfo.message || 'Aucun message').substring(0, 1000) + "\n```",
                    inline: false
                },
                {
                    name: "🚀 Version Launcher",
                    value: pkg.version || 'Inconnue',
                    inline: true
                },
                {
                    name: "💻 Système",
                    value: `${systemInfo.platform} ${systemInfo.arch}\n${systemInfo.release}`,
                    inline: true
                },
                {
                    name: "🧠 Mémoire",
                    value: systemInfo.totalMem,
                    inline: true
                },
                {
                    name: "⏰ Heure",
                    value: new Date().toLocaleString('fr-FR'),
                    inline: false
                }
            ]
        };

        // Ajouter la stack trace si disponible (limitée)
        if (errorInfo.error && errorInfo.error.stack) {
            embed.fields.push({
                name: "📝 Stack Trace",
                value: "```\n" + errorInfo.error.stack.substring(0, 1000) + "\n```",
                inline: false
            });
        }

        // Ajouter le fichier si disponible
        if (errorInfo.filename) {
            embed.fields.push({
                name: "📄 Fichier",
                value: errorInfo.filename + (errorInfo.lineno ? `:${errorInfo.lineno}` : ''),
                inline: true
            });
        }

        return {
            username: "Launcher Bug Reporter",
            avatar_url: "https://cdn.discordapp.com/emojis/1234567890123456789.png", // Optional
            embeds: [embed]
        };
    }

    async sendToDiscord(report) {
        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(report)
            });

            if (!response.ok) {
                throw new Error(`Discord webhook error: ${response.status} ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('Erreur lors de l\'envoi vers Discord:', error);
            throw error;
        }
    }

    // Méthode pour tester l'envoi
    async testReport() {
        const testError = {
            type: 'Test Error',
            message: 'Ceci est un test du système de rapport d\'erreurs',
            timestamp: new Date().toISOString(),
            error: new Error('Test error for reporting system')
        };

        await this.reportError(testError);
    }

    // Méthode pour réinitialiser le consentement
    resetConsent() {
        this.userConsent = null;
        localStorage.removeItem('errorReportingConsent');
        console.log('✅ Consentement réinitialisé');
    }

    // Méthode pour afficher le statut
    getStatus() {
        return {
            consent: this.userConsent,
            lastReport: this.lastReportTime,
            pendingReports: this.pendingReports.length
        };
    }
}

// Instance globale
const errorReporter = new ErrorReporter();

export default errorReporter;