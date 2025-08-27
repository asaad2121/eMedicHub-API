const { DynamoDBClient, ScanCommand, PutItemCommand, BatchGetItemCommand } = require('@aws-sdk/client-dynamodb');
const { getNextId } = require('./utils/functions');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const searchMedicines = async (req, res) => {
    const { name } = req.query;

    if (!name || name?.length < 4) {
        return res.status(400).json({
            success: false,
            message: 'Search term must be at least 4 characters',
        });
    }

    try {
        const command = new ScanCommand({
            TableName: 'Medicines',
            FilterExpression: 'contains(#nm, :name)',
            ExpressionAttributeNames: {
                '#nm': 'name',
            },
            ExpressionAttributeValues: {
                ':name': { S: name },
            },
        });

        const response = await client.send(command);

        const medicines = response?.Items?.map((item) => ({
            id: item.id?.S,
            name: item.name?.S,
            price: parseFloat(item.price?.N),
            company: item.company?.S,
            salt: item.salt?.S,
            prescription_required: item.prescription_required?.BOOL || false,
        }));

        return res.status(200).json({ success: true, data: medicines, message: 'Medicines fetched' });
    } catch (err) {
        console.error('Error fetching medicines:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const createNewOrder = async (req, res) => {
    const { appointment_id, patient_id, doctor_id, pharma_id, medicines } = req.body;

    try {
        const createdOrders = [];
        const currentTime = new Date().toISOString();

        for (const med of medicines) {
            const nextIdNum = await getNextId('Orders');
            const nextId = `ORD-${nextIdNum.toString().padStart(4, '0')}`;

            const orderItem = {
                id: { S: nextId },
                appointment_id: { S: appointment_id },
                patient_id: { S: patient_id },
                doctor_id: { S: doctor_id },
                pharma_id: { S: pharma_id },
                time: { S: currentTime },
                med_id: { S: med.med_id },
                quantity: { N: String(med.quantity) },
                price: { N: String(med.price) },
                status: { S: 'placed' },
                timings: {
                    M: {
                        before_morning_med: { BOOL: med.timings?.before_morning_med || false },
                        after_morning_med: { BOOL: med.timings?.after_morning_med || false },
                        before_evening_med: { BOOL: med.timings?.before_evening_med || false },
                        after_evening_med: { BOOL: med.timings?.after_evening_med || false },
                        before_dinner_med: { BOOL: med.timings?.before_dinner_med || false },
                        after_dinner_med: { BOOL: med.timings?.after_dinner_med || false },
                    },
                },
            };

            const command = new PutItemCommand({
                TableName: 'Orders',
                Item: orderItem,
            });

            await client.send(command);
            createdOrders.push(nextId);
        }

        return res.status(201).json({
            success: true,
            message: 'Order(s) created successfully',
            order_ids: createdOrders,
        });
    } catch (err) {
        console.error('Error creating order:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getOrders = async (req, res) => {
    try {
        const { limit = 10, currentPageNo = 1, doctor_id, patient_id, pharma_id, type } = req.query;

        if (type === 'doctor' && !doctor_id) {
            return res.status(400).json({
                success: false,
                message: 'doctor_id is required for type=doctor',
            });
        }
        if (type === 'patient' && !patient_id) {
            return res.status(400).json({
                success: false,
                message: 'patient_id is required for type=patient',
            });
        }
        if (type === 'pharma' && !pharma_id) {
            return res.status(400).json({
                success: false,
                message: 'pharma_id is required for type=pharma',
            });
        }

        let filterExpression = '';
        const expressionAttributeValues = {};

        if (doctor_id) {
            filterExpression += (filterExpression ? ' AND ' : '') + 'doctor_id = :docId';
            expressionAttributeValues[':docId'] = { S: doctor_id };
        }
        if (patient_id) {
            filterExpression += (filterExpression ? ' AND ' : '') + 'patient_id = :patId';
            expressionAttributeValues[':patId'] = { S: patient_id };
        }
        if (pharma_id) {
            filterExpression += (filterExpression ? ' AND ' : '') + 'pharma_id = :phId';
            expressionAttributeValues[':phId'] = { S: pharma_id };
        }

        const scanCommand = new ScanCommand({
            TableName: 'Orders',
            Limit: parseInt(limit),
            FilterExpression: filterExpression || undefined,
            ExpressionAttributeValues:
                Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
        });

        const scanResult = await client.send(scanCommand);
        const orders = scanResult.Items || [];

        const patientIds = [...new Set(orders?.map((o) => o?.patient_id?.S))];
        const doctorIds = [...new Set(orders?.map((o) => o?.doctor_id?.S))];
        const pharmaIds = [...new Set(orders?.map((o) => o?.pharma_id?.S))];

        const requestItems = {};

        if (patientIds?.length > 0) requestItems.Patients = { Keys: patientIds?.map((id) => ({ id: { S: id } })) };

        if (doctorIds?.length > 0) requestItems.Doctors = { Keys: doctorIds?.map((id) => ({ id: { S: id } })) };

        if (pharmaIds?.length > 0) requestItems.Pharmacies = { Keys: pharmaIds?.map((id) => ({ id: { S: id } })) };

        let batchResult = { Responses: {} };
        if (Object.keys(requestItems)?.length > 0) {
            const batchGetCommand = new BatchGetItemCommand({ RequestItems: requestItems });
            batchResult = await client.send(batchGetCommand);
        }

        const patientMap = Object.fromEntries((batchResult.Responses?.Patients || [])?.map((p) => [p.id.S, p.name.S]));
        const doctorMap = Object.fromEntries((batchResult.Responses?.Doctors || [])?.map((d) => [d.id.S, d.name.S]));
        const pharmaMap = Object.fromEntries(
            (batchResult.Responses?.Pharmacies || [])?.map((ph) => [ph.id.S, ph.name.S])
        );

        const enrichedOrders = orders?.map((o) => ({
            ...o,
            patient_name: patientMap[o.patient_id.S],
            doctor_name: doctorMap[o.doctor_id.S],
            pharma_name: pharmaMap[o.pharma_id.S],
        }));

        res.status(200).json({
            success: true,
            currentPageNo: parseInt(currentPageNo),
            limit: parseInt(limit),
            totalOrders: enrichedOrders?.length,
            data: enrichedOrders,
        });
    } catch (err) {
        console.error('Error fetching orders:', err);
        res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

const getAllPharmacy = async (req, res) => {
    try {
        const command = new ScanCommand({
            TableName: 'Pharmacy',
        });

        const response = await client.send(command);

        const pharmacy = response.Items.map((pharma) => ({
            id: pharma.id.S,
            name: pharma.name.S,
        }));

        return res.status(200).json({
            success: true,
            message: 'All Pharmacy fetched',
            data: pharmacy,
        });
    } catch (err) {
        console.error('Error fetching pharmacy:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    searchMedicines,
    createNewOrder,
    getAllPharmacy,
    getOrders,
};
