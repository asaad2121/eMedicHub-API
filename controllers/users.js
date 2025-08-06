const jwt = require('jsonwebtoken');

const loginUsers = async (req, res) => {
    const { email, password } = req.body;
    // Check if
    // 1. User exists in our DB
    // 2. Password is correct

    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, { expiresIn: '30m' });
    res.cookie('jwt', token, {
        httpOnly: true,
        maxAge: 1800000,
        secure: process.env.ENVIRONMENT === 'prod',
        sameSite: 'Lax',
    });

    const userData = {
        token,
    };

    res.status(200).json({ success: true, message: 'Login successful', data: userData });
};

const signupUsers = async (req, res) => {
    const { email, password, firstName, lastName } = req.body;

    // const userExists = findOne({ where: { email } });
    // if (userExists) {
    //     return res.status(403).json({ success: false, message: 'User with the same email already exists' });
    // }

    try {
        const user = {
            email,
            firstName,
            lastName,
        };
        // await save user in DB;

        res.status(200).json({ success: true, message: 'Signup Successful', data: user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error during signup', error: error.message });
    }
};

module.exports = {
    loginUsers,
    signupUsers,
};
