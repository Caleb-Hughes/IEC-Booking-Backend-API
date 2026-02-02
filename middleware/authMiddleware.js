const jwt = require('jsonwebtoken'); // Importing jsonwebtoken library

//Taking HttpOnly cookie over bearerToken
function getToken(req) {
   // 1. Check for cookie 
    if (req.cookies && req.cookies.token) {
        return req.cookies.token;
    }
    //Check for Authorization header
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
        return header.split(' ')[1];
    }
    return null;
}
function verifyToken(req, res, next) {
    // Check cookies first, then check the Authorization header
    const token = getToken(req)
    
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
}

//isAdmin guard
function isAdmin(req, res, next) {
    if (req.user?.role ==='admin') return next();
    return res.status(403).json({message: 'Access denied: Admin Only'})
}
module.exports = {verifyToken, isAdmin}