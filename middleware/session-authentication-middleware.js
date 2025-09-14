const jwt = require('jsonwebtoken');
const { GetItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const authenticateToken = (type, req, res, next) => {
    const token = req.cookies[`jwt_${type}`];
    if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });

    jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Invalid token' });

        try {
            let tableName;
            if (user._id.startsWith('DOC')) tableName = 'Doctors';
            else if (user._id.startsWith('PAT')) tableName = 'Patients';
            else if (user._id.startsWith('PHAR')) tableName = 'Pharmacy';
            else return res.status(400).json({ success: false, message: 'Invalid user ID' });

            const getCmd = new GetItemCommand({
                TableName: tableName,
                Key: { id: { S: user._id } },
                ProjectionExpression: 'last_password_update_utc',
            });

            const result = await client.send(getCmd);
            const lastPwUpdateDb = result.Item?.last_password_update_utc?.S;

            if (lastPwUpdateDb) {
                const dbDate = new Date(lastPwUpdateDb).getTime();
                const tokenDate = new Date(user.lastPwUpdate || 0).getTime();
                if (dbDate > tokenDate) {
                    return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
                }
            }

            const expirationTime = user.exp * 1000;
            const currentTime = Date.now();
            const renewalThreshold = 5 * 60 * 1000; // 5 minutes

            if (expirationTime - currentTime < renewalThreshold) {
                const newToken = jwt.sign(
                    { _id: user._id, lastPwUpdate: lastPwUpdateDb || user.lastPwUpdate || null },
                    process.env.JWT_SECRET,
                    { expiresIn: '30m' }
                );
                res.cookie(`jwt_${type}`, newToken, {
                    httpOnly: true,
                    maxAge: 1800000,
                    secure: process.env.ENVIRONMENT === 'prod',
                    sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
                });
                req.user = jwt.decode(newToken);
                next();
            }

            req.user = user;
            next();
        } catch (e) {
            console.error('Auth check failed:', e);
            return res.status(500).json({ success: false, message: 'Internal server error' });
        }
    });
};

const authenticateRefreshToken = (type) => (req, res) => {
    const token = req.cookies[`refresh_token_${type}`];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Unauthorized: No refresh token provided.' });
    }

    jwt.verify(token, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err) {
            return res
                .status(403)
                .json({ success: false, message: 'Forbidden: Invalid refresh token. Please log in again.' });
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
    authenticateRefreshToken,
};
