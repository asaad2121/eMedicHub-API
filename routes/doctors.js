const express = require('express');
const router = express.Router();
const { loginDoctors, addNewPatientPost, addNewPatientGet, viewPatients } = require('../controllers/doctors');
const { check, validationResult } = require('express-validator');
const { authenticateToken, authenticateRefreshToken } = require('../middleware/session-authentication-middleware');
const { viewAppointments, viewAppointmentData } = require('../controllers/patients');
const { getUserProfile, resetPassword } = require('../controllers/userInfo');

router.post('/getUserProfile/:id', (req, res, next) => authenticateToken('doctor', req, res, next), getUserProfile);

router.post(
    '/resetPassword',
    [
        check('id', 'ID cannot be empty').notEmpty(),
        check('oldPassword', 'Old Password cannot be empty').notEmpty(),
        check('newPassword', 'New Password cannot be empty').notEmpty(),
    ],
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, error: errors.array() });
            return;
        }

        next();
    },
    (req, res, next) => authenticateToken('doctor', req, res, next),
    resetPassword
);

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

router.post('/logout', (req, res) => {
    res.clearCookie('jwt_doctor');
    return res.json({ success: true, message: 'Signout success!' });
});

router.post('/auth/refresh', authenticateRefreshToken('doctor'));

router.post('/addNewPatientInfo', (req, res, next) => authenticateToken('doctor', req, res, next), addNewPatientGet);
router.post(
    '/viewAppointments',
    (req, res, next) => authenticateToken(req.body.type, req, res, next),
    viewAppointments
);
router.post('/viewPatients', (req, res, next) => authenticateToken('doctor', req, res, next), viewPatients);
router.post(
    '/viewAppointmentData',
    (req, res, next) => authenticateToken(req.body.type, req, res, next),
    viewAppointmentData
);

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

// router.post('/getDoctors', getAllDoctors);

module.exports = router;
