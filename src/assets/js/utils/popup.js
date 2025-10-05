/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 */

const { ipcRenderer } = require('electron');

export default class popup {
    constructor() {
        // Optimisation : Vérification de l'existence des éléments
        this.popup = document.querySelector('.popup');
        this.popupTitle = document.querySelector('.popup-title');
        this.popupContent = document.querySelector('.popup-content');
        this.popupOptions = document.querySelector('.popup-options');
        this.popupButton = document.querySelector('.popup-button');
        
        // Vérifier que tous les éléments existent
        if (!this.popup || !this.popupTitle || !this.popupContent || !this.popupOptions || !this.popupButton) {
            console.warn('Certains éléments de popup sont manquants dans le DOM');
        }

        // Optimisation : Éviter les listeners multiples
        this.clickHandler = null;
    }

    openPopup(info) {
        if (!this.popup) {
            console.error('Élément popup non trouvé');
            return;
        }

        try {
            // Optimisation : Validation des paramètres
            const safeInfo = {
                title: info?.title || 'Information',
                content: info?.content || '',
                color: info?.color || '#e21212',
                background: info?.background !== false,
                options: info?.options || false,
                exit: info?.exit || false
            };

            this.popup.style.display = 'flex';
            this.popup.style.background = safeInfo.background ? '#000000b3' : 'none';
            
            if (this.popupTitle) {
                this.popupTitle.innerHTML = safeInfo.title;
            }
            
            if (this.popupContent) {
                this.popupContent.style.color = safeInfo.color;
                this.popupContent.innerHTML = safeInfo.content;
            }

            if (this.popupOptions && safeInfo.options) {
                this.popupOptions.style.display = 'flex';
                
                // Optimisation : Nettoyer l'ancien listener avant d'ajouter le nouveau
                if (this.clickHandler && this.popupButton) {
                    this.popupButton.removeEventListener('click', this.clickHandler);
                }

                this.clickHandler = () => {
                    if (safeInfo.exit) {
                        ipcRenderer.send('main-window-close');
                    } else {
                        this.closePopup();
                    }
                };

                if (this.popupButton) {
                    this.popupButton.addEventListener('click', this.clickHandler);
                }
            }
        } catch (error) {
            console.error('Erreur lors de l\'ouverture du popup:', error);
        }
    }

    closePopup() {
        try {
            if (this.popup) {
                this.popup.style.display = 'none';
            }
            
            if (this.popupTitle) {
                this.popupTitle.innerHTML = '';
            }
            
            if (this.popupContent) {
                this.popupContent.innerHTML = '';
            }
            
            if (this.popupOptions) {
                this.popupOptions.style.display = 'none';
            }

            // Optimisation : Nettoyer le listener
            if (this.clickHandler && this.popupButton) {
                this.popupButton.removeEventListener('click', this.clickHandler);
                this.clickHandler = null;
            }
        } catch (error) {
            console.error('Erreur lors de la fermeture du popup:', error);
        }
    }

    // Optimisation : Méthode pour nettoyer les listeners
    destroy() {
        this.closePopup();
        if (this.clickHandler && this.popupButton) {
            this.popupButton.removeEventListener('click', this.clickHandler);
        }
    }
}