const express = require('express');
const router = express.Router();
const { loginPharma, updateOrderStatus } = require('../controllers/pharmacy.js');
const { check, validationResult } = require('express-validator');
const { authenticateToken, authenticateRefreshToken } = require('../middleware/session-authentication-middleware');

router.post(
    '/login',
    [
        check('email', 'Email cannot be empty').notEmpty(),
        check('email', 'Email is not Valid')
            .matches(/.+\@.+\..+/)
            .isLength({ min: 4, max: 35 }),
        check('password', 'Password is required').notEmpty(),
        check('password', 'Password must contain 6 characters').isLength({ min: 6, max: 64 }),
        check('password', 'Password must contain a digit').matches(/\d/),
    ],
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, error: errors.array() });
            return;
        }

        next();
    },
    loginPharma
);

router.post('/updateOrderStatus', (req, res, next) => authenticateToken('pharma', req, res, next), updateOrderStatus);

router.get('/logout', (req, res) => {
    res.clearCookie('jwt_pharma');
    return res.json({ success: true, message: 'Signout success!' });
});

router.post('/auth/refresh', authenticateRefreshToken('pharma'));

module.exports = router;
