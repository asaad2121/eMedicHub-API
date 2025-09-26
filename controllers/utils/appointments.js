const { GetItemCommand, ScanCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const parseTime = (str) => {
    const [h, m] = str.split(':').map(Number);
    return h * 60 + m;
};

const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const getDayOfWeek = (dateStr) => {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const d = new Date(dateStr);
    return days[d.getDay()];
};

const getAvailableSlots = (visitingHours, appointments, slotDuration = 30) => {
    const slots = [];
    const start = parseTime(visitingHours.start);
    const end = parseTime(visitingHours.end);

    let current = start;

    // sort appointments by start time
    appointments.sort((a, b) => parseTime(a.start) - parseTime(b.start));

    for (let i = 0; i <= appointments.length; i++) {
        const nextApptStart = i < appointments.length ? parseTime(appointments[i].start) : end;

        while (current + slotDuration <= nextApptStart) {
            slots.push(formatTime(current));
            current += slotDuration;
        }

        // jump over booked slot
        if (i < appointments.length) {
            current = parseTime(appointments[i].end);
        }
    }

    return slots;
};

const fetchDoctorAppointments = async (doctor_id, date) => {
    const docResp = await client.send(
        new GetItemCommand({
            TableName: 'Doctors',
            Key: { id: { S: doctor_id } },
        })
    );

    if (!docResp.Item) {
        throw new Error('Doctor not found');
    }

    const dayOfWeek = getDayOfWeek(date);
    const dayHours = docResp.Item.visiting_hours.M[dayOfWeek]?.M;

    if (!dayHours || !dayHours.start?.S || !dayHours.end?.S) {
        throw new Error('Doctor has no working hours on this day');
    }

    const workingHours = {
        start: dayHours.start.S,
        end: dayHours.end.S,
    };

    const apptResp = await client.send(
        new ScanCommand({
            TableName: 'Appointments',
            FilterExpression: '#doc = :doc AND #dt = :date',
            ExpressionAttributeNames: { '#doc': 'doctor_id', '#dt': 'date' },
            ExpressionAttributeValues: { ':doc': { S: doctor_id }, ':date': { S: date } },
            ProjectionExpression: 'start_time, end_time',
        })
    );

    const appointments = (apptResp.Items || []).map((i) => ({
        start: i.start_time.S,
        end: i.end_time.S,
    }));

    return { workingHours, appointments };
};

module.exports = {
    parseTime,
    formatTime,
    getDayOfWeek,
    getAvailableSlots,
    fetchDoctorAppointments,
};
