const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const patientsRouter = require('./routes/patients');
const doctorsRouter = require('./routes/doctors');
const pharmaRouter = require('./routes/pharmacy');
const ordersRouter = require('./routes/orders');
const csrf = require('csurf');
const { refreshLimiter } = require('./controllers/utils/functions');

const csrfProtection = csrf({ cookie: true });

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());
app.use(csrfProtection);

// CSRF error handler to prevent process crash
app.use((err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    res.status(403).json({ success: false, message: 'Invalid CSRF token' });
});

app.get('/csrf-token', refreshLimiter, (req, res) => {
    res.json({ csrfToken: req.csrfToken() });
});

const allowedOrigins = [process.env.ANGULAR_APP_URL, process.env.ANGULAR_APP_WEB_URL];

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        },
        credentials: true,
    })
);

app.use('/patients', refreshLimiter, patientsRouter);
app.use('/doctors', refreshLimiter, doctorsRouter);
app.use('/pharma', refreshLimiter, pharmaRouter);
app.use('/orders', refreshLimiter, ordersRouter);

app.get('/', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
