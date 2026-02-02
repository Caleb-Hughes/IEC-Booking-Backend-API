const express = require('express'); // importing express
const router = express.Router(); //Initializing router
const bcrypt = require('bcryptjs'); //Importing bcrypt for hashing passwords
const jwt = require('jsonwebtoken'); // Importing jwt for token creation
const {body, validationResult} = require('express-validator');
const prisma = require("../db/prisma")
const {verifyToken} = require('../middleware/authMiddleware');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const passport = require('passport');

//Helpers
function signToken(user) {
    return jwt.sign(
        {id: user.id, role: user.role},
        process.env.JWT_SECRET,
        {expiresIn: "2h"}
    );
}

function setAuthCookie(res, token) {
    res.cookie("token", token, {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAMESITE || "lax",
        secure: process.env.COOKIE_SAMESITE == "none" ? true: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 2,
    });
}
//post router for registration
router.post('/register',
    [
        body('name').notEmpty().withMessage('Name is required'),
        body('email').isEmail().withMessage('Valid email is required'),
        body('password').isLength({min: 6}).withMessage('Password must be at least 6 characters'),
    ],
    async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({errors: errors.array()});
    }
    try {
        const name = String(req.body.name || "").trim();
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");

        const existingUser = await prisma.user.findUnique({where: {email}}); //checking for existing user with matching email
        if (existingUser) { //If user already registered send error message
            console.log("Email already in database");
            return res.status(400).send({message: 'Email already in use'});
        }
        //Create hashed password from original password
        const hashedPassword = await bcrypt.hash(password, 10);
        //creating unique verification Token for email verification
        const verificationToken = crypto.randomBytes(32).toString('hex');
        //create new instance of user model with hashed password and verified as false to ensure email verification
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: "client",
                verified: false,
                verificationToken: verificationToken
            },
            select: {id: true, name: true, email: true, role: true}
        });

        const baseUrl = process.env.API_BASE_URL || "http://localhost:3000";
        //creating verification link, once clicked user will be marked as verified
        const verificationLink = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;
        //sending email with verification link
        await sendEmail({
            to: newUser.email,
            subject: 'Verify your Email - IEC',
            text: `Hello ${newUser.name}, please verify your email by clicking this link: ${verificationLink}`,
            html: `<p>Hello ${newUser.name},</p>
                       <p>Please verify your email by clicking the link below:</p>
                       <a href="${verificationLink}">Verify Email</a>`
        });

        const token = signToken(newUser);
        setAuthCookie(res, token);

        console.log("Successful registration")
        return res.status(201).json({message: 'User registered successfully',
            user: {
                id: newUser.id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error("Register error:", error);
        const msg = error?.message || "Internal server error";
            
        return res.status(500).json({message: msg})
    }
});

router.get('/verify-email', async (req, res) => {
    const token = String(req.query.token || "");

    try {
        const user = await prisma.user.findUnique({
            where: {verificationToken: token},
            select: {id: true}
        });

        if (!user) {
            return res.status(400).json({message: 'Invalid or expired verification token.'})
        }
        //Marking user as verified and clearing token
        await prisma.user.update({
            where: {id: user.id},
            data: {
                verified: true,
                verificationToken: null, //clearing token
            }
        })

        res.status(200).json({message: 'Email verified successfully'});
    } catch (error) {
        console.error('Error during verification', error);
        return res.status(500).json({message: 'Internal server error'});
    }
})
//post route for login
router.post('/login',
    [
        body('email').isEmail().withMessage('Valid email required'),
        body('password').notEmpty().withMessage('Password is required'),
    ],
    async (req, res) => {
    try {
         //pulling variables from request body
        const email = String(req.body.email || "").trim().toLowerCase();
        const password = String(req.body.password || "");
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

        const user = await prisma.user.findUnique({where: {email}}); //looking for user with matching email
        //if email not found return error message
        if (!user || !user.password) {
            console.log("Email not found")
            return res.status(400).send({message: 'Invalid Email or password'});
        }
        const isMatch = await bcrypt.compare(password, user.password); //checking to see if hashed password and entered password match
        if (!isMatch) {
            console.log("Password does not match")
            return res.status(400).send({message: 'Invalid email or password'});
        }
        if (!user.verified) {
            return res.status(403).json({message: 'Please verify your email before logging in'});
        }
        const token = signToken(user);
        setAuthCookie(res, token)
         
        res.status(200).json({
            message: 'Successfully logged in',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({message: 'Internal server error'});
    }
});
router.get('/profile', verifyToken, (req, res) => {
    res.status(200).json({
        message: 'Successfully logged in',
        user: req.user
    });
});
//route to start Google OAuth login process
router.get('/google',
    passport.authenticate('google', {scope: ['profile', 'email']})
);
//router to handle callback once user logged in
router.get('/google/callback',
    passport.authenticate('google', {failureRedirect: '/login'}),
    (req, res) => {
    const token = jwt.sign(

        {id: req.user.id, role: req.user.role },
        process.env.JWT_SECRET,
        {expiresIn: '2h'}
    );
    
    setAuthCookie(res, token);
    res.redirect(process.env.CLIENT_URL + '/oauth-success');
  }
);
//Router to return user ('who am i' router)
router.get('/me', verifyToken, async (req, res) => {
    res.json({user: req.user});
});

//Route for logout
router.post('/logout', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        sameSite: process.env.COOKIE_SAMESITE || 'lax',
        secure: process.env.COOKIE_SAMESITE === 'none' ? true : (process.env.NODE_ENV === 'production')
    });
    res.status(200).json({ message: 'Logged out successfully' });
});
module.exports = router;