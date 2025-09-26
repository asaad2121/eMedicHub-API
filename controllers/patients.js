const {
    QueryCommand,
    DynamoDBClient,
    PutItemCommand,
    ScanCommand,
    GetItemCommand,
    BatchGetItemCommand,
    UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getAvailableSlots, fetchDoctorAppointments, parseTime } = require('./utils/appointments');
const { getNextId } = require('./utils/functions');
const { differenceInYears, parseISO } = require('date-fns');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const checkDoctorAvailability = async (req, res) => {
    try {
        const { doctor_id, date } = req.body;
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
        const { doctor_id, patient_id, date, start_time, note } = req.body;

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
                note: { S: note },
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
    const { email, password, stayLoggedIn } = req.body;

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

        let lastPwUpdate = patient.last_password_update_utc?.S;
        if (!lastPwUpdate) {
            lastPwUpdate = new Date().toISOString();
            const updateCmd = new UpdateItemCommand({
                TableName: 'Patients',
                Key: { id: { S: patient.id.S } },
                UpdateExpression: 'SET last_password_update_utc = :now',
                ExpressionAttributeValues: { ':now': { S: lastPwUpdate } },
            });
            await client.send(updateCmd);
        }
        const refreshTokenExpiresIn = stayLoggedIn ? '30d' : '1d';
        const refreshTokenMaxAge = stayLoggedIn ? 2592000000 : 86400000;

        const token = jwt.sign({ _id: patient.id.S, lastPwUpdate }, process.env.JWT_SECRET, { expiresIn: '30m' });
        const refreshToken = jwt.sign({ _id: patient.id.S, lastPwUpdate }, process.env.JWT_REFRESH_SECRET, {
            expiresIn: refreshTokenExpiresIn,
        });

        res.cookie('jwt_patient', token, {
            httpOnly: true,
            maxAge: 1800000,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });

        res.cookie('refresh_token_patient', refreshToken, {
            httpOnly: true,
            maxAge: refreshTokenMaxAge,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
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
        const { type, doctor_id, patient_id, start_date, end_date, limit = 10, currentPageNo = 1 } = req.body;
        const pageSize = parseInt(limit);
        const pageNo = parseInt(currentPageNo);

        if (type === 'doctor' && !doctor_id)
            return res.status(400).json({ success: false, message: 'doctor_id is required for type=doctor' });
        if (type === 'patient' && !patient_id)
            return res.status(400).json({ success: false, message: 'patient_id is required for type=patient' });

        let filterExpression = '';
        const expressionAttributeValues = {};

        if (type === 'doctor') {
            filterExpression = 'doctor_id = :docId';
            expressionAttributeValues[':docId'] = { S: doctor_id };
        } else if (type === 'patient') {
            filterExpression = 'patient_id = :patId';
            expressionAttributeValues[':patId'] = { S: patient_id };
        }

        const todayStr = new Date().toISOString()?.split('T')[0];

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

        const patientIds = [...new Set(appointments.map((a) => a.patient_id?.S))];
        const doctorIds = [...new Set(appointments.map((a) => a.doctor_id?.S))];

        const requestItems = {};
        if (patientIds?.length > 0) {
            requestItems.Patients = { Keys: patientIds.map((id) => ({ id: { S: id } })) };
        }
        if (doctorIds?.length > 0) {
            requestItems.Doctors = { Keys: doctorIds.map((id) => ({ id: { S: id } })) };
        }

        let batchResult = { Responses: {} };
        if (Object.keys(requestItems)?.length > 0) {
            const batchGetCommand = new BatchGetItemCommand({ RequestItems: requestItems });
            batchResult = await client.send(batchGetCommand);
        }

        const patientMap = Object.fromEntries(
            (batchResult.Responses?.Patients || []).map((p) => [
                p.id.S,
                `${p.first_name?.S || ''} ${p.last_name?.S || ''}`.trim(),
            ])
        );

        const doctorMap = Object.fromEntries(
            (batchResult.Responses?.Doctors || []).map((d) => [
                d.id.S,
                `${d.first_name?.S || ''} ${d.last_name?.S || ''}`.trim(),
            ])
        );

        const doctorSpecialityMap = Object.fromEntries(
            (batchResult.Responses?.Doctors || []).map((d) => [d.id.S, d.speciality?.S || 'General Practitioner'])
        );

        const mappedAppointments = appointments.map((a) => {
            const appointment = {
                id: a.id.S,
                date: a.date.S,
                start_time: a.start_time.S,
                end_time: a.end_time.S,
            };

            if (type === 'patient') {
                appointment.doctor_name = doctorMap[a.doctor_id.S] || a.doctor_id.S;
                appointment.speciality = doctorSpecialityMap[a.doctor_id.S] || '';
            } else if (type === 'doctor') {
                appointment.patient_name = patientMap[a.patient_id.S] || a.patient_id.S;
            }

            return appointment;
        });

        const startIndex = (pageNo - 1) * pageSize;
        const paginatedAppointments = mappedAppointments?.slice(startIndex, startIndex + pageSize);

        return res.status(200).json({
            success: true,
            currentPageNo: pageNo,
            limit: pageSize,
            totalAppointments: mappedAppointments?.length,
            data: paginatedAppointments,
        });
    } catch (err) {
        console.error('Error fetching appointments:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

const viewAppointmentData = async (req, res) => {
    try {
        const { appointment_id, type } = req.body;

        if (!appointment_id) return res.status(400).json({ success: false, message: 'appointment_id is required' });
        if (!['doctor', 'patient'].includes(type))
            return res.status(400).json({ success: false, message: "type must be either 'doctor' or 'patient'" });

        const appointmentCommand = new GetItemCommand({
            TableName: 'Appointments',
            Key: { id: { S: appointment_id } },
        });
        const appointmentResult = await client.send(appointmentCommand);
        const appointment = appointmentResult.Item;

        if (!appointment) return res.status(404).json({ success: false, message: 'Appointment not found' });

        const doctorId = appointment?.doctor_id.S;
        const patientId = appointment?.patient_id.S;

        const doctorCommand = new GetItemCommand({
            TableName: 'Doctors',
            Key: { id: { S: doctorId } },
        });
        const doctorResult = await client.send(doctorCommand);
        const doctor = doctorResult.Item;

        const patientCommand = new GetItemCommand({
            TableName: 'Patients',
            Key: { id: { S: patientId } },
        });
        const patientResult = await client.send(patientCommand);
        const patient = patientResult.Item;

        const dob = patient?.dob?.S;
        const age = dob ? differenceInYears(new Date(), parseISO(dob)) : null;

        const responseData = {
            appointment_id: appointment.id.S,
            date: appointment.date.S,
            start_time: appointment.start_time.S,
            end_time: appointment.end_time?.S,
            note: appointment.note?.S || '',

            doctor: {
                id: doctorId,
                name: `${doctor?.first_name?.S || ''} ${doctor?.last_name?.S || ''}`.trim(),
                speciality: doctor?.speciality?.S || '',
            },

            patient: {
                id: patientId,
                name: `${patient?.first_name?.S || ''} ${patient?.last_name?.S || ''}`.trim(),
                age,
                blood_grp: patient?.blood_grp?.S || '',
                phone_no: patient?.phone_no?.S || '',
                email: patient?.email?.S || '',
                address: patient?.address?.S || '',
            },
        };

        return res.status(200).json({ success: true, data: responseData });
    } catch (err) {
        console.error('Error fetching appointment data:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message,
        });
    }
};

const getPatientDashboard = async (req, res) => {
    try {
        const { patient_id } = req.body;
        if (!patient_id) return res.status(400).json({ success: false, message: 'patient_id is required' });

        const todayStr = new Date().toISOString().split('T')[0];

        const appointmentScan = new ScanCommand({
            TableName: 'Appointments',
            FilterExpression: 'patient_id = :patId AND #date >= :today',
            ExpressionAttributeValues: {
                ':patId': { S: patient_id },
                ':today': { S: todayStr },
            },
            ExpressionAttributeNames: {
                '#date': 'date',
            },
        });

        const appointmentResult = await client.send(appointmentScan);
        let appointments = (appointmentResult.Items || [])
            .map((a) => ({
                id: a.id.S,
                doctor_id: a.doctor_id.S,
                date: a.date.S,
                start_time: a.start_time?.S || '',
                end_time: a.end_time?.S || '',
                note: a.note?.S || '',
            }))
            .sort((a, b) => new Date(`${a.date}T${a.start_time}`) - new Date(`${b.date}T${b.start_time}`))
            .slice(0, 3);

        const doctorIds = [...new Set(appointments.map((a) => a.doctor_id))];

        let doctorMap = {};
        if (doctorIds?.length > 0) {
            const doctorBatch = new BatchGetItemCommand({
                RequestItems: {
                    Doctors: {
                        Keys: doctorIds.map((id) => ({ id: { S: id } })),
                        ProjectionExpression: 'id, first_name, last_name, speciality',
                    },
                },
            });
            const doctorResult = await client.send(doctorBatch);

            doctorMap = Object.fromEntries(
                (doctorResult.Responses?.Doctors || []).map((d) => [
                    d.id.S,
                    {
                        name: `${d.first_name?.S || ''} ${d.last_name?.S || ''}`.trim(),
                        speciality: d.speciality?.S || 'General Practitioner',
                    },
                ])
            );

            appointments = appointments.map((a) => ({
                ...a,
                doctor_name: doctorMap[a.doctor_id]?.name || '',
                speciality: doctorMap[a.doctor_id]?.speciality || '',
            }));
        }

        const ordersScan = new ScanCommand({
            TableName: 'Orders',
            FilterExpression: 'patient_id = :patId AND #status <> :collected',
            ExpressionAttributeValues: {
                ':patId': { S: patient_id },
                ':collected': { S: 'Collected' },
            },
            ExpressionAttributeNames: {
                '#status': 'status',
            },
        });

        const ordersResult = await client.send(ordersScan);
        const orders = ordersResult.Items || [];

        const ordersReady = [];
        const ordersNotReady = [];

        orders.forEach((o) => {
            const orderObj = {
                order_id: o.id.S,
                appointment_id: o.appointment_id?.S,
                doctor_id: o.doctor_id?.S,
                pharma_id: o.pharma_id?.S,
                status: o.status.S,
                time: o.time.S,
            };

            if (o.status.S === 'Ready' && ordersReady.length < 3) {
                ordersReady.push(orderObj);
            } else if (o.status.S !== 'Ready' && ordersNotReady?.length < 3) {
                ordersNotReady.push(orderObj);
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                patient_id,
                appointments,
                ordersReady,
                ordersNotReady,
            }
        });
    } catch (err) {
        console.error('Error fetching patient dashboard:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

module.exports = {
    loginPatients,
    checkDoctorAvailability,
    createNewAppointment,
    viewAppointments,
    viewAppointmentData,
    getPatientDashboard,
};
