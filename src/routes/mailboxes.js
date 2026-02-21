const express = require('express');
const { db } = require('../models/database');
const { testImapConnection, encryptPassword } = require('../utils/email');
const router = express.Router();

// Middleware d'authentification
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

router.use(requireAuth);

// Liste des boîtes mail
router.get('/', (req, res) => {
  const userId = req.session.userId;
  db.all('SELECT * FROM mailboxes WHERE user_id = ?', [userId], (err, mailboxes) => {
    res.render('mailboxes', { mailboxes: mailboxes });
  });
});

// Ajouter une boîte mail
router.get('/add', (req, res) => {
  res.render('add-mailbox', { error: null });
});

router.post('/add', async (req, res) => {
  const userId = req.session.userId;
  const { name, imap_host, imap_port, imap_secure, smtp_host, smtp_port, username, password } = req.body;

  // Tester la connexion
  const testResult = await testImapConnection({
    imap_host, imap_port: parseInt(imap_port), imap_secure: imap_secure === 'on',
    username, password
  });

  if (!testResult.success) {
    return res.render('add-mailbox', { error: testResult.error });
  }

  // Chiffrer le mot de passe
  const encrypted = encryptPassword(password);

  db.run('INSERT INTO mailboxes (user_id, name, imap_host, imap_port, imap_secure, smtp_host, smtp_port, username, password_encrypted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, name, imap_host, parseInt(imap_port), imap_secure === 'on' ? 1 : 0, smtp_host, parseInt(smtp_port), username, JSON.stringify(encrypted)], (err) => {
      if (err) {
        return res.render('add-mailbox', { error: 'Erreur lors de l\'ajout' });
      }
      res.redirect('/mailboxes');
    });
});

// Tester connexion
router.post('/test', async (req, res) => {
  const { imap_host, imap_port, imap_secure, username, password } = req.body;
  const result = await testImapConnection({
    imap_host, imap_port: parseInt(imap_port), imap_secure: imap_secure === 'on',
    username, password
  });
  res.json(result);
});

module.exports = router;