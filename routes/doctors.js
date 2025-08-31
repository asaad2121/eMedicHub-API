const express = require('express');
const router = express.Router();
const { loginDoctors, addNewPatientPost, addNewPatientGet } = require('../controllers/doctors');
const { check, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/session-authentication-middleware');

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

router.get('/addNewPatient', (req, res, next) => authenticateToken('doctor', req, res, next), addNewPatientGet);

router.post(
    '/addNewPatient',
    [
        check('id', 'Patient ID cannot be empty').notEmpty(),
        check('id', 'Patient ID must contain 7 characters').isLength({ min: 7, max: 9 }),
        check('email', 'Email cannot be empty').notEmpty(),
        check('email', 'Email is not Valid')
            .matches(/.+\@.+\..+/)
            .isLength({ min: 4, max: 35 }),
        check('first_name', 'First Name is required').notEmpty(),
        check('first_name', 'First Name must contain 2 characters').isLength({ min: 2, max: 64 }),
        check('last_name', 'Last Name is required').notEmpty(),
        check('last_name', 'Last Name must contain 2 characters').isLength({ min: 2, max: 64 }),
        check('password', 'Password is required').notEmpty(),
        check('password', 'Password must contain 6 characters').isLength({ min: 6, max: 64 }),
        check('password', 'Password must contain a digit').matches(/\d/),
        check('blood_grp', 'Blood group is required').notEmpty(),
        check('phone_no', 'Phone number is required').notEmpty(),
        check('phone_no', 'Phone number must be exactly 10 digits eg 0221231234').matches(/^\d{10}$/),
        check('gp_id', 'GP ID is required').notEmpty(),
        check('id_type', 'Identification Type is required').notEmpty(),
        check('id_number', 'Identification Number is required').notEmpty(),
    ],
    (req, res, next) => authenticateToken('doctor', req, res, next),
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, error: errors.array() });
            return;
        }
        next();
    },
    addNewPatientPost
);

// router.get('/getDoctors', getAllDoctors);

module.exports = router;
