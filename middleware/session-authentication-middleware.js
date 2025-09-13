const jwt = require('jsonwebtoken');

const authenticateToken = (type, req, res, next) => {
    const token = req.cookies[`jwt_${type}`];

    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid token' });

        // Check if the token is about to expire (e.g., less than 5 minutes left)
        const expirationTime = user.exp * 1000;
        const currentTime = Date.now();
        const renewalThreshold = 5 * 60 * 1000; // 5 minutes

        if (expirationTime - currentTime < renewalThreshold) {
            const newToken = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '30m' });
            res.cookie(`jwt_${type}`, newToken, {
                httpOnly: true,
                maxAge: 1800000,
                secure: process.env.ENVIRONMENT === 'prod',
                sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
            });
        }

        req.user = user;
        next();
    });
};

const authenticateRefreshToken = (type) => (req, res) => {
    const token = req.cookies[`refresh_token_${type}`];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No refresh token provided.' });
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Forbidden: Invalid refresh token. Please log in again.' });
        }

        // Refresh token is valid, generate and set new tokens.
        const newAccessToken = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '30m' });
        const newRefreshToken = jwt.sign({ _id: user._id }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        res.cookie(`jwt_${type}`, newAccessToken, {
            httpOnly: true,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });

        res.cookie(`refresh_token_${type}`, newRefreshToken, {
            httpOnly: true,
            maxAge: 604800000,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });

        res.status(200).json({ success: true, message: 'Tokens refreshed successfully' });
    });
};

module.exports = {
    authenticateToken,
    authenticateRefreshToken
};
