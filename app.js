require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const logger = require('morgan');
const session = require('express-session');
const passport = require('passport');
const isProd = process.env.NODE_ENV === 'production';

require('./config/passport');


const app = express();


app.set('trust proxy', 1);

// ----- CORS -----
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://iec-frontend-nine.vercel.app'  
];

app.use(cors({
  origin(origin, cb) {
    // allow tools like curl/postman (no origin) and whitelisted sites
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

//handle preflight explicitly
app.options('*', cors());

//Parsers & logging 
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ----- Session (if you use it) -----
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: isProd ? "none" : "lax",  // cross-site 
    secure: true        
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));

// Routes
const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const serviceRouter = require('./routes/services');
const appointmentsRouter = require('./routes/appointments');
const stylistRoutes = require('./routes/stylists');

app.use('/', indexRouter);
app.use('/api/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/services', serviceRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/stylists', stylistRoutes);

// Health check for Render
app.get('/health', (req, res) => res.send('ok'));

const setupReminderJob = require('./jobs/sendReminders');
setupReminderJob();

module.exports = app;