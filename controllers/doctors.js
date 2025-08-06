const jwt = require('jsonwebtoken');

const loginDoctors = async (req, res) => {
    const { email, password } = req.body;
    // Check if
    // 1. User exists in patients DB
    // 2. Password is correct

    // TEST
    const user = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'johndoe@gmail.com',
        age: 43,
        type: 'doctor',
        _id: 1,
    };

    const token = jwt.sign({ _id: user?._id }, process.env.JWT_SECRET, { expiresIn: '30m' });
    res.cookie('jwt_doctor', token, {
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

const addNewPatient = async (req, res) => {
    const { email, password, firstName, lastName, age } = req.body;

    // const patientExists = findOne Patient in DB
    // if (patientExists) {
    //     return res.status(403).json({ success: false, message: 'Patient with the same email already exists' });
    // }

    try {
        const patient = {
            firstName,
            lastName,
            age,
            email,
        };
        // await save patient in DB;

        res.status(200).json({ success: true, message: 'Patient added successfully!', data: patient });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error during patient signup', error: error.message });
    }
};

module.exports = {
    loginDoctors,
    addNewPatient,
};
