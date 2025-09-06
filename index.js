const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const patientsRouter = require('./routes/patients');
const doctorsRouter = require('./routes/doctors');
const pharmaRouter = require('./routes/pharmacy');
const ordersRouter = require('./routes/orders');

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

app.use(
    cors({
        origin: process.env.ANGULAR_APP_URL,
        credentials: true,
    })
);

app.use('/patients', patientsRouter);
app.use('/doctors', doctorsRouter);
app.use('/pharma', pharmaRouter);
app.use('/orders', ordersRouter);

app.get('/', (req, res) => res.status(200).send('OK'));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
