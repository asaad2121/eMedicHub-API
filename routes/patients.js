const express = require('express');
const router = express.Router();
const {
    loginPatients,
    checkDoctorAvailability,
    createNewAppointment,
    viewAppointments,
    viewAppointmentData,
} = require('../controllers/patients');
const { check, validationResult } = require('express-validator');
const { authenticateToken, authenticateRefreshToken } = require('../middleware/session-authentication-middleware');
const { getAllDoctors, addNewPatientPost, addNewPatientGet } = require('../controllers/doctors');
const { getUserProfile, resetPassword } = require('../controllers/userInfo');

router.post('/getUserProfile/:id', (req, res, next) => authenticateToken('patient', req, res, next), getUserProfile);
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
    (req, res, next) => authenticateToken('patient', req, res, next),
    resetPassword
);

router.post('/getDoctors', (req, res, next) => authenticateToken('patient', req, res, next), getAllDoctors);
router.post(
    '/viewAppointments',
    (req, res, next) => authenticateToken(req.body.type, req, res, next),
    viewAppointments
);
router.post(
    '/viewAppointmentData',
    (req, res, next) => authenticateToken('patient', req, res, next),
    viewAppointmentData
);

router.post(
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

router.post(
    '/signup',
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
router.post('/signupInfo', addNewPatientGet);

router.post('/logout', (req, res) => {
    res.clearCookie('jwt_patient');
    return res.json({ success: true, message: 'Signout success!' });
});

router.post('/auth/refresh', authenticateRefreshToken('patient'));

module.exports = router;
