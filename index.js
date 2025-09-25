const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const patientsRouter = require('./routes/patients');
const doctorsRouter = require('./routes/doctors');
const pharmaRouter = require('./routes/pharmacy');
const ordersRouter = require('./routes/orders');
const { csrfSync } = require('csrf-sync');
const session = require('express-session');
const { apiLimiter } = require('./controllers/utils/functions');

const app = express();

app.use(bodyParser.json());
// cookieParser must come before CSRF middleware for token access
app.use(cookieParser()); // CodeQL: ok

app.use(apiLimiter);

const allowedOrigins = [process.env.ANGULAR_APP_URL, process.env.ANGULAR_APP_WEB_URL];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
    })
);

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: { secure: process.env.ENVIRONMENT === 'prod' },
    })
);

const { csrfSynchronisedProtection, generateToken } = csrfSync();

app.get('/csrf-token', (req, res) => {
    res.json({ csrfToken: generateToken(req, true) });
});

app.use(csrfSynchronisedProtection);

app.use((err, req, res, next) => {
    if (err.code !== 'EBADCSRFTOKEN') return next(err);
    res.status(403).json({ success: false, message: 'Invalid CSRF token' });
});
app.use('/patients', patientsRouter);
app.use('/doctors', doctorsRouter);
app.use('/pharma', pharmaRouter);
app.use('/orders', ordersRouter);

app.get('/', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
