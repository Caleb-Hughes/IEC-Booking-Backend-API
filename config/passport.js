const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

//Configuring Google strategy for passport
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/api/auth/google/callback',
},
    //async callback runs after Google approves user and returns their profile
    async(accessToken, refreshToken, profile, done) => {
    try {
        //extracting email from Google profil
        const email = profile.emails[0].value;
        //checking to see if user exists in database
        const existingUser = await User.findOne({email});

        //If existing user, complete login and attach user to session
        if (existingUser) {
            return done(null, existingUser);
        }
        //If user doesn't exist create a new user with Google information
        const newUser = new User({
            name: profile.displayName, //pulling name
            email, //pulling email
            password: null, //no password since google Oauth
            role: 'client', //Defaulting role as client
            verified: true, //no need for verification since using google Oauth
        });
        //saving new user to database
        await newUser.save();

        //completing login
        done(null, newUser);
    } catch (error) { //passing errors through passport for handling
        done(error, null)

    }}));

//Serialize user ot store in session
passport.serializeUser((user, done) => {
    done(null, user.id);
});

//Deserialize user from session using storied ID and fetching user from database
passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});