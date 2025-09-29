const jwt = require('jsonwebtoken');
const {
    DynamoDBClient,
    QueryCommand,
    ScanCommand,
    PutItemCommand,
    GetItemCommand,
    UpdateItemCommand,
} = require('@aws-sdk/client-dynamodb');
const { IdTypes, BloodGroups, AgeRanges } = require('./utils/constants');
const { differenceInYears, parseISO, format } = require('date-fns');
const { verifyPassword, generateHashedPassword, getNextId } = require('./utils/functions');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const loginDoctors = async (req, res) => {
    const { email, password, stayLoggedIn } = req.body;

    try {
        const command = new QueryCommand({
            TableName: 'Doctors',
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: { ':email': { S: email } },
        });

        const response = await client.send(command);
        const doctor = response.Items?.[0];

        if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

        const isMatch = await verifyPassword(password, doctor.password.S);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

        let lastPwUpdate = doctor.last_password_update_utc?.S;
        if (!lastPwUpdate) {
            lastPwUpdate = new Date().toISOString();
            const updateCmd = new UpdateItemCommand({
                TableName: 'Doctors',
                Key: { id: { S: doctor.id.S } },
                UpdateExpression: 'SET last_password_update_utc = :now',
                ExpressionAttributeValues: { ':now': { S: lastPwUpdate } },
            });
            await client.send(updateCmd);
        }

        const refreshTokenExpiresIn = stayLoggedIn ? '30d' : '1d';
        const refreshTokenMaxAge = stayLoggedIn ? 2592000000 : 86400000;

        const token = jwt.sign({ _id: doctor.id.S, lastPwUpdate }, process.env.JWT_SECRET, { expiresIn: '30m' });
        const refreshToken = jwt.sign({ _id: doctor.id.S, lastPwUpdate }, process.env.JWT_REFRESH_SECRET, {
            expiresIn: refreshTokenExpiresIn,
        });

        res.cookie('jwt_doctor', token, {
            httpOnly: true,
            maxAge: 1800000,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
        });

        res.cookie('refresh_token_doctor', refreshToken, {
            httpOnly: true,
            maxAge: refreshTokenMaxAge,
            secure: process.env.ENVIRONMENT === 'prod',
            sameSite: process.env.ENVIRONMENT === 'prod' ? 'None' : 'Lax',
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
        console.error('Doctor login error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

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

        const dobDate = new Date(dob);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(dobDate?.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format for dob' });
        }
        if (dobDate >= today) {
            return res.status(400).json({ success: false, message: 'Date of birth must be before today' });
        }

        const emailQuery = new QueryCommand({
            TableName: 'Patients',
            IndexName: 'email-index',
            KeyConditionExpression: 'email = :email',
            ExpressionAttributeValues: {
                ':email': { S: email },
            },
            Limit: 1,
        });

        const emailResult = await client.send(emailQuery);

        if (emailResult.Count > 0) {
            return res.status(409).json({ success: false, message: 'Patient with this email already exists' });
        }
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

const viewPatients = async (req, res) => {
    try {
        const {
            searchPatient,
            ageRange,
            bloodGrp,
            lastAppointmentStart,
            lastAppointmentEnd,
            limit = 10,
            currentPageNo = 1,
            doctor_id,
        } = req.body;

        let start, end;
        if (lastAppointmentStart) {
            start = parseISO(lastAppointmentStart);
            if (isNaN(start.getTime())) return res.status(400).json({ success: false, message: 'Invalid start date' });
        }

        if (lastAppointmentEnd) {
            end = parseISO(lastAppointmentEnd);
            if (isNaN(end.getTime())) return res.status(400).json({ success: false, message: 'Invalid end date' });
        }

        if (!doctor_id) return res.status(400).json({ success: false, message: 'doctor_id is required' });

        const pageSize = parseInt(limit);
        const pageNo = parseInt(currentPageNo);

        let filterExpression = '';
        const expressionAttributeValues = {};
        const expressionAttributeNames = {};

        let normalizedSearch = '';
        if (typeof searchPatient === 'string') {
            normalizedSearch = searchPatient.trim();
        } else if (Array.isArray(searchPatient)) {
            normalizedSearch = searchPatient[0]?.trim() ?? '';
        }

        if (normalizedSearch.length >= 2) {
            filterExpression += '(contains(#fn, :search) OR contains(#ln, :search))';
            const capitalizedSearch = normalizedSearch.charAt(0).toUpperCase() + normalizedSearch.slice(1);
            expressionAttributeValues[':search'] = { S: capitalizedSearch };
            expressionAttributeNames['#fn'] = 'first_name';
            expressionAttributeNames['#ln'] = 'last_name';
        }

        const bgInput = bloodGrp?.trim().toUpperCase();
        if (bgInput && Object.values(BloodGroups).includes(bgInput)) {
            expressionAttributeNames['#bg'] = 'blood_grp';
            filterExpression = filterExpression ? `${filterExpression} AND #bg = :bloodGrp` : '#bg = :bloodGrp';
            expressionAttributeValues[':bloodGrp'] = { S: bgInput };
        }

        if (filterExpression) filterExpression += ' AND ';
        filterExpression += 'gp_id = :gpId';
        expressionAttributeValues[':gpId'] = { S: doctor_id };

        let patients = [];
        let lastEvaluatedKey = null;
        const itemsNeeded = pageNo * pageSize;

        while (patients?.length < itemsNeeded) {
            const scanCommand = new ScanCommand({
                TableName: 'Patients',
                FilterExpression: filterExpression || undefined,
                ExpressionAttributeValues: Object.keys(expressionAttributeValues)?.length
                    ? expressionAttributeValues
                    : undefined,
                ExpressionAttributeNames: Object.keys(expressionAttributeNames)?.length
                    ? expressionAttributeNames
                    : undefined,
                ExclusiveStartKey: lastEvaluatedKey,
            });

            const scanResult = await client.send(scanCommand);
            patients.push(...(scanResult.Items || []));
            lastEvaluatedKey = scanResult.LastEvaluatedKey;
            if (!lastEvaluatedKey) break;
        }

        let mappedPatients = patients.map((p) => {
            const dob = p.dob?.S;
            const age = dob ? differenceInYears(new Date(), parseISO(dob)) : null;
            return {
                id: p.id.S,
                first_name: p.first_name.S,
                last_name: p.last_name.S,
                dob,
                age,
                blood_grp: p.blood_grp?.S?.trim().toUpperCase() || null,
                email: p.email?.S,
                phone_no: p.phone_no?.S,
                address: p.address?.S || '',
                gp_id: p.last_gp_visited?.S || p.gp_id?.S || null,
            };
        });

        const uniqueGpIds = [...new Set(mappedPatients.map((p) => p.gp_id).filter(Boolean))];
        let gpMap = {};
        if (uniqueGpIds?.length > 0) {
            for (const gpId of uniqueGpIds) {
                const docCmd = new GetItemCommand({
                    TableName: 'Doctors',
                    Key: { id: { S: gpId } },
                });
                const docResult = await client.send(docCmd);
                if (docResult.Item) {
                    gpMap[gpId] = `${docResult.Item.first_name?.S || ''} ${docResult.Item.last_name?.S || ''}`.trim();
                }
            }
        }

        mappedPatients = mappedPatients.map((p) => ({
            ...p,
            gp_name: p.gp_id ? gpMap[p.gp_id] || null : null,
        }));

        if (ageRange && AgeRanges[ageRange]) {
            const [minAge, maxAge] = AgeRanges[ageRange];
            mappedPatients = mappedPatients.filter((p) => p.age !== null && p.age >= minAge && p.age <= maxAge);
        }

        if (start || end) {
            const patientIds = mappedPatients.map((p) => p.id);

            if (patientIds?.length > 0) {
                const appointmentsFilterParts = [];
                const appointmentsExpressionValues = {
                    ':start': { S: start.toISOString().split('T')[0] },
                    ':end': { S: end.toISOString().split('T')[0] },
                };
                const appointmentsExpressionNames = { '#patient_id': 'patient_id', '#date': 'date' };

                patientIds.forEach((id, i) => {
                    const key = `:p${i}`;
                    appointmentsExpressionValues[key] = { S: id };
                    appointmentsFilterParts.push(`#patient_id = ${key}`);
                });

                const appointmentsFilter = `(${appointmentsFilterParts.join(' OR ')}) AND #date BETWEEN :start AND :end`;

                const appointmentsCommand = new ScanCommand({
                    TableName: 'Appointments',
                    FilterExpression: appointmentsFilter,
                    ExpressionAttributeValues: appointmentsExpressionValues,
                    ExpressionAttributeNames: appointmentsExpressionNames,
                });

                const appointmentsResult = await client.send(appointmentsCommand);
                const patientIdsWithAppointments = new Set(appointmentsResult.Items?.map((a) => a.patient_id.S));

                mappedPatients = mappedPatients.filter((p) => patientIdsWithAppointments.has(p.id));
            }
        }

        if (!searchPatient && !ageRange && !bloodGrp && !start && !end) {
            mappedPatients.sort((a, b) => b.id.localeCompare(a.id));
        }

        const startIndex = (pageNo - 1) * pageSize;
        const paginatedPatients = mappedPatients.slice(startIndex, startIndex + pageSize);

        return res.status(200).json({
            success: true,
            currentPageNo: pageNo,
            limit: pageSize,
            totalPatients: mappedPatients?.length,
            data: paginatedPatients,
        });
    } catch (err) {
        console.error('Error fetching patients:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

const getDoctorAppointmentsDashboard = async (req, res) => {
    try {
        const { doctor_id } = req.body;

        if (!doctor_id) return res.status(400).json({ success: false, message: 'doctor_id is required' });

        const today = format(new Date(), 'yyyy-MM-dd');

        const scanCommand = new ScanCommand({
            TableName: 'Appointments',
            FilterExpression: 'doctor_id = :docId AND #date = :today',
            ExpressionAttributeValues: {
                ':docId': { S: doctor_id },
                ':today': { S: today },
            },
            ExpressionAttributeNames: {
                '#date': 'date',
            },
        });

        const scanResult = await client.send(scanCommand);
        const appointments = scanResult.Items || [];

        const mappedAppointments = appointments.map((a) => ({
            id: a.id?.S,
            doctor_id: a.doctor_id?.S,
            patient_id: a.patient_id?.S,
            date: a.date?.S,
            start_time: a.start_time?.S,
            end_time: a.end_time?.S,
            note: a.note?.S || '',
            status: a.status?.S || 'Upcoming',
        }));

        const todayAppointments = mappedAppointments.filter((a) => a.date === today);

        const { completed, upcoming } = todayAppointments.reduce(
            (acc, a) => {
                if (a.status === 'Completed') acc.completed++;
                else acc.upcoming++;
                return acc;
            },
            { completed: 0, upcoming: 0 }
        );

        const totalToday = todayAppointments?.length;

        const topAppointments = todayAppointments.slice(0, 3);

        return res.status(200).json({
            success: true,
            data: {
                totalToday,
                completed,
                upcoming,
                appointments: topAppointments,
            },
        });
    } catch (err) {
        console.error('Error fetching doctor dashboard:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

module.exports = {
    loginDoctors,
    getAllDoctors,
    addNewPatientPost,
    addNewPatientGet,
    viewPatients,
    getDoctorAppointmentsDashboard,
};
