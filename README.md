# Secrétaire IA

Application de gestion automatique des emails avec IA locale utilisant Ollama et Mistral.

## Fonctionnalités

- Gestion multi-boîtes mail (Gmail, Outlook, iCloud, etc.)
- Génération automatique de réponses via IA locale (Ollama + Mistral)
- Archivage automatique sur Google Drive
- Recherche intelligente dans les archives
- Interface web simple et sécurisée
- Chiffrement des données sensibles
- Compatible Windows, Mac, Linux et Docker

## Installation

### Prérequis

- Node.js 18+
- Ollama installé et configuré avec le modèle Mistral
- Compte Google avec API Drive activée

### Étapes

1. Cloner le repository :
   ```bash
   git clone https://github.com/Appy66750/secretary.git
   cd secretary
   ```

2. Installer les dépendances :
   ```bash
   npm install
   ```

3. Configurer l'environnement :
   - Copier `.env.example` vers `.env`
   - Remplir les variables d'environnement (voir section Configuration)

4. Initialiser la base de données :
   ```bash
   npm run init-db
   ```

5. Installer et configurer Ollama :
   - Télécharger Ollama : https://ollama.ai/
   - Installer le modèle Mistral :
     ```bash
     ollama pull mistral
     ```

6. Démarrer l'application :
   ```bash
   npm start
   ```

   Ou en mode développement :
   ```bash
   npm run dev
   ```

7. Accéder à l'application : http://localhost:3000

### Avec Docker

```bash
docker build -t secretary .
docker run -p 3000:3000 --env-file .env secretary
```

## Configuration

Créer un fichier `.env` basé sur `.env.example` :

```env
PORT=3000
SESSION_SECRET=votre-secret-session-unique
DB_PATH=./database/secretary.db
ENCRYPTION_KEY=votre-cle-32-octets-hex
VALIDATION_EMAIL=cyril.petillon@icloud.com
SMTP_HOST=smtp.icloud.com
SMTP_PORT=587
SMTP_USER=votre-email-validation
SMTP_PASS=votre-mot-de-passe-app
GOOGLE_CLIENT_ID=votre-client-id-google
GOOGLE_CLIENT_SECRET=votre-client-secret-google
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback
OLLAMA_URL=http://localhost:11434/api/generate
OLLAMA_MODEL=mistral
```

### Clé de chiffrement

Générer une clé de 32 octets en hex :
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Configuration Google Drive

1. Aller sur https://console.developers.google.com/
2. Créer un projet ou en sélectionner un
3. Activer l'API Google Drive
4. Créer des credentials OAuth 2.0
5. Ajouter http://localhost:3000/auth/google/callback comme URI de redirection

## Utilisation

1. Créer un compte utilisateur
2. Attendre la validation manuelle (email envoyé à cyril.petillon@icloud.com)
3. Se connecter
4. Configurer ses boîtes mail
5. Connecter Google Drive
6. Synchroniser les emails
7. Générer des réponses automatiquement
8. Rechercher dans les archives

## Architecture

- **Backend** : Node.js + Express
- **Base de données** : SQLite
- **Templates** : EJS
- **IA** : Ollama (Mistral) en local
- **Stockage** : Google Drive
- **Sécurité** : Chiffrement AES-256-GCM, hash bcrypt, sessions

## Sécurité

- Mots de passe hashés avec bcrypt
- Identifiants mail chiffrés AES-256-GCM
- Sessions sécurisées
- Validation manuelle des comptes
- Fonctionnement 100% local (pas d'API externe payante)

## Licence

MIT
