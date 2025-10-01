const dotenv = require('dotenv');
dotenv.config()
require('./config/database.js')

const express = require('express');
const app = express();
const methodOverride = require('method-override');
const morgan = require('morgan')
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const moment = require('moment');
const PORT = process.env.PORT || 3000;
const isSignedIn = require('./middleware/is-signed-in.js')
const passUserToView = require('./middleware/pass-user-to-view.js')

// Import Controllers
// const authRoutes = require('./controllers/auth');
const authRoutes = require('./routes/auth');
const workoutRoutes = require('./routes/workouts');
const dashboardRoutes = require('./routes/dashboard');

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(morgan('dev'))

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
    }),
  })
);


// Make moment available in templates
app.locals.moment = moment;

// Public
app.use('/auth', authRoutes);

// Protected Routes
app.use(isSignedIn)
app.use(passUserToView)
app.get('/', (req, res) => {
    res.redirect('/dashboard');
});

app.use('/workouts', workoutRoutes);
app.use('/dashboard', dashboardRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

// Error handler
// app.use((err, req, res, next) => {
//   console.error(err.stack);
//   res.status(500).render('error', { 
//     title: 'Server Error', 
//     error: process.env.NODE_ENV === 'production' ? {} : err 
//   });
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});