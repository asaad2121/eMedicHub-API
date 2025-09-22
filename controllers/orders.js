const {
    DynamoDBClient,
    ScanCommand,
    PutItemCommand,
    BatchGetItemCommand,
    GetItemCommand,
} = require('@aws-sdk/client-dynamodb');
const { getNextId } = require('./utils/functions');
const { mapDynamoDBOrders } = require('./utils/functions');
const { OrderStatus } = require('./utils/constants');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const searchMedicines = async (req, res) => {
    const { name } = req.query;

    if (typeof name !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Search term must be a string',
        });
    }

    if (!name || name?.length < 4) {
        return res.status(400).json({
            success: false,
            message: 'Search term must be at least 4 characters',
        });
    }

    try {
        const safeName = name.trim();
        const capitalizedName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
        const command = new ScanCommand({
            TableName: 'Medicines',
            FilterExpression: 'contains(#nm, :name)',
            ExpressionAttributeNames: {
                '#nm': 'name',
            },
            ExpressionAttributeValues: {
                ':name': { S: capitalizedName },
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
        const tablesToCheck = [
            { table: 'Patients', id: patient_id, label: 'Patient' },
            { table: 'Doctors', id: doctor_id, label: 'Doctor' },
            { table: 'Pharmacy', id: pharma_id, label: 'Pharmacy' },
        ];

        for (const { table, id, label } of tablesToCheck) {
            const checkCmd = new GetItemCommand({
                TableName: table,
                Key: { id: { S: id } },
            });

            const result = await client.send(checkCmd);
            if (!result.Item) {
                return res.status(400).json({
                    success: false,
                    message: `${label} with id '${id}' does not exist`,
                });
            }
        }

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
                status: { S: OrderStatus.CREATED },
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
        const { limit = 10, currentPageNo = 1, doctor_id, patient_id, pharma_id, type, patientSearch } = req.query;
        const pageSize = parseInt(limit);
        const pageNo = parseInt(currentPageNo);

        if (type === 'doctor' && !doctor_id)
            return res.status(400).json({ success: false, message: 'doctor_id is required for type=doctor' });
        if (type === 'patient' && !patient_id)
            return res.status(400).json({ success: false, message: 'patient_id is required for type=patient' });
        if (type === 'pharma' && !pharma_id)
            return res.status(400).json({ success: false, message: 'pharma_id is required for type=pharma' });

        let patientIdsFromSearch = [];
        if (typeof patientSearch === 'string' && patientSearch.trim().length >= 3) {
            const searchStr = patientSearch.trim();
            const capitalizedSearch = searchStr.charAt(0).toUpperCase() + searchStr.slice(1);
            const patientScan = new ScanCommand({
                TableName: 'Patients',
                FilterExpression: 'contains(#fn, :search) OR contains(#ln, :search)',
                ExpressionAttributeNames: { '#fn': 'first_name', '#ln': 'last_name' },
                ExpressionAttributeValues: { ':search': { S: capitalizedSearch } },
            });
            const patientResult = await client.send(patientScan);
            patientIdsFromSearch = patientResult.Items?.map((p) => p.id.S) || [];
            if (patientIdsFromSearch.length === 0) {
                return res.status(200).json({
                    success: true,
                    currentPageNo: pageNo,
                    limit: pageSize,
                    totalOrders: 0,
                    data: [],
                    message: 'No orders found for given patient name',
                });
            }
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
        if (patientIdsFromSearch?.length > 0) {
            const patientFilters = patientIdsFromSearch.map((_, i) => `patient_id = :p${i}`).join(' OR ');
            filterExpression += (filterExpression ? ' AND ' : '') + `(${patientFilters})`;
            patientIdsFromSearch.forEach((id, i) => {
                expressionAttributeValues[`:p${i}`] = { S: id };
            });
        }

        let orders = [];
        let lastEvaluatedKey = null;
        const itemsNeeded = pageNo * pageSize;

        while (orders?.length < itemsNeeded) {
            const scanCommand = new ScanCommand({
                TableName: 'Orders',
                FilterExpression: filterExpression || undefined,
                ExpressionAttributeValues:
                    Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
                ExclusiveStartKey: lastEvaluatedKey,
            });

            const scanResult = await client.send(scanCommand);
            orders?.push(...(scanResult.Items || []));
            lastEvaluatedKey = scanResult.LastEvaluatedKey;

            if (!lastEvaluatedKey) break;
        }

        const startIndex = (pageNo - 1) * pageSize;
        const paginatedOrders = orders?.slice(startIndex, startIndex + pageSize);

        const patientIds = [...new Set(paginatedOrders.map((o) => o?.patient_id?.S))];
        const doctorIds = [...new Set(paginatedOrders.map((o) => o?.doctor_id?.S))];
        const pharmaIds = [...new Set(paginatedOrders.map((o) => o?.pharma_id?.S))];
        const medIds = [...new Set(paginatedOrders.map((o) => o?.med_id?.S))];

        const requestItems = {};
        if (patientIds?.length > 0) requestItems.Patients = { Keys: patientIds?.map((id) => ({ id: { S: id } })) };
        if (doctorIds?.length > 0) requestItems.Doctors = { Keys: doctorIds?.map((id) => ({ id: { S: id } })) };
        if (pharmaIds?.length > 0) requestItems.Pharmacy = { Keys: pharmaIds?.map((id) => ({ id: { S: id } })) };
        if (medIds?.length > 0) requestItems.Medicines = { Keys: medIds?.map((id) => ({ id: { S: id } })) };

        let batchResult = { Responses: {} };
        if (Object.keys(requestItems)?.length > 0) {
            const batchGetCommand = new BatchGetItemCommand({ RequestItems: requestItems });
            batchResult = await client.send(batchGetCommand);
        }

        const patientMap = Object.fromEntries(
            (batchResult.Responses?.Patients || [])?.map((p) => [
                p.id?.S,
                `${p.first_name?.S || ''} ${p.last_name?.S || ''}`.trim(),
            ])
        );
        const doctorMap = Object.fromEntries(
            (batchResult.Responses?.Doctors || []).map((d) => [
                d.id?.S,
                `${d.first_name?.S || ''} ${d.last_name?.S || ''}`.trim(),
            ])
        );
        const pharmaMap = Object.fromEntries(
            (batchResult.Responses?.Pharmacy || []).map((ph) => [ph.id?.S, ph.name?.S])
        );
        const medicineMap = Object.fromEntries(
            (batchResult.Responses?.Medicines || []).map((m) => [m.id?.S, m.name?.S])
        );

        const enrichedOrders = paginatedOrders?.map((o) => ({
            ...o,
            patient_name: patientMap[o.patient_id.S],
            doctor_name: doctorMap[o.doctor_id.S],
            pharma_name: pharmaMap[o.pharma_id.S],
            medicine_name: medicineMap[o.med_id?.S],
        }));

        const mappedOrders = mapDynamoDBOrders(enrichedOrders);

        res.status(200).json({
            success: true,
            currentPageNo: pageNo,
            limit: pageSize,
            totalOrders: orders?.length,
            data: mappedOrders,
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
