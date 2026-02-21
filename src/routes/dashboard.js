const express = require('express');
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

// Dashboard
router.get('/', (req, res) => {
  const userId = req.session.userId;
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    db.all('SELECT * FROM mailboxes WHERE user_id = ?', [userId], (err, mailboxes) => {
      db.get('SELECT COUNT(*) as count FROM emails WHERE mailbox_id IN (SELECT id FROM mailboxes WHERE user_id = ?) AND is_read = 0', [userId], (err, unread) => {
        res.render('dashboard', {
          user: user,
          mailboxes: mailboxes,
          unreadCount: unread.count
        });
      });
    });
  });
});

// Paramètres utilisateur
router.get('/settings', (req, res) => {
  const userId = req.session.userId;
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
    res.render('settings', { user: user, profile: JSON.parse(user.profile || '{}') });
  });
});

router.post('/settings', (req, res) => {
  const userId = req.session.userId;
  const { formality, styles } = req.body;
  const profile = JSON.stringify({ formality, styles: styles ? styles.split(',') : [] });
  db.run('UPDATE users SET profile = ? WHERE id = ?', [profile, userId], (err) => {
    res.redirect('/dashboard/settings');
  });
});

module.exports = router;