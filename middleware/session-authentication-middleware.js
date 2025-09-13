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
                sameSite: 'None',
            });
        }

        req.user = user;
        next();
    });
};

module.exports = {
    authenticateToken,
};
