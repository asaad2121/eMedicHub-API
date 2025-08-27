const express = require('express');
const router = express.Router();
const { loginPatients, checkDoctorAvailability, createNewAppointment } = require('../controllers/patients');
const { check, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/session-authentication-middleware');
const { getAllDoctors } = require('../controllers/doctors');

router.get('/getDoctors', (req, res, next) => authenticateToken('patient', req, res, next), getAllDoctors);

router.get(
    '/checkDoctorAvailability',
    [check('doctor_id', 'doctor id cannot be empty').notEmpty(), check('date', 'date is required').notEmpty()],
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, error: errors.array() });
            return;
        }

        next();
    },
    (req, res, next) => authenticateToken('patient', req, res, next),
    checkDoctorAvailability
);

router.post(
    '/createNewAppointment',
    [
        check('doctor_id', 'doctor id cannot be empty').notEmpty(),
        check('patient_id', 'patient id is required').notEmpty(),
        check('date', 'date is required').notEmpty(),
        check('start_time', 'start time is required').notEmpty(),
    ],
    (req, res, next) => {
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            res.status(400).json({ success: false, error: errors.array() });
            return;
        }

        next();
    },
    (req, res, next) => authenticateToken('patient', req, res, next),
    createNewAppointment
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
    loginPatients
);

router.get('/logout', (req, res) => {
    res.clearCookie('jwt_patient');
    return res.json({ success: true, message: 'Signout success!' });
});

module.exports = router;
