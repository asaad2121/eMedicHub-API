const express = require('express');
const router = express.Router();
const { searchMedicines, createNewOrder, getAllPharmacy, getOrders } = require('../controllers/orders');
const { authenticateToken } = require('../middleware/session-authentication-middleware');
const { check, validationResult } = require('express-validator');

router.get('/searchMedicines', (req, res, next) => authenticateToken('doctor', req, res, next), searchMedicines);
router.get('/getPharmacy', (req, res, next) => authenticateToken('doctor', req, res, next), getAllPharmacy);
router.get('/getOrders', getOrders); //(req, res, next) => authenticateToken(req.query.type, req, res, next),

router.post(
    '/createNewOrder',
    [
        check('appointment_id', 'Appointment ID is required').notEmpty(),
        check('patient_id', 'Patient ID is required').notEmpty(),
        check('doctor_id', 'Doctor ID is required').notEmpty(),
        check('pharma_id', 'Pharmacy ID is required').notEmpty(),
        check('medicines', 'Medicines are required').isArray({ min: 1 }),
        check('medicines.*.med_id', 'Medicine ID is required').notEmpty(),
        check('medicines.*.quantity', 'Quantity is required').isInt({ min: 1 }),
        check('medicines.*.price', 'Price is required').isFloat({ min: 0 }),
        check('medicines.*.timings.before_morning_med').optional().isBoolean(),
        check('medicines.*.timings.after_morning_med').optional().isBoolean(),
        check('medicines.*.timings.before_evening_med').optional().isBoolean(),
        check('medicines.*.timings.after_evening_med').optional().isBoolean(),
        check('medicines.*.timings.before_dinner_med').optional().isBoolean(),
        check('medicines.*.timings.after_dinner_med').optional().isBoolean(),
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
    createNewOrder
);

module.exports = router;
