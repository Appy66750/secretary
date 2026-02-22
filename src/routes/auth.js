const express = require('express');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { db } = require('../models/database');
const router = express.Router();

// Configuration email de validation - utiliser variables d'environnement
let transporter = null;

// Initialiser le transporter avec la configuration SMTP réelle
if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  console.log(`📧 Transporter configuré avec ${process.env.SMTP_HOST}`);
} else {
  console.warn('⚠️  Variables SMTP non configurées dans .env');
}

// Fonction pour envoyer les emails
function sendEmail(to, subject, html) {
  if (!transporter) {
    console.error('❌ Transporter non initialisé');
    return Promise.reject(new Error('Transporter non initialisé'));
  }

  return transporter.sendMail({
    from: process.env.SMTP_USER || 'secretary@example.com',
    to,
    subject,
    html,
  }).then(info => {
    console.log('✅ Email envoyé à:', to);
    console.log('Message ID:', info.messageId);
    return info;
  }).catch(err => {
    console.error('❌ Erreur envoi email:', err.message);
    throw err;
  });
}

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

  console.log('Tentative inscription:', { username, email, passwordLength: password?.length });

  // Validation des champs
  if (!username || !email || !password) {
    return res.render('signup', { error: 'Tous les champs sont requis' });
  }

  if (password.length < 6) {
    return res.render('signup', { error: 'Le mot de passe doit contenir au moins 6 caractères' });
  }

  // Validation d'email plus simple
  if (!email.includes('@') || !email.includes('.')) {
    return res.render('signup', { error: 'L\'adresse email n\'est pas valide' });
  }

  if (username.length < 3) {
    return res.render('signup', { error: 'Le nom d\'utilisateur doit contenir au moins 3 caractères' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const validationToken = crypto.randomBytes(32).toString('hex');

    db.run('INSERT INTO users (username, email, password_hash, validation_token, status) VALUES (?, ?, ?, ?, ?)', [username, email, hashedPassword, validationToken, 'pending'], function(err) {
      if (err) {
        console.error('Erreur DB:', err.message);
        let errorMsg = 'Erreur lors de l\'inscription';
        if (err.message.includes('UNIQUE constraint failed: users.username')) {
          errorMsg = 'Ce nom d\'utilisateur existe déjà. Essayez un autre.';
        } else if (err.message.includes('UNIQUE constraint failed: users.email')) {
          errorMsg = 'Cet email est déjà utilisé. <a href="/login">Se connecter</a> ou utiliser un autre email.';
        }
        return res.render('signup', { error: errorMsg });
      }

      console.log('Utilisateur créé, envoi email admin...');
      // Envoyer email à L'ADMIN pour validation
      const adminValidationUrl = `http://localhost:3000/admin/validate-user/${validationToken}`;
      sendEmail(
        process.env.ADMIN_EMAIL || 'cyril.petillon@icloud.com',
        'Nouvelle inscription à valider - Secrétaire IA',
        `
          <h2>Nouvelle inscription à valider</h2>
          <p><strong>Utilisateur:</strong> ${username}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><a href="${adminValidationUrl}" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Valider cet utilisateur</a></p>
          <p>Ou copiez ce lien: ${adminValidationUrl}</p>
        `
      ).catch(err => console.error('Erreur envoi email admin:', err.message));

      res.render('signup-success');
    });
  } catch (error) {
    console.error('Erreur inscription:', error);
    res.render('signup', { error: 'Erreur serveur lors de l\'inscription' });
  }
});

// Validation de compte PAR L'ADMIN
router.get('/admin/validate-user/:token', (req, res) => {
  const { token } = req.params;
  
  // Récupérer l'utilisateur avec ce token
  db.get('SELECT id, username, email FROM users WHERE validation_token = ? AND status = "pending"', [token], (getErr, user) => {
    if (getErr || !user) {
      return res.send('Erreur: token invalide ou utilisateur déjà validé');
    }

    // Valider l'utilisateur
    db.run('UPDATE users SET status = "active", validated_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id], (updateErr) => {
      if (updateErr) {
        return res.send('Erreur lors de la validation');
      }

      console.log('Utilisateur validé, envoi email de confirmation...');
      
      // Envoyer EMAIL À L'UTILISATEUR pour confirmer
      sendEmail(
        user.email,
        'Votre inscription a été approuvée - Secrétaire IA',
        `
          <h2>Bienvenue ${user.username}! ✓</h2>
          <p>Votre inscription a été approuvée par l'administrateur.</p>
          <p>Vous pouvez maintenant vous connecter à votre compte.</p>
          <p><a href="http://localhost:3000/login" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Aller à la connexion</a></p>
        `
      ).catch(err => console.error('Erreur envoi email utilisateur:', err.message));

      res.send(`
        <h2>Utilisateur validé avec succès!</h2>
        <p>Un email de confirmation a été envoyé à: <strong>${user.email}</strong></p>
        <p><a href="/login">Retour à la connexion</a></p>
      `);
    });
  });
});

// Page mot de passe oublié
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', { error: null, message: null });
});

// Demande réinitialisation mot de passe
router.post('/forgot-password', (req, res) => {
  const { email } = req.body;

  console.log('Demande mot de passe oublié pour:', email);

  if (!email) {
    return res.render('forgot-password', { error: 'Veuillez entrer votre email', message: null });
  }

  db.get('SELECT id FROM users WHERE email = ?', [email], (err, user) => {
    if (err) {
      console.error('Erreur DB lors de la recherche:', err.message);
    }
    if (!user) {
      console.log('Utilisateur non trouvé:', email);
      // Ne pas révéler si l'email existe ou non pour la sécurité
      return res.render('forgot-password', { 
        error: null,
        message: 'Si cet email existe dans notre système, un lien de réinitialisation sera envoyé.' 
      });
    }

    console.log('Utilisateur trouvé, génération token...');
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 heure

    db.run('UPDATE users SET reset_token = ?, reset_expiry = ? WHERE id = ?', 
      [resetToken, resetExpiry, user.id], (updateErr) => {
      
      if (updateErr) {
        console.error('Erreur mise à jour token:', updateErr.message);
      } else {
        console.log('Token sauvegardé, envoi email...');
      }

      if (!updateErr) {
        const resetUrl = `http://localhost:3000/reset-password/${resetToken}`;
        sendEmail(
          email,
          'Réinitialisation de votre mot de passe - Secrétaire IA',
          `
            <h2>Réinitialisation du mot de passe</h2>
            <p>Vous avez demandé une réinitialisation de mot de passe.</p>
            <p><a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Réinitialiser le mot de passe</a></p>
            <p>Ce lien expire dans 1 heure.</p>
            <p>Ou copiez ce lien: ${resetUrl}</p>
          `
        ).catch(err => console.error('Erreur envoi email réinitialisation:', err.message));
      }
      
      res.render('forgot-password', { 
        error: null,
        message: 'Si cet email existe dans notre système, un lien de réinitialisation sera envoyé.' 
      });
    });
  });
});

// Page réinitialisation mot de passe
router.get('/reset-password/:token', (req, res) => {
  const { token } = req.params;
  
  db.get('SELECT id FROM users WHERE reset_token = ? AND reset_expiry > datetime("now")', [token], (err, user) => {
    if (err || !user) {
      return res.render('reset-password', { error: 'Lien invalide ou expiré', token: null });
    }
    res.render('reset-password', { error: null, token });
  });
});

// Traiter la réinitialisation
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password, passwordConfirm } = req.body;

  if (!password || !passwordConfirm) {
    return res.render('reset-password', { error: 'Tous les champs sont requis', token });
  }

  if (password !== passwordConfirm) {
    return res.render('reset-password', { error: 'Les mots de passe ne correspondent pas', token });
  }

  if (password.length < 6) {
    return res.render('reset-password', { error: 'Le mot de passe doit contenir au moins 6 caractères', token });
  }

  db.get('SELECT id, email FROM users WHERE reset_token = ? AND reset_expiry > datetime("now")', [token], async (err, user) => {
    if (err || !user) {
      return res.render('reset-password', { error: 'Lien invalide ou expiré', token });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    db.run('UPDATE users SET password_hash = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?', 
      [hashedPassword, user.id], (updateErr) => {
      
      if (updateErr) {
        return res.render('reset-password', { error: 'Erreur lors de la réinitialisation', token });
      }

      // Envoyer email de confirmation
      sendEmail(
        user.email,
        'Mot de passe réinitialisé - Secrétaire IA',
        `
          <h2>Votre mot de passe a été réinitialisé ✓</h2>
          <p>Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
          <p><a href="http://localhost:3000/login" style="background-color: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Aller à la connexion</a></p>
        `
      ).catch(err => console.error('Erreur envoi email confirmation:', err.message));

      res.render('reset-password-success');
    });
  });
});

// Déconnexion
router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;