require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
const { initDB } = require('./models/database');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const mailboxesRoutes = require('./routes/mailboxes');
const emailsRoutes = require('./routes/emails');
const searchRoutes = require('./routes/search');
const adminRoutes = require('./routes/admin');
const driveRoutes = require('./routes/drive');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialiser la base de données
initDB();

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // En production, mettre true avec HTTPS
}));
app.use(express.static(path.join(__dirname, 'public')));

// Moteur de template
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', authRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/mailboxes', mailboxesRoutes);
app.use('/emails', emailsRoutes);
app.use('/search', searchRoutes);
app.use('/admin', adminRoutes);
app.use('/auth', driveRoutes);

// Route par défaut
app.get('/', (req, res) => {
  res.redirect('/login');
});

const server = app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} déjà utilisé — arrêtez l'autre processus ou changez la variable PORT.`);
    process.exit(1);
  }
  throw err;
});