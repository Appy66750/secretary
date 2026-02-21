const express = require('express');
const { db } = require('../models/database');
const router = express.Router();

// Middleware admin (simplifié)
function requireAdmin(req, res, next) {
  // En production, vérifier si admin
  next();
}

router.use(requireAdmin);

// Liste des comptes en attente
router.get('/pending', (req, res) => {
  db.all('SELECT * FROM users WHERE status = "pending"', [], (err, users) => {
    res.render('admin-pending', { users: users });
  });
});

// Valider un compte
router.post('/validate/:id', (req, res) => {
  const userId = req.params.id;
  db.run('UPDATE users SET status = "active", validated_at = CURRENT_TIMESTAMP WHERE id = ?', [userId], (err) => {
    res.redirect('/admin/pending');
  });
});

module.exports = router;