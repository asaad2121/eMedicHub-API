const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const patientsRouter = require('./routes/patients');
const doctorsRouter = require('./routes/doctors');
const pharmaRouter = require('./routes/pharmacy');

const { authenticateToken } = require('./middleware/session-authentication-middleware');

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

app.use(
    cors({
        origin: process.env.ANGULAR_APP_URL,
        credentials: true,
    })
);

app.use('/patients', (res, req, next) => authenticateToken('patient', res, req, next), patientsRouter);
app.use('/doctors', (res, req, next) => authenticateToken('doctor', res, req, next), doctorsRouter);
app.use('/pharma', (res, req, next) => authenticateToken('pharma', res, req, next), pharmaRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
