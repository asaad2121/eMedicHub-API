const bcrypt = require('bcryptjs');
const { UpdateItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const generateHashedPassword = async (password) => {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
};

const verifyPassword = async (password, hashedPassword) => {
    const result = await bcrypt.compare(password, hashedPassword);
    return result;
};

/**
 * Fetches and atomically increments a counter.
 * @param {string} id_name - Table name (e.g., 'Orders')
 * @returns {Promise<number>} - Next numeric value of the counter
 */
const getNextId = async (id_name) => {
    const command = new UpdateItemCommand({
        TableName: 'OrderCounter',
        Key: {
            id: { S: id_name },
        },
        UpdateExpression: 'SET lastValue = if_not_exists(lastValue, :start) + :inc',
        ExpressionAttributeValues: {
            ':start': { N: '0' },
            ':inc': { N: '1' },
        },
        ReturnValues: 'UPDATED_NEW',
    });

    const result = await client.send(command);

    return result.Attributes.lastValue.N;
};

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
    console.log(visitingHours);
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

module.exports = {
    generateHashedPassword,
    verifyPassword,
    getNextId,
    parseTime,
    formatTime,
    getDayOfWeek,
    getAvailableSlots,
};
