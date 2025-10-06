/**
 * @author Optimisation
 * Utilities pour améliorer les performances du launcher
 */

class PerformanceOptimizer {
    constructor() {
        this.timers = new Map();
        this.memoryUsage = [];
        this.startTime = Date.now();
    }

    // Mesurer le temps d'exécution d'une fonction
    startTimer(label) {
        this.timers.set(label, Date.now());
    }

    endTimer(label) {
        const startTime = this.timers.get(label);
        if (startTime) {
            const duration = Date.now() - startTime;
            console.log(`⏱️ ${label}: ${duration}ms`);
            this.timers.delete(label);
            return duration;
        }
        return 0;
    }

    // Monitoring de la mémoire
    logMemoryUsage(label = 'Memory Check') {
        if (typeof process !== 'undefined' && process.memoryUsage) {
            const usage = process.memoryUsage();
            const memInfo = {
                timestamp: Date.now(),
                label,
                rss: Math.round(usage.rss / 1024 / 1024), // MB
                heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
                heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
                external: Math.round(usage.external / 1024 / 1024) // MB
            };
            
            this.memoryUsage.push(memInfo);
            console.log(`💾 ${label} - RSS: ${memInfo.rss}MB, Heap: ${memInfo.heapUsed}/${memInfo.heapTotal}MB`);
            
            // Garder seulement les 50 dernières mesures
            if (this.memoryUsage.length > 50) {
                this.memoryUsage = this.memoryUsage.slice(-50);
            }
            
            return memInfo;
        }
    }

    // Nettoyer la mémoire non utilisée
    async forceGarbageCollection() {
        if (typeof global !== 'undefined' && global.gc) {
            console.log('🧹 Nettoyage de la mémoire...');
            global.gc();
            this.logMemoryUsage('Après GC');
        } else {
            console.warn('Garbage collection non disponible');
        }
    }

    // Débounce function pour limiter les appels
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Throttle function pour limiter la fréquence
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Optimiser les images en redimensionnant
    optimizeImage(imageElement, maxWidth = 1920, maxHeight = 1080) {
        if (imageElement.naturalWidth > maxWidth || imageElement.naturalHeight > maxHeight) {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const ratio = Math.min(maxWidth / imageElement.naturalWidth, maxHeight / imageElement.naturalHeight);
            canvas.width = imageElement.naturalWidth * ratio;
            canvas.height = imageElement.naturalHeight * ratio;
            
            ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.8);
        }
        return imageElement.src;
    }

    // Nettoyer les listeners d'événements orphelins
    cleanupEventListeners() {
        // Supprimer les listeners sur les éléments qui n'existent plus
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            if (el._eventListeners) {
                // Nettoyer les listeners personnalisés si ils existent
                delete el._eventListeners;
            }
        });
    }

    // Rapport de performance
    getPerformanceReport() {
        const uptime = Date.now() - this.startTime;
        const lastMemory = this.memoryUsage[this.memoryUsage.length - 1];
        
        return {
            uptime: Math.round(uptime / 1000), // secondes
            memoryUsage: lastMemory,
            memoryHistory: this.memoryUsage,
            activeTimers: this.timers.size
        };
    }

    // Optimisations automatiques
    enableAutoOptimizations() {
        // Nettoyage automatique de la mémoire toutes les 5 minutes
        setInterval(() => {
            this.forceGarbageCollection();
            this.cleanupEventListeners();
        }, 5 * 60 * 1000);

        // Log de performance toutes les minutes
        setInterval(() => {
            this.logMemoryUsage('Auto Check');
        }, 60 * 1000);

        console.log('✅ Optimisations automatiques activées');
    }

    // Précharger les ressources critiques
    async preloadCriticalResources(resources = []) {
        const promises = resources.map(resource => {
            return new Promise((resolve, reject) => {
                if (resource.endsWith('.css')) {
                    const link = document.createElement('link');
                    link.rel = 'preload';
                    link.as = 'style';
                    link.href = resource;
                    link.onload = resolve;
                    link.onerror = reject;
                    document.head.appendChild(link);
                } else if (resource.endsWith('.js')) {
                    const script = document.createElement('link');
                    script.rel = 'preload';
                    script.as = 'script';
                    script.href = resource;
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                } else {
                    // Images ou autres ressources
                    const img = new Image();
                    img.onload = resolve;
                    img.onerror = reject;
                    img.src = resource;
                }
            });
        });

        try {
            await Promise.all(promises);
            console.log('✅ Ressources critiques préchargées');
        } catch (error) {
            console.warn('⚠️ Erreur lors du préchargement:', error);
        }
    }
}

// Instance globale
const performanceOptimizer = new PerformanceOptimizer();

// Export pour utilisation dans d'autres modules
module.exports = performanceOptimizer;