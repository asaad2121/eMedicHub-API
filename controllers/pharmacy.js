const {
    QueryCommand,
    DynamoDBClient,
    GetItemCommand,
    UpdateItemCommand,
    BatchGetItemCommand,
    ScanCommand,
} = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OrderStatus } = require('./utils/constants');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const loginPharma = async (req, res) => {
    const { email, password, stayLoggedIn } = req.body;

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

        let lastPwUpdate = pharma.last_password_update_utc?.S;
        if (!lastPwUpdate) {
            lastPwUpdate = new Date().toISOString();
            const updateCmd = new UpdateItemCommand({
                TableName: 'Pharmacy',
                Key: { id: { S: pharma.id.S } },
                UpdateExpression: 'SET last_password_update_utc = :now',
                ExpressionAttributeValues: { ':now': { S: lastPwUpdate } },
            });
            await client.send(updateCmd);
        }
        const refreshTokenExpiresIn = stayLoggedIn ? '30d' : '1d';
        const refreshTokenMaxAge = stayLoggedIn ? 2592000000 : 86400000;

        const token = jwt.sign({ _id: pharma.id.S, lastPwUpdate }, process.env.JWT_SECRET, { expiresIn: '30m' });
        const refreshToken = jwt.sign({ _id: pharma.id.S, lastPwUpdate }, process.env.JWT_REFRESH_SECRET, {
            expiresIn: refreshTokenExpiresIn,
        });

        res.cookie('jwt_pharma', token, {
            httpOnly: true,
            maxAge: 1800000,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });

        res.cookie('refresh_token_pharma', refreshToken, {
            httpOnly: true,
            maxAge: refreshTokenMaxAge,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });

        const userData = {
            id: pharma.id.S,
            name: pharma.name?.S,
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

const getPharmacyDashboard = async (req, res) => {
    try {
        const { pharma_id } = req.body;

        if (!pharma_id) return res.status(400).json({ success: false, message: 'pharma_id is required' });

        let orders = [];
        let lastEvaluatedKey = null;
        do {
            const scanCommand = new ScanCommand({
                TableName: 'Orders',
                FilterExpression: 'pharma_id = :phId',
                ExpressionAttributeValues: { ':phId': { S: pharma_id } },
                ExclusiveStartKey: lastEvaluatedKey,
            });

            const scanResult = await client.send(scanCommand);
            orders.push(...(scanResult.Items || []));
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
        } while (lastEvaluatedKey);

        orders.sort((a, b) => new Date(b.time.S) - new Date(a.time.S));
        const latestOrders = orders.slice(0, 3);

        const doctorIds = [...new Set(latestOrders.map((o) => o?.doctor_id?.S))];
        const patientIds = [...new Set(latestOrders.map((o) => o?.patient_id?.S))];

        const requestItems = {};
        if (doctorIds.length > 0) requestItems.Doctors = { Keys: doctorIds.map((id) => ({ id: { S: id } })) };
        if (patientIds.length > 0) requestItems.Patients = { Keys: patientIds.map((id) => ({ id: { S: id } })) };

        let batchResult = { Responses: {} };
        if (Object.keys(requestItems).length > 0) {
            const batchGetCommand = new BatchGetItemCommand({ RequestItems: requestItems });
            batchResult = await client.send(batchGetCommand);
        }

        const doctorMap = Object.fromEntries(
            (batchResult.Responses?.Doctors || []).map((d) => [
                d.id.S,
                `${d.first_name?.S || ''} ${d.last_name?.S || ''}`.trim(),
            ])
        );
        const patientMap = Object.fromEntries(
            (batchResult.Responses?.Patients || []).map((p) => [
                p.id.S,
                `${p.first_name?.S || ''} ${p.last_name?.S || ''}`.trim(),
            ])
        );

        const enrichedOrders = latestOrders.map((o) => ({
            order_id: o.id.S,
            doctor_name: doctorMap[o.doctor_id.S] || null,
            patient_name: patientMap[o.patient_id.S] || null,
            order_status: o.status.S,
            order_time: o.time.S,
        }));

        res.status(200).json({
            success: true,
            totalOrders: enrichedOrders.length,
            data: enrichedOrders,
        });
    } catch (err) {
        console.error('Error fetching latest orders:', err);
        res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

module.exports = {
    loginPharma,
    updateOrderStatus,
    getPharmacyDashboard,
};
