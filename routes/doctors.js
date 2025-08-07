const express = require('express');
const router = express.Router();
const { loginDoctors, addNewPatient } = require('../controllers/doctors');
const { check, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/session-authentication-middleware')

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
    loginDoctors
);

router.get('/logout', (req, res) => {
    res.clearCookie('jwt_doctor');
    return res.json({ success: true, message: 'Signout success!' });
});

router.post(
    '/addNewPatient',
    [
        check('email', 'Email cannot be empty').notEmpty(),
        check('email', 'Email is not Valid')
            .matches(/.+\@.+\..+/)
            .isLength({ min: 4, max: 35 }),
        check('firstName', 'First Name is required').notEmpty(),
        check('firstName', 'First Name must contain 6 characters').isLength({ min: 2, max: 64 }),
        check('lastName', 'Last Name is required').notEmpty(),
        check('lastName', 'Last Name must contain 6 characters').isLength({ min: 2, max: 64 }),
        check('password', 'Password is required').notEmpty(),
        check('password', 'Password must contain 6 characters').isLength({ min: 6, max: 64 }),
        check('password', 'Password must contain a digit').matches(/\d/),
    ],
    (res, req, next) => authenticateToken('doctor', res, req, next),
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, error: errors.array() });
            return;
        }
        next();
    },
    addNewPatient
);

module.exports = router;
