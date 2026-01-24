const jwt = require('jsonwebtoken'); // Importing jsonwebtoken library

//Taking HttpOnly cookie over bearerToken
function getToken(req) {
    const cookieToken = req.cookies?.token || null;
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith('Bearer ')
    ? header.split(' ')[1] : null;
    return cookieToken || bearerToken;
}
function verifyToken(req, res, next) {
    // Check cookies first, then check the Authorization header
    let token = req.cookies.token;
    
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
}

//isAdmin guard
function isAdmin(req, res, next) {
    if (req.user?.role ==='admin') return next();
    return res.status(403).json({message: 'Access denied: Admiin Only'})
}
module.exports = {verifyToken, isAdmin}