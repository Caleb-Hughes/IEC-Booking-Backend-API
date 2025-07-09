const express = require('express'); // importing express
const router = express.Router(); //Initializing router
const bcrypt = require('bcryptjs'); //Importing bcrypt for hashing passwords
const jwt = require('jsonwebtoken'); // Importing jwt for token creation
const {body, validationResult} = require('express-validator');
const User = require('../models/user');
const {verifyToken} = require('../middleware/authMiddleware');
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const passport = require('passport');


//post route for registration
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
        const {name, email, password, role} = req.body; // pulling variables from request body
        const existingUser = await User.findOne({email}); //checking for existing user with matching email
        if (existingUser) { //If user already registered send error message
            console.log("Email already in database");
            return res.status(400).send({message: 'Email already in use'});
        }
        //Create hashed password from original password
        const hashedPassword = await bcrypt.hash(password, 10);
        //creating unique verification Token for email verification
        const verificationToken = crypto.randomBytes(32).toString('hex');
        //create new instance of user model with hashed password and verified as false to ensure email verification
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'client',
            verificationToken,
            verified: false
        });
        await newUser.save(); //saving new User in users collection/database
        //creating verification link, once clicked user will be marked as verified
        const verificationLink = `http://localhost:3000/api/auth/verify-email?token=${verificationToken}`;
        //sending email with verification link
        await sendEmail({
            to: newUser.email,
            subject: 'Verify your Email - IEC',
            text: `Hello ${newUser.name}, please verify your email by clicking this link: ${verificationLink}`,
            html: `<p>Hello ${newUser.name},</p>
                       <p>Please verify your email by clicking the link below:</p>
                       <a href="${verificationLink}">Verify Email</a>`
        });

        const token = jwt.sign( //creating a token that will expire after 2hrs of being signed in
            {id: newUser.id, role: newUser.role},
            process.env.JWT_SECRET,
            {expiresIn: '2h'}
        );

        console.log("Successful registration")
        return res.status(201).json({message: 'User registered successfully',
        token: token,
        user: {
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        }
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({message: 'Internal server error'});
    }
});

router.get('/verify-email', async (req, res) => {
    const {token} = req.query

    try {
        const user = await User.findOne({verificationToken: token});

        if (!user) {
            return res.status(400).json({message: 'Invalid or expired verification token.'})
        }
        //Marking user as verified and clearing token
        user.verified = true;
        user.verificationToken = undefined;
        await user.save();

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
        const {email, password} = req.body; //pulling variables from request body

        const user = await User.findOne({email}); //looking for user with matching email
        //if email not found return error message
        if (!user) {
            console.log("Email not found")
            return res.status(400).send({message: 'Invalid email or password'});
        }
        const isMatch = await bcrypt.compare(password, user.password); //checking to see if hashed password and entered password match
        if (!isMatch) {
            console.log("Password does not match")
            return res.status(400).send({message: 'Invalid email or password'});
        }
        if (!user.verified) {
            return res.status(403).json({message: 'Please verify your email before logging in'});
        }
         const token = jwt.sign( //creating a token that will expire after 2hrs of being signed in
             {id: user.id, role: user.role},
             process.env.JWT_SECRET,
             {expiresIn: '2h'}
         );
        res.status(200).json({
            message: 'Successfully logged in',
            token,
            user: {
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
    res.redirect('/dashboard');
    }
);
module.exports = router;