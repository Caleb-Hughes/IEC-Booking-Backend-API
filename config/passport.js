const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require("../db/prisma")
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
        const email = String(profile?.emails?.[0]?.value || "").trim().toLowerCase();

        if (!email) {
            return done(new Error("Google account has no email"), null);
        }

        //Try to find User by googleID
        const googleId = String(profile.id);

        let user = await prisma.user.findFirst({
            where: {
                OR: [{googleId}, {email}]
            }
        });
    
        //If existing user, complete login and attach user to session
        if (user && !user.googleId) {
            user = await prisma.user.update({
                where: {id: user.id},
                data: {
                    googleId,
                    verified: true,
                    verificationToken: null,
                },
            });
        }
        //If user doesn't exist create a new user with Google information
        if (!user) {
            user = await prisma.user.create({
                data: {
                    name: profile.displayName || "Google User",
                    email,
                    password: null,
                    role: "client",
                    verified: true,
                    verificationToken: null,
                    googleId,
                }
            });
        }
        //saving new user to database
        return done(null, user);
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
        const user = await prisma.user.findUnique({
            where: {id: String(id)}
        });
        done(null, user || null);
    } catch (error) {
        done(error, null);
    }
});