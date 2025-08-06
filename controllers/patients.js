const jwt = require('jsonwebtoken');

const loginPatients = async (req, res) => {
    const { email, password } = req.body;
    // Check if
    // 1. User exists in patients DB
    // 2. Password is correct

    // TEST
    const user = {
        name: 'John Doe',
        email: 'johndoe@gmail.com',
        age: 43,
        type: 'patient',
        _id: 1
    };

    const token = jwt.sign({ _id: user?._id }, process.env.JWT_SECRET, { expiresIn: '30m' });
    res.cookie('jwt_patient', token, {
        httpOnly: true,
        maxAge: 1800000,
        secure: process.env.ENVIRONMENT === 'prod',
        sameSite: 'Lax',
    });

    const userData = {
        name: user?.name,
        email: user?.email,
        age: user?.age,
        type: user?.type,
        token,
    };

    res.status(200).json({ success: true, message: 'Login successful', data: userData });
};


module.exports = {
    loginPatients,
};
