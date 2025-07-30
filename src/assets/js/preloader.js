// ...existing code...
// filepath: c:\Users\wiltark\Documents\git\Multigames-studio-lancheur\src\assets\js\preloader.js

document.addEventListener('DOMContentLoaded', () => {
    // Optionnel : attendre que la barre de progression soit terminée
    setTimeout(() => {
        const preloader = document.getElementById('preloader');
        if (preloader) {
            preloader.classList.add('fade-out');
            // Supprime le préloader du DOM après l'animation
            setTimeout(() => {
                preloader.style.display = 'none';
            }, 900); // doit être > à la durée du transition CSS
        }
    }, 3500); // durée totale de l'animation (ajuste si besoin)
});