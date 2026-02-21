const express = require('express');
const { db } = require('../models/database');
const { generateResponse } = require('../utils/ollama');
const { setCredentials } = require('../utils/drive');
const { google } = require('googleapis');
const router = express.Router();

// Middleware d'authentification
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

router.use(requireAuth);

// Page de recherche
router.get('/', (req, res) => {
  res.render('search', { results: null });
});

router.post('/', async (req, res) => {
  const { query } = req.body;
  const userId = req.session.userId;

  // Récupérer tous les emails archivés
  const emails = await new Promise((resolve) => {
    db.all(`
      SELECT e.*, m.name as mailbox_name, r.final_response
      FROM emails e
      JOIN mailboxes m ON e.mailbox_id = m.id
      LEFT JOIN responses r ON e.id = r.email_id
      WHERE m.user_id = ? AND e.archived = 1
    `, [userId], (err, rows) => resolve(rows));
  });

  // Utiliser IA pour analyser et trouver les pertinents
  const prompt = `Voici une liste d'emails archivés. Trouve ceux qui correspondent à la requête: "${query}". Retourne les IDs des emails pertinents séparés par des virgules.\n\n${emails.map(e => `ID: ${e.id}, Sujet: ${e.subject}, Corps: ${e.body.substring(0, 500)}..., Réponse: ${e.final_response || ''}`).join('\n\n')}`;

  const relevantIds = await generateResponse(prompt);
  const ids = relevantIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

  const results = emails.filter(e => ids.includes(e.id));

  res.render('search', { results: results, query: query });
});

module.exports = router;