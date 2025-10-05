# 🔧 Guide de dépannage - Comptes Microsoft

## Problème : Compte Microsoft affiché comme "undefined"

### Symptômes
- Le compte Microsoft apparaît avec le nom "undefined" dans la liste des comptes
- Le bouton "Supprimer" est visible mais le nom du joueur n'apparaît pas
- La connexion Microsoft semble réussir mais les données ne sont pas correctement affichées

### Causes possibles
1. **Données de profil incomplètes** : Les données retournées par Microsoft ne contiennent pas le nom du joueur
2. **Problème de sauvegarde** : Les données sont mal sauvegardées dans la base de données
3. **Corruption des données** : Les données stockées sont corrompues
4. **Problème de synchronisation** : Décalage entre les données Microsoft et l'affichage

### Solutions

#### 🔄 Solution 1 : Diagnostic automatique (Recommandé)
1. Ouvrez la console développeur (`F12`)
2. Tapez : `launcherDiagnostic.diagnoseAccounts()`
3. Puis : `launcherDiagnostic.fixAccounts()`
4. Redémarrez le launcher

#### 🔄 Solution 2 : Suppression et reconnexion
1. Supprimez le compte "undefined" avec le bouton Supprimer
2. Redémarrez le launcher
3. Reconnectez-vous avec votre compte Microsoft

#### 🔄 Solution 3 : Nettoyage complet
1. Ouvrez la console développeur (`F12`)
2. Tapez : `launcherDiagnostic.clearBrokenAccounts()`
3. Redémarrez le launcher
4. Reconnectez-vous

#### 🔄 Solution 4 : Réinitialisation manuelle
1. Fermez complètement le launcher
2. Naviguez vers : `%APPDATA%/Launcher/databases/` (ou `data/Launcher/databases/` en mode dev)
3. Supprimez ou renommez le fichier de base de données
4. Redémarrez le launcher
5. Reconnectez-vous

### Prévention

#### Vérifications avant connexion
- Assurez-vous d'avoir une connexion internet stable
- Vérifiez que votre compte Microsoft/Xbox est actif
- Patientez pendant le processus de connexion

#### Bonnes pratiques
- Ne fermez pas le launcher pendant la connexion
- Attendez que le popup de chargement disparaisse
- Vérifiez que le nom apparaît correctement avant de continuer

### Informations techniques

#### Structure des données Microsoft
```javascript
{
  "name": "NomDuJoueur",
  "profile": {
    "name": "NomDuJoueur",
    "id": "uuid-du-joueur"
  },
  "meta": {
    "type": "Xbox"
  },
  "access_token": "token...",
  "refresh_token": "token..."
}
```

#### Points de vérification
- ✅ `data.name` doit être défini
- ✅ `data.profile.name` doit être défini
- ✅ `data.meta.type` doit être "Xbox"
- ✅ Les tokens doivent être présents

### Logs utiles

Pour diagnostiquer le problème, recherchez ces messages dans la console :

```
✅ Messages normaux :
- "Ajout du compte: [nom] Type: Xbox"
- "Compte sauvegardé avec succès: [nom]"
- "Compte Xbox rafraîchi avec succès: [nom]"

❌ Messages d'erreur :
- "Données de compte invalides"
- "Nom de compte Microsoft manquant"
- "Nom principal incorrect"
```

### Support avancé

#### Commandes de diagnostic
```javascript
// Dans la console F12 :

// Voir tous les comptes stockés
launcherDiagnostic.diagnoseAccounts()

// Réparer automatiquement
launcherDiagnostic.fixAccounts()

// Nettoyer les comptes cassés
launcherDiagnostic.clearBrokenAccounts()

// Voir les données brutes d'un compte
const launcher = new Launcher();
launcher.db = new database();
launcher.db.readAllData('accounts').then(console.log);
```

#### Exportation des erreurs
Si le problème persiste :
1. Ouvrez la console (`F12`)
2. Tapez : `errorHandler.exportErrors()`
3. Un fichier JSON sera téléchargé avec les détails des erreurs

### Cas spéciaux

#### Compte Microsoft sans profil Minecraft
Si votre compte Microsoft n'a pas de profil Minecraft :
- Le launcher peut ne pas récupérer le nom correctement
- Solution : Créez un profil Minecraft sur minecraft.net
- Puis reconnectez-vous au launcher

#### Comptes avec caractères spéciaux
- Certains noms avec caractères spéciaux peuvent causer des problèmes
- Le launcher tente de les corriger automatiquement
- En cas de problème, le nom sera remplacé par "Joueur_[timestamp]"

---

**Version** : 1.2.1+optimized  
**Dernière mise à jour** : Octobre 2025  

Si le problème persiste après toutes ces solutions, contactez le support avec les logs d'erreur exportés.