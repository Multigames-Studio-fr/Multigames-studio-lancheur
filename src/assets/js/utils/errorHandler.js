/**
 * @author Optimisation
 * Gestionnaire d'erreurs centralisé et amélioré avec rapport Discord
 */

import errorReporter from './errorReporter.js';

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100; // Garder seulement les 100 dernières erreurs
        this.setupGlobalHandlers();
    }

    setupGlobalHandlers() {
        // Gestionnaire pour les erreurs JavaScript non capturées
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'JavaScript Error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: new Date().toISOString()
            });
        });

        // Gestionnaire pour les promesses rejetées
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'Unhandled Promise Rejection',
                message: event.reason?.message || 'Promise rejected',
                reason: event.reason,
                timestamp: new Date().toISOString()
            });
        });

        // Gestionnaire pour les erreurs de ressources
        window.addEventListener('error', (event) => {
            if (event.target && event.target !== window) {
                this.handleError({
                    type: 'Resource Error',
                    message: `Failed to load: ${event.target.src || event.target.href}`,
                    element: event.target.tagName,
                    timestamp: new Date().toISOString()
                });
            }
        }, true);
    }

    handleError(errorInfo) {
        // Ajouter l'erreur à la liste
        this.errors.push(errorInfo);
        
        // Limiter le nombre d'erreurs stockées
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(-this.maxErrors);
        }

        // Logger l'erreur avec des détails
        console.group(`🚨 ${errorInfo.type}`);
        console.error('Message:', errorInfo.message);
        if (errorInfo.filename) console.log('File:', errorInfo.filename);
        if (errorInfo.lineno) console.log('Line:', errorInfo.lineno);
        if (errorInfo.error && errorInfo.error.stack) console.log('Stack:', errorInfo.error.stack);
        console.log('Timestamp:', errorInfo.timestamp);
        console.groupEnd();

        // Envoyer l'erreur au processus principal si en mode dev
        if (typeof require !== 'undefined') {
            try {
                const { ipcRenderer } = require('electron');
                ipcRenderer.send('renderer-error', errorInfo);
            } catch (e) {
                // Ignore si ipcRenderer n'est pas disponible
            }
        }

        // Optimisation : Envoyer automatiquement le rapport d'erreur vers Discord
        if (this.shouldReportError(errorInfo)) {
            errorReporter.reportError(errorInfo).catch(err => {
                console.warn('Impossible d\'envoyer le rapport d\'erreur:', err);
            });
        }

        // Actions spécifiques selon le type d'erreur
        this.handleSpecificError(errorInfo);
    }

    shouldReportError(errorInfo) {
        // Ne pas reporter certains types d'erreurs mineures
        const minorErrors = [
            'Resource Error', // Images manquantes, etc.
            'Network Error'   // Problèmes de réseau temporaires
        ];

        // Ne pas reporter les erreurs trop fréquentes
        if (minorErrors.includes(errorInfo.type)) {
            return false;
        }

        // Reporter les erreurs importantes
        const criticalErrors = [
            'JavaScript Error',
            'Unhandled Promise Rejection',
            'Launcher Initialization Error',
            'Main Process Error',
            'Authentication Error'
        ];

        return criticalErrors.includes(errorInfo.type);
    }

    handleSpecificError(errorInfo) {
        switch (errorInfo.type) {
            case 'Resource Error':
                this.handleResourceError(errorInfo);
                break;
            case 'Network Error':
                this.handleNetworkError(errorInfo);
                break;
            case 'Authentication Error':
                this.handleAuthError(errorInfo);
                break;
            default:
                // Erreur générique
                break;
        }
    }

    handleResourceError(errorInfo) {
        // Tenter de recharger la ressource après un délai
        setTimeout(() => {
            console.log('Tentative de rechargement de la ressource...');
            // Logique de rechargement si nécessaire
        }, 2000);
    }

    handleNetworkError(errorInfo) {
        // Afficher un message à l'utilisateur
        this.showUserNotification('Erreur de réseau', 'Vérifiez votre connexion internet');
    }

    handleAuthError(errorInfo) {
        // Rediriger vers la page de connexion
        if (typeof changePanel === 'function') {
            changePanel('login');
        }
    }

    showUserNotification(title, message, type = 'error') {
        // Créer une notification utilisateur non-intrusive
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <strong>${title}</strong>
                <p>${message}</p>
                <button class="notification-close">&times;</button>
            </div>
        `;

        // Styles inline pour assurer l'affichage
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease-out;
        `;

        // Ajouter les styles d'animation
        if (!document.querySelector('#error-handler-styles')) {
            const style = document.createElement('style');
            style.id = 'error-handler-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    float: right;
                    margin-left: 10px;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Fermeture automatique après 5 secondes
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);

        // Fermeture manuelle
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }

    // Wrapper pour les fonctions async avec gestion d'erreur
    async safeAsync(asyncFunction, context = 'Unknown') {
        try {
            return await asyncFunction();
        } catch (error) {
            this.handleError({
                type: 'Async Function Error',
                context: context,
                message: error.message,
                error: error,
                timestamp: new Date().toISOString()
            });
            throw error; // Re-throw pour permettre la gestion locale
        }
    }

    // Wrapper pour les appels de fonctions normales
    safeTry(func, context = 'Unknown') {
        try {
            return func();
        } catch (error) {
            this.handleError({
                type: 'Function Error',
                context: context,
                message: error.message,
                error: error,
                timestamp: new Date().toISOString()
            });
            return null;
        }
    }

    // Obtenir le rapport d'erreurs
    getErrorReport() {
        const errorsByType = {};
        this.errors.forEach(error => {
            if (!errorsByType[error.type]) {
                errorsByType[error.type] = 0;
            }
            errorsByType[error.type]++;
        });

        return {
            totalErrors: this.errors.length,
            errorsByType: errorsByType,
            recentErrors: this.errors.slice(-10), // 10 dernières erreurs
            oldestError: this.errors[0]?.timestamp,
            newestError: this.errors[this.errors.length - 1]?.timestamp
        };
    }

    // Nettoyer les erreurs anciennes
    clearOldErrors(maxAge = 24 * 60 * 60 * 1000) { // 24 heures par défaut
        const cutoff = new Date(Date.now() - maxAge).toISOString();
        this.errors = this.errors.filter(error => error.timestamp > cutoff);
    }

    // Exporter les erreurs pour débogage
    exportErrors() {
        const errorData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            errors: this.errors
        };

        const blob = new Blob([JSON.stringify(errorData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `launcher-errors-${Date.now()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    }
}

// Instance globale
const errorHandler = new ErrorHandler();

// Ajouter au processus principal si disponible
if (typeof require !== 'undefined') {
    try {
        const { ipcRenderer } = require('electron');
        
        // Écouter les erreurs du processus principal
        ipcRenderer.on('main-process-error', (event, error) => {
            errorHandler.handleError({
                type: 'Main Process Error',
                message: error.message,
                error: error,
                timestamp: new Date().toISOString()
            });
        });
    } catch (e) {
        // Ignore si ipcRenderer n'est pas disponible
    }
}

export default errorHandler;