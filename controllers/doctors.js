const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { DynamoDBClient, QueryCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const getAllDoctors = async (req, res) => {
    try {
        const command = new ScanCommand({
            TableName: 'Doctors',
        });

        const response = await client.send(command);

        const doctors = response.Items.map((doc) => ({
            id: doc.id.S,
            first_name: doc.first_name?.S,
            last_name: doc.last_name?.S,
            dob: doc.dob?.S,
            email: doc.email?.S,
            visiting_hours: doc.visiting_hours?.M || {},
        }));

        return res.status(200).json({
            success: true,
            data: doctors,
        });
    } catch (err) {
        console.error('Error fetching doctors:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const loginDoctors = async (req, res) => {
    const { email, password } = req.body;

    try {
        const command = new QueryCommand({
            TableName: 'Doctors',
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': { S: email },
            },
        });

        const response = await client.send(command);
        const doctor = response.Items?.[0];

        if (!doctor) {
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const hashedPassword = doctor.password.S;
        const isMatch = await bcrypt.compare(password, hashedPassword);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const token = jwt.sign({ _id: doctor.id.S }, process.env.JWT_SECRET, { expiresIn: '30m' });

        res.cookie('jwt_doctor', token, {
            httpOnly: true,
            maxAge: 1800000, // 30 minutes
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: 'Lax',
        });

        const userData = {
            id: doctor.id.S,
            first_name: doctor.first_name?.S,
            last_name: doctor.last_name?.S,
            email: doctor.email.S,
            type: 'doctor',
            token,
        };

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: userData,
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
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
    getAllDoctors,
    addNewPatient,
};
