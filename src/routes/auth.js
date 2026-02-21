const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { db } = require('../models/database');
const router = express.Router();

// Configuration email de validation
const transporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Page de connexion
router.get('/login', (req, res) => {
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND status = "active"', [username], async (err, user) => {
    if (err || !user) {
      return res.render('login', { error: 'Identifiants invalides' });
    }
    const match = await bcrypt.compare(password, user.password_hash);
    if (match) {
      req.session.userId = user.id;
      res.redirect('/dashboard');
    } else {
      res.render('login', { error: 'Identifiants invalides' });
    }
  });
});

// Page d'inscription
router.get('/signup', (req, res) => {
  res.render('signup', { error: null });
});

router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const token = crypto.randomBytes(32).toString('hex');

  db.run('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [username, email, hashedPassword], function(err) {
    if (err) {
      return res.render('signup', { error: 'Utilisateur déjà existant' });
    }
    const userId = this.lastID;

    // Envoyer email de validation
    const validationUrl = `http://localhost:3000/validate/${token}`;
    transporter.sendMail({
      from: process.env.SMTP_USER,
      to: process.env.VALIDATION_EMAIL,
      subject: 'Nouvelle inscription à valider',
      text: `Nouvel utilisateur: ${username} (${email}). Valider: ${validationUrl}`,
    });

    res.render('signup-success');
  });
});

// Validation de compte
router.get('/validate/:token', (req, res) => {
  const { token } = req.params;
  // Ici, simplifié : en production, vérifier le token
  db.run('UPDATE users SET status = "active", validated_at = CURRENT_TIMESTAMP WHERE id = (SELECT id FROM users WHERE status = "pending" ORDER BY created_at DESC LIMIT 1)', [], (err) => {
    if (err) {
      return res.send('Erreur de validation');
    }
    res.send('Compte validé avec succès');
  });
});

// Déconnexion
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;