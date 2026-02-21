const crypto = require('crypto');

const key = crypto.randomBytes(32).toString('hex');
console.log('Clé de chiffrement générée :', key);
console.log('Ajoutez-la à votre .env sous ENCRYPTION_KEY');