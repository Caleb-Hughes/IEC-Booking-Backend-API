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
    const Token = getToken(req);
    if (!token) {
        return res.status(401).json({message: 'Unauthroized: No token provided'});
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // {id, role, etc}
        next();
    } catch (err) {
        return res.status(401).json({message: 'Unauthorized: Invalid or expired token'});
    }
}

//isAdmin guard
function isAdmin(req, res, next) {
    if (req.user?.role ==='admin') return next();
    return res.status(403).json({message: 'Access denied: Admiin Only'})
}
module.exports = {verifyToken, isAdmin}