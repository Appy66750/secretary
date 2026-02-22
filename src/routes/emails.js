const express = require('express');
const { db } = require('../models/database');
const { fetchEmails, sendEmail, decryptPassword } = require('../utils/email');
const { generateResponse } = require('../utils/ollama');
const { setCredentials, findOrCreateRootFolder, createSubFolder, uploadFile } = require('../utils/drive');
const fs = require('fs');
const path = require('path');
const router = express.Router();

// Middleware d'authentification
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

router.use(requireAuth);

// Liste des emails
router.get('/', (req, res) => {
  const userId = req.session.userId;
  const mailboxId = req.query.mailbox;

  let query = `
    SELECT e.*, m.name as mailbox_name
    FROM emails e
    JOIN mailboxes m ON e.mailbox_id = m.id
    WHERE m.user_id = ?
  `;
  const params = [userId];

  if (mailboxId) {
    query += ' AND e.mailbox_id = ?';
    params.push(mailboxId);
  }

  query += ' ORDER BY e.received_at DESC';

  db.all(query, params, (err, emails) => {
    db.all('SELECT * FROM mailboxes WHERE user_id = ?', [userId], (err, mailboxes) => {
      res.render('emails', { emails: emails, mailboxes: mailboxes, selectedMailbox: mailboxId });
    });
  });
});

// Synchroniser les emails
router.post('/sync', async (req, res) => {
  const userId = req.session.userId;
  const mailboxes = await new Promise((resolve, reject) => {
    db.all('SELECT * FROM mailboxes WHERE user_id = ?', [userId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });

  for (const mailbox of mailboxes) {
    const encrypted = JSON.parse(mailbox.password_encrypted);
    const password = decryptPassword(encrypted.encryptedData, encrypted.iv, encrypted.authTag);

    const config = {
      imap_host: mailbox.imap_host,
      imap_port: mailbox.imap_port,
      imap_secure: mailbox.imap_secure,
      username: mailbox.username,
      password: password,
    };

    const emails = await fetchEmails(config);

    for (const email of emails) {
      db.run('INSERT OR IGNORE INTO emails (mailbox_id, message_id, subject, sender, recipient, body, received_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [mailbox.id, email.messageId, email.subject, email.sender, email.recipient, email.body, email.receivedAt]);
    }
  }

  res.redirect('/emails');
});

// Générer réponse
router.post('/generate/:id', async (req, res) => {
  const emailId = req.params.id;
  const userId = req.session.userId;

  db.get('SELECT e.*, m.username, m.password_encrypted FROM emails e JOIN mailboxes m ON e.mailbox_id = m.id WHERE e.id = ? AND m.user_id = ?', [emailId, userId], async (err, email) => {
    if (!email) return res.status(404).send('Email non trouvé');

    const profile = JSON.parse((await new Promise((resolve) => {
      db.get('SELECT profile FROM users WHERE id = ?', [userId], (err, user) => resolve(user.profile || '{}'));
    })) || '{}');

    const response = await generateResponse(email.body, profile);

    db.run('INSERT INTO responses (email_id, generated_response) VALUES (?, ?)', [emailId, response]);

    res.json({ response: response });
  });
});

// Envoyer réponse
router.post('/send/:id', async (req, res) => {
  try {
    const emailId = req.params.id;
    const { response } = req.body;
    const userId = req.session.userId;

    db.get('SELECT e.*, m.* FROM emails e JOIN mailboxes m ON e.mailbox_id = m.id WHERE e.id = ? AND m.user_id = ?', [emailId, userId], async (err, email) => {
      if (err) {
        console.error('Erreur avec la base de données:', err);
        return res.status(500).send('Erreur base de données');
      }
      if (!email) return res.status(404).send('Email non trouvé');

      const encrypted = JSON.parse(email.password_encrypted);
      const password = decryptPassword(encrypted.encryptedData, encrypted.iv, encrypted.authTag);

      const config = {
        smtp_host: email.smtp_host,
        smtp_port: email.smtp_port,
        username: email.username,
        password: password,
      };

      const sendResult = await sendEmail(config, email.sender, `Re: ${email.subject}`, response);
      
      if (!sendResult.success) {
        console.error('Erreur lors de l\'envoi:', sendResult.error);
        return res.status(500).send(`Erreur lors de l'envoi: ${sendResult.error}`);
      }

      db.run('UPDATE emails SET is_responded = 1 WHERE id = ?', [emailId]);
      db.run('INSERT INTO responses (email_id, final_response, sent_at) VALUES (?, ?, CURRENT_TIMESTAMP)', [emailId, response]);

      // Archiver sur Drive
      await archiveToDrive(email, response, userId);

      res.redirect('/emails');
    });
  } catch (error) {
    console.error('Erreur lors du traitement:', error);
    res.status(500).send('Erreur lors du traitement');
  }
});

async function archiveToDrive(email, response, userId) {
  const tokens = await new Promise((resolve) => {
    db.get('SELECT * FROM drive_tokens WHERE user_id = ?', [userId], (err, token) => resolve(token));
  });

  if (!tokens) return;

  setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  });

  const rootFolderId = await findOrCreateRootFolder();
  const contactFolderId = await createSubFolder(email.sender, rootFolderId);

  // Créer fichier texte
  const content = `Sujet: ${email.subject}\nDe: ${email.sender}\nÀ: ${email.recipient}\n\nEmail original:\n${email.body}\n\nRéponse:\n${response}`;
  const filePath = path.join(__dirname, '../../temp', `email_${email.id}.txt`);
  fs.writeFileSync(filePath, content);

  const fileId = await uploadFile(filePath, `email_${email.id}.txt`, 'text/plain', contactFolderId);
  db.run('UPDATE emails SET archived = 1, drive_file_id = ? WHERE id = ?', [fileId, email.id]);

  fs.unlinkSync(filePath);
}

module.exports = router;