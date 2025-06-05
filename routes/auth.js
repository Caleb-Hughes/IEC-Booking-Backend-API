const express = require('express'); // importing express
const router = express.Router(); //Initializing router
const bcrypt = require('bcryptjs'); //Importing bcrypt for hashing passwords
const jwt = require('jsonwebtoken'); // Importing jwt for token creation
const User = require('../models/user');
const req = require("express/lib/request"); //importing user model
const verifyToken = require('../middleware/authMiddleware');

//post route for registration
router.post('/register', async (req, res) => {
    try {
        const {name, email, password, role} = req.body; // pulling variables from request body
        const existingUser = await User.findOne({email}); //checking for existing user with matching email
        if (existingUser) { //If user already registered send error message
            console.log("Email already in database");
            return res.status(400).send({message: 'Email already in use'});
        }
        //Create hashed password from original password
        const hashedPassword = await bcrypt.hash(password, 10);
        //create nwe instance of user model with hashed password
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: role || 'client'
        })
        await newUser.save(); //saving newUser in users collection

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
//post route for login
router.post('/login', async (req, res) => {
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

router.get('/profile', verifyToken, (req, res)  => {
    res.status(200).json({message: 'Successfully logged in',
    user: req.user});
});

module.exports = router;