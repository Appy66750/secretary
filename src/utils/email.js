const imaps = require('imap-simple');
const nodemailer = require('nodemailer');
const { encrypt, decrypt } = require('./encryption');

async function testImapConnection(config) {
  try {
    const connection = await imaps.connect({
      imap: {
        user: config.username,
        password: config.password,
        host: config.imap_host,
        port: config.imap_port,
        tls: config.imap_secure,
        authTimeout: 3000,
      },
    });
    await connection.end();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function fetchEmails(config, lastFetch = null) {
  const connection = await imaps.connect({
    imap: {
      user: config.username,
      password: config.password,
      host: config.imap_host,
      port: config.imap_port,
      tls: config.imap_secure,
    },
  });

  await connection.openBox('INBOX');

  const searchCriteria = lastFetch ? [['SINCE', lastFetch]] : ['UNSEEN'];
  const fetchOptions = {
    bodies: ['HEADER', 'TEXT'],
    markSeen: false,
  };

  const messages = await connection.search(searchCriteria, fetchOptions);

  const emails = messages.map((message) => {
    const header = message.parts.find((part) => part.which === 'HEADER');
    const text = message.parts.find((part) => part.which === 'TEXT');

    return {
      messageId: header.body['message-id'] ? header.body['message-id'][0] : null,
      subject: header.body.subject ? header.body.subject[0] : '',
      sender: header.body.from ? header.body.from[0] : '',
      recipient: header.body.to ? header.body.to[0] : '',
      body: text.body,
      receivedAt: header.body.date ? new Date(header.body.date[0]) : new Date(),
    };
  });

  await connection.end();
  return emails;
}

async function sendEmail(config, to, subject, body) {
  try {
    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_port === 465,
      auth: {
        user: config.username,
        pass: config.password,
      },
    });

    const mailOptions = {
      from: config.username,
      to: to,
      subject: subject,
      text: body,
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'envoi de l\'email:', error);
    return { success: false, error: error.message };
  }
}

function decryptPassword(encryptedData, iv, authTag) {
  return decrypt(encryptedData, iv, authTag);
}

function encryptPassword(password) {
  return encrypt(password);
}

module.exports = {
  testImapConnection,
  fetchEmails,
  sendEmail,
  decryptPassword,
  encryptPassword,
};