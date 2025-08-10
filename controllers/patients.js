const { QueryCommand } = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });

const loginPatients = async (req, res) => {
    const { email, password } = req.body;

    try {
        const command = new QueryCommand({
            TableName: 'Patients',
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': { S: email },
            },
        });

        const response = await client.send(command);
        const patient = response.Items?.[0];

        if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

        const hashedPassword = patient.password.S;
        const isMatch = await bcrypt.compare(password, hashedPassword);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const token = jwt.sign({ _id: patient.id.S }, process.env.JWT_SECRET, { expiresIn: '30m' });

        res.cookie('jwt_patient', token, {
            httpOnly: true,
            maxAge: 1800000,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: 'Lax',
        });

        const userData = {
            id: patient.id.S,
            first_name: patient.first_name?.S,
            last_name: patient.last_name?.S,
            email: patient.email.S,
            type: 'patient',
            token,
        };

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: userData,
        });
    } catch (err) {
        console.error('Patient login error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    loginPatients,
};
