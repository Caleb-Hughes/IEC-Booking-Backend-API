const jwt = require('jsonwebtoken'); // Importing jsobwebtoken library

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization; //retrieving authorization header from request

    if (!authHeader || !authHeader.startswith('Bearer ')) {
        return res.status(401).json({message: 'Unauthorized: No token provided'});
    }
    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({message: 'Unauthorized: Invalid token'});
    }
}
module.exports = verifyToken;