const express = require('express');
const router = express.Router();
const {verifyToken} = require('../middleware/authMiddleware');

router.get('/', verifyToken, (req, res) => {
    res.status(200).json({
        message: 'Welcome to Your Profile!',
        User: req.user
    });
});

module.exports = router;
