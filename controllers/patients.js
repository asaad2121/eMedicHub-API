const {
    QueryCommand,
    DynamoDBClient,
    PutItemCommand,
    ScanCommand,
    GetItemCommand,
} = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAvailableSlots, fetchDoctorAppointments, parseTime } = require('./utils/appointments');
const { getNextId } = require('./utils/functions');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const checkDoctorAvailability = async (req, res) => {
    try {
        const { doctor_id, date } = req.query;
        const { workingHours, appointments } = await fetchDoctorAppointments(doctor_id, date);
        const freeSlots = getAvailableSlots(workingHours, appointments);
        return res.status(200).json({ success: true, data: freeSlots });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: err.message });
    }
};

const createNewAppointment = async (req, res) => {
    try {
        const { doctor_id, patient_id, date, start_time } = req.body;

        const tablesToCheck = [
            { table: 'Patients', id: patient_id, label: 'Patient' },
            { table: 'Doctors', id: doctor_id, label: 'Doctor' },
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
        const { workingHours, appointments } = await fetchDoctorAppointments(doctor_id, date);

        const slotStart = parseTime(start_time);
        const slotEnd = slotStart + 30;
        if (slotStart < parseTime(workingHours?.start) || slotEnd > parseTime(workingHours?.end)) {
            return res.status(400).json({ success: false, message: 'Selected slot is outside working hours' });
        }

        const overlap = appointments?.some((a) => !(slotEnd <= parseTime(a?.start) || slotStart >= parseTime(a?.end)));
        if (overlap) return res.status(400).json({ success: false, message: 'Selected slot is already booked' });

        const appointmentId = `APT-${String(await getNextId('Appointments')).padStart(4, '0')}`;

        const putCommand = new PutItemCommand({
            TableName: 'Appointments',
            Item: {
                id: { S: appointmentId },
                doctor_id: { S: doctor_id },
                patient_id: { S: patient_id },
                date: { S: date },
                start_time: { S: start_time },
                end_time: {
                    S: `${String(Math.floor(slotEnd / 60)).padStart(2, '0')}:${String(slotEnd % 60).padStart(2, '0')}`,
                },
            },
        });

        await client.send(putCommand);

        return res.status(201).json({ success: true, message: 'Appointment booked', appointmentId });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

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

const viewAppointments = async (req, res) => {
    try {
        const { type, doctor_id, patient_id, start_date, end_date, limit = 10, currentPageNo = 1 } = req.query;
        const pageSize = parseInt(limit);
        const pageNo = parseInt(currentPageNo);

        if (type === 'doctor' && !doctor_id)
            return res.status(400).json({ success: false, message: 'doctor_id is required for type=doctor' });
        if (type === 'patient' && !patient_id)
            return res.status(400).json({ success: false, message: 'patient_id is required for type=patient' });

        let filterExpression = '';
        const expressionAttributeValues = {};

        if (type === 'doctor') {
            filterExpression += 'doctor_id = :docId';
            expressionAttributeValues[':docId'] = { S: doctor_id };
        } else if (type === 'patient') {
            filterExpression += 'patient_id = :patId';
            expressionAttributeValues[':patId'] = { S: patient_id };
        }

        const todayStr = new Date()?.toISOString()?.split('T')[0];

        if (start_date && end_date) {
            filterExpression += ' AND #date BETWEEN :start AND :end';
            expressionAttributeValues[':start'] = { S: start_date };
            expressionAttributeValues[':end'] = { S: end_date };
        } else {
            filterExpression += ' AND #date >= :today';
            expressionAttributeValues[':today'] = { S: todayStr };
        }

        let appointments = [];
        let lastEvaluatedKey = null;
        const itemsNeeded = pageNo * pageSize;

        while (appointments?.length < itemsNeeded) {
            const scanCommand = new ScanCommand({
                TableName: 'Appointments',
                FilterExpression: filterExpression,
                ExpressionAttributeValues: expressionAttributeValues,
                ExpressionAttributeNames: { '#date': 'date' },
                ExclusiveStartKey: lastEvaluatedKey,
            });

            const scanResult = await client.send(scanCommand);
            appointments.push(...(scanResult.Items || []));
            lastEvaluatedKey = scanResult.LastEvaluatedKey;

            if (!lastEvaluatedKey) break;
        }

        const startIndex = (pageNo - 1) * pageSize;
        const paginatedAppointments = appointments?.slice(startIndex, startIndex + pageSize);

        return res.status(200).json({
            success: true,
            currentPageNo: pageNo,
            limit: pageSize,
            totalAppointments: appointments.length,
            data: paginatedAppointments,
        });
    } catch (err) {
        console.error('Error fetching appointments:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

module.exports = {
    loginPatients,
    checkDoctorAvailability,
    createNewAppointment,
    viewAppointments,
};
