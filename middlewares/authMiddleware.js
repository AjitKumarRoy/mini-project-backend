const { verifyToken } = require('../utils/jwt');

const authMiddleware = (req, res, next) => {
    const tokenFromCookie = req.cookies.token;
    const tokenFromHeader = req.headers.authorization?.split(' ')[1];
    // console.log('Token from cookie:', tokenFromCookie);
    // console.log('Token from header:', tokenFromHeader);

    const token = tokenFromCookie || tokenFromHeader;
    // const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ 'message': 'Access denied. No token provided.' });
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(400).json({ 'message': 'Invalid token.' });
    }
};

module.exports = authMiddleware;