const { initDB } = require('../models/database');

console.log('Initialisation de la base de données...');
initDB();
console.log('Base de données initialisée avec succès.');