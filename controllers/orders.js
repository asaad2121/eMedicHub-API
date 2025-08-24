const { DynamoDBClient, ScanCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
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
};
