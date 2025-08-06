const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const userRouter = require('./routes/users');

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

app.use(
    cors({
        origin: process.env.ANGULAR_APP_URL,
        credentials: true,
    })
);

app.use('/users', userRouter);

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});
