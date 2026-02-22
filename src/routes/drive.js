const express = require('express');
const { getAuthUrl, getTokens, google, oauth2Client } = require('../utils/drive');
const { db } = require('../models/database');
const router = express.Router();

// Middleware d'authentification
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

router.use(requireAuth);

// Initier l'auth Google
router.get('/google', (req, res) => {
  const authUrl = getAuthUrl();
  res.redirect(authUrl);
});

// Callback Google
router.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  const userId = req.session.userId;

  try {
    const tokens = await getTokens(code);
    db.run('INSERT OR REPLACE INTO drive_tokens (user_id, access_token, refresh_token, expiry_date) VALUES (?, ?, ?, ?)',
      [userId, tokens.access_token, tokens.refresh_token, tokens.expiry_date]);
    res.redirect('/dashboard');
  } catch (error) {
    res.send('Erreur lors de la connexion Google Drive');
  }
});

// Initier l'auth Google pour Gmail (OAuth)
router.get('/google/gmail', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ];
  const authUrl = getAuthUrl(scopes);
  res.redirect(authUrl);
});

// Callback Google pour Gmail
router.get('/google/gmail/callback', async (req, res) => {
  const { code } = req.query;
  const userId = req.session.userId;

  try {
    const tokens = await getTokens(code);
    // oauth2Client a maintenant les credentials, on peut récupérer l'email utilisateur
    const oauth2 = google.oauth2({ auth: oauth2Client, version: 'v2' });
    const userinfo = await oauth2.userinfo.get();
    const emailAddress = userinfo.data.email;

    db.run('INSERT INTO gmail_tokens (user_id, email_address, access_token, refresh_token, expiry_date) VALUES (?, ?, ?, ?, ?)',
      [userId, emailAddress, tokens.access_token, tokens.refresh_token, tokens.expiry_date]);

    // Rediriger vers la liste des boîtes ou /mailboxes pour gestion
    res.redirect('/mailboxes');
  } catch (error) {
    console.error(error);
    res.send('Erreur lors de la connexion Google Gmail');
  }
});

module.exports = router;