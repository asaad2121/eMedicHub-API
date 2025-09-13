const { QueryCommand, DynamoDBClient, GetItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OrderStatus } = require('./utils/constants');
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
        const refreshToken = jwt.sign({ _id: pharma.id.S }, process.env.JWT_REFRESH_SECRET, { expiresIn: '7d' });

        res.cookie('jwt_pharma', token, {
            httpOnly: true,
            maxAge: 1800000,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });
        
        res.cookie('refresh_token_pharma', refreshToken, {
            httpOnly: true,
            maxAge: 604800000, // 7 days
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });


        const userData = {
            id: pharma.id.S,
            first_name: pharma.first_name?.S,
            last_name: pharma.last_name?.S,
            email: pharma.email.S,
            type: 'pharma',
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

const updateOrderStatus = async (req, res) => {
    try {
        const { order_id, status, pharma_id } = req.body;

        const checkCmd = new GetItemCommand({
            TableName: 'Pharmacy',
            Key: { id: { S: pharma_id } },
        });
        const result = await client.send(checkCmd);

        if (!result?.Item) {
            return res.status(400).json({
                success: false,
                message: `Pharmacy with id '${pharma_id}' does not exist`,
            });
        }

        if (!Object.values(OrderStatus)?.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status '${status}'. Must be one of: ${Object.values(OrderStatus)?.join(', ')}`,
            });
        }

        const updateCmd = new UpdateItemCommand({
            TableName: 'Orders',
            Key: { id: { S: order_id } },
            UpdateExpression: 'SET #st = :status',
            ExpressionAttributeNames: {
                '#st': 'status',
            },
            ExpressionAttributeValues: {
                ':status': { S: status },
            },
            ReturnValues: 'ALL_NEW',
        });

        const updatedOrder = await client.send(updateCmd);

        const updatedValues = {
            id: updatedOrder.Attributes.id.S,
            status: updatedOrder.Attributes.status.S,
        };
        return res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            data: updatedValues,
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    loginPharma,
    updateOrderStatus,
};
