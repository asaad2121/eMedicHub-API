const jwt = require('jsonwebtoken');
const { DynamoDBClient, QueryCommand, ScanCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { IdTypes, BloodGroups } = require('./utils/constants');
const { verifyPassword, generateHashedPassword, getNextId } = require('./utils/functions');

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
            message: 'All doctors fetched',
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

        const isMatch = await verifyPassword(password, doctor.password.S);
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

const addNewPatientGet = async (req, res) => {
    try {
        const command = new ScanCommand({
            TableName: 'Doctors',
            ProjectionExpression: 'id, first_name, last_name, visiting_hours',
        });

        const response = await client.send(command);

        const doctorsList = response.Items.map((doc) => ({
            id: doc.id.S,
            name: `${doc.first_name?.S || ''} ${doc.last_name?.S || ''}`.trim(),
            visiting_hours: doc.visiting_hours?.M || {},
        }));

        const nextIdNum = await getNextId('Patients');
        const nextId = `PAT-${nextIdNum.toString().padStart(4, '0')}`;

        return res.status(200).json({
            success: true,
            message: 'Doctors list fetched successfully',
            data: {
                doctors: doctorsList,
                nextPatientId: nextId,
                idTypes: Object.values(IdTypes),
                bloodGroups: Object.values(BloodGroups),
            },
        });
    } catch (err) {
        console.error('Error fetching doctors for patient form:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const addNewPatientPost = async (req, res) => {
    try {
        const {
            id,
            first_name,
            last_name,
            dob,
            email,
            password,
            blood_grp,
            address,
            phone_no,
            gp_id,
            id_type,
            id_number,
        } = req.body;

        if (!Object.values(IdTypes).includes(id_type))
            return res.status(400).json({ success: false, message: 'Invalid id_type' });
        if (!Object.values(BloodGroups).includes(blood_grp))
            return res.status(400).json({ success: false, message: 'Invalid blood_grp' });

        const hashedPassword = await generateHashedPassword(password);

        const patientItem = {
            id: { S: id },
            first_name: { S: first_name },
            last_name: { S: last_name },
            dob: { S: dob },
            email: { S: email },
            password: { S: hashedPassword },
            blood_grp: { S: blood_grp },
            address: { S: address || '' },
            phone_no: { S: phone_no },
            gp_id: { S: gp_id },
            id_type: { S: id_type },
            id_number: { S: id_number },
            last_gp_visited: { S: gp_id || '' },
        };

        const command = new PutItemCommand({
            TableName: 'Patients',
            Item: patientItem,
            ConditionExpression: 'attribute_not_exists(id)',
        });

        await client.send(command);

        return res.status(201).json({ success: true, message: 'Patient added successfully' });
    } catch (err) {
        console.error('Error adding patient:', err);
        if (err.name === 'ConditionalCheckFailedException') {
            return res.status(409).json({ success: false, message: 'Patient with this ID already exists' });
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    loginDoctors,
    getAllDoctors,
    addNewPatientPost,
    addNewPatientGet,
};
