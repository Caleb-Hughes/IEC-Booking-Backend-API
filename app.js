// Load environment variables from .env
require('dotenv').config();

// Connect to MongoDB
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("✅ MongoDB connected");
}).catch(err => {
    console.error("❌ MongoDB connection error:", err);
});

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');

const indexRouter = require('./routes/index');
const usersRouter = require('./routes/users');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const serviceRouter = require('./routes/services');
const appointmentsRouter = require('./routes/appointments');
const stylistRoutes = require('./routes/stylists');

const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/services', serviceRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('api/stylists', stylistRoutes);

module.exports = app;
