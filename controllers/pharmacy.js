const { QueryCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const loginPharma = async (req, res) => {
    const { email, password } = req.body;

    try {
        const command = new QueryCommand({
            TableName: 'Pharmacy',
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': { S: email },
            },
        });

        const response = await client.send(command);
        const pharma = response.Items?.[0];

        if (!pharma) return res.status(404).json({ success: false, message: 'Pharmacy not found' });

        const hashedPassword = pharma.password.S;
        const isMatch = await bcrypt.compare(password, hashedPassword);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        const token = jwt.sign({ _id: pharma.id.S }, process.env.JWT_SECRET, { expiresIn: '30m' });
        res.cookie('jwt_pharma', token, {
            httpOnly: true,
            maxAge: 1800000,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: 'Lax',
        });

        const userData = {
            id: pharma.id.S,
            first_name: pharma.first_name?.S,
            last_name: pharma.last_name?.S,
            email: pharma.email.S,
            type: 'Pharma',
            token,
        };

        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: userData,
        });
    } catch (err) {
        console.error('Pharma login error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    loginPharma,
};
