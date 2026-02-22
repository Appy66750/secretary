const crypto = require('crypto');

const algorithm = 'aes-256-gcm';

// Attendre que ENCRYPTION_KEY soit disponible
let key = null;

function getKey() {
  if (!key) {
    if (!process.env.ENCRYPTION_KEY) {
      throw new Error('ENCRYPTION_KEY non défini dans .env');
    }
    key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  }
  return key;
}

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipherGCM(algorithm, getKey());
  cipher.setIV(iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return {
    encryptedData: encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

function decrypt(encryptedData, iv, authTag) {
  const decipher = crypto.createDecipherGCM(algorithm, getKey());
  decipher.setIV(Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encrypt, decrypt };