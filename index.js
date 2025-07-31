const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(bodyParser.json());
app.use(cookieParser());

app.use(
    cors({
        origin: process.env.ANGULAR_APP_URL,
        credentials: true,
    })
);

app.listen(8080, () => {
    console.log('Server is running on port 8080');
});
