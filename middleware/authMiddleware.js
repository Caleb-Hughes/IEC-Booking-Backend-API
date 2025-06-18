const jwt = require('jsonwebtoken'); // Importing jsonwebtoken library

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization; // Retrieving authorization header

    // Check if token is missing or not formatted correctly
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Unauthorized: No token provided' });
    }

    const token = authHeader.split(' ')[1]; // Extract token after "Bearer"

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET); // Make sure to use JWT_SECRET, not SECRET
        req.user = decoded; // Attach decoded user info to request object
        next(); // Proceed to next middleware or route
    } catch (error) {
        return res.status(401).json({ message: 'Unauthorized: Invalid token' });
    }
}
function isAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        return res.status(403).json({ message: 'Access denied: Admin only' });
    }
}

module.exports = {
    verifyToken,
    isAdmin,
};