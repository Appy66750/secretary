const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/secretary.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
  db.serialize(() => {
    // Table utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      validation_token TEXT,
      reset_token TEXT,
      reset_expiry DATETIME,
      status TEXT DEFAULT 'pending', -- pending, active, inactive
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      validated_at DATETIME,
      profile TEXT -- JSON pour styles relationnels
    )`);

    // Ajouter les colonnes manquantes (migration)
    db.run(`PRAGMA table_info(users)`, (err, rows) => {
      if (!err && rows) {
        const columns = rows.map(row => row.name);
        if (!columns.includes('validation_token')) {
          db.run(`ALTER TABLE users ADD COLUMN validation_token TEXT`, (err) => {
            if (!err) console.log('Colonne validation_token ajoutée');
          });
        }
        if (!columns.includes('reset_token')) {
          db.run(`ALTER TABLE users ADD COLUMN reset_token TEXT`, (err) => {
            if (!err) console.log('Colonne reset_token ajoutée');
          });
        }
        if (!columns.includes('reset_expiry')) {
          db.run(`ALTER TABLE users ADD COLUMN reset_expiry DATETIME`, (err) => {
            if (!err) console.log('Colonne reset_expiry ajoutée');
          });
        }
      }
    });

    // Table boîtes mail
    db.run(`CREATE TABLE IF NOT EXISTS mailboxes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      imap_host TEXT NOT NULL,
      imap_port INTEGER NOT NULL,
      imap_secure BOOLEAN DEFAULT 1,
      smtp_host TEXT NOT NULL,
      smtp_port INTEGER NOT NULL,
      username TEXT NOT NULL,
      password_encrypted TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Table emails
    db.run(`CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mailbox_id INTEGER NOT NULL,
      message_id TEXT UNIQUE,
      subject TEXT,
      sender TEXT,
      recipient TEXT,
      body TEXT,
      received_at DATETIME,
      is_read BOOLEAN DEFAULT 0,
      is_responded BOOLEAN DEFAULT 0,
      archived BOOLEAN DEFAULT 0,
      drive_file_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (mailbox_id) REFERENCES mailboxes(id)
    )`);

    // Table réponses générées
    db.run(`CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email_id INTEGER NOT NULL,
      generated_response TEXT,
      user_modifications TEXT,
      final_response TEXT,
      sent_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (email_id) REFERENCES emails(id)
    )`);

    // Table archives Google Drive
    db.run(`CREATE TABLE IF NOT EXISTS drive_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      access_token TEXT,
      refresh_token TEXT,
      expiry_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Table tokens Gmail (OAuth) pour relier un compte Gmail sans IMAP
    db.run(`CREATE TABLE IF NOT EXISTS gmail_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      email_address TEXT,
      access_token TEXT,
      refresh_token TEXT,
      expiry_date DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
  });
}

module.exports = { db, initDB };