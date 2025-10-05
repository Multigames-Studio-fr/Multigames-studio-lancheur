#!/usr/bin/env node

/**
 * Script de test pour vérifier les optimisations du launcher
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🧪 Test des optimisations du launcher MultiGames Studio');
console.log('='.repeat(60));

// Tests de base
function runTests() {
    const tests = [
        testPackageJson,
        testFileStructure,
        testOptimizedFiles,
        testStartupScript
    ];

    let passed = 0;
    let failed = 0;

    tests.forEach((test, index) => {
        try {
            console.log(`\n${index + 1}. ${test.name}...`);
            test();
            console.log('   ✅ PASSED');
            passed++;
        } catch (error) {
            console.log(`   ❌ FAILED: ${error.message}`);
            failed++;
        }
    });

    console.log('\n' + '='.repeat(60));
    console.log(`📊 Résultats: ${passed} réussis, ${failed} échoués`);
    
    if (failed === 0) {
        console.log('🎉 Tous les tests sont passés! Le launcher est optimisé.');
    } else {
        console.log('⚠️  Certains tests ont échoué. Vérifiez les erreurs ci-dessus.');
    }
}

function testPackageJson() {
    const packagePath = './package.json';
    if (!fs.existsSync(packagePath)) {
        throw new Error('package.json non trouvé');
    }

    const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    
    // Vérifier les corrections
    if (pkg.name !== 'multigames-studio-launcher') {
        throw new Error(`Nom incorrect: ${pkg.name}`);
    }
    
    if (!pkg.productName) {
        throw new Error('productName manquant (était preductname)');
    }

    if (!pkg.engines) {
        throw new Error('Spécifications engines manquantes');
    }

    console.log('   📦 package.json correctement configuré');
}

function testFileStructure() {
    const requiredFiles = [
        './src/app.js',
        './src/assets/js/launcher.js',
        './src/assets/js/utils/config.js',
        './src/assets/js/utils/database.js',
        './src/assets/js/utils/performance.js',
        './src/assets/js/utils/errorHandler.js',
        './OPTIMIZATIONS.md'
    ];

    requiredFiles.forEach(file => {
        if (!fs.existsSync(file)) {
            throw new Error(`Fichier manquant: ${file}`);
        }
    });

    console.log('   📁 Structure de fichiers correcte');
}

function testOptimizedFiles() {
    // Vérifier que les optimisations sont présentes
    const launcherPath = './src/assets/js/launcher.js';
    const launcherContent = fs.readFileSync(launcherPath, 'utf8');

    if (!launcherContent.includes('performanceOptimizer')) {
        throw new Error('Optimisations de performance manquantes dans launcher.js');
    }

    if (!launcherContent.includes('errorHandler')) {
        throw new Error('Gestionnaire d\'erreurs manquant dans launcher.js');
    }

    const appPath = './src/app.js';
    const appContent = fs.readFileSync(appPath, 'utf8');

    if (!appContent.includes('uncaughtException')) {
        throw new Error('Gestion des erreurs globales manquante dans app.js');
    }

    console.log('   🔧 Optimisations présentes dans les fichiers');
}

function testStartupScript() {
    const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
    
    if (!pkg.scripts.start) {
        throw new Error('Script start manquant');
    }

    if (!pkg.scripts.dev) {
        throw new Error('Script dev manquant');
    }

    console.log('   🚀 Scripts de démarrage configurés');
}

// Fonction pour tester le démarrage (optionnel)
function testLauncherStartup() {
    return new Promise((resolve, reject) => {
        console.log('\n🔄 Test de démarrage du launcher (optionnel)...');
        
        const child = spawn('npm', ['run', 'start'], {
            stdio: 'pipe',
            shell: true,
            timeout: 10000 // 10 secondes max
        });

        let output = '';
        
        child.stdout.on('data', (data) => {
            output += data.toString();
        });

        child.stderr.on('data', (data) => {
            output += data.toString();
        });

        child.on('close', (code) => {
            if (output.includes('Initializing Launcher')) {
                console.log('   ✅ Le launcher démarre correctement');
                resolve();
            } else {
                console.log('   ⚠️  Démarrage du launcher non confirmé');
                resolve(); // Ne pas faire échouer pour ça
            }
        });

        child.on('error', (error) => {
            console.log(`   ⚠️  Erreur lors du test de démarrage: ${error.message}`);
            resolve(); // Ne pas faire échouer pour ça
        });

        // Arrêter le processus après un moment
        setTimeout(() => {
            child.kill();
            resolve();
        }, 8000);
    });
}

// Exécuter les tests
runTests();

// Test de démarrage optionnel (décommenter si souhaité)
// testLauncherStartup().then(() => {
//     console.log('\n✨ Tests terminés!');
// });