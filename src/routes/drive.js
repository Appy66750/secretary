const express = require('express');
const { getAuthUrl, getTokens } = require('../utils/drive');
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

module.exports = router;