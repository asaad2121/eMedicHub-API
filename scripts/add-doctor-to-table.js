// node scripts/add-doctor-to-table.js
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const hashPassword = async (plainPassword) => {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(plainPassword, salt);
};

const addDoctor = async () => {
    const hashedPassword = await hashPassword('Test@123');

    const doctor = {
        id: { S: 'DOC-001' },
        first_name: { S: 'Alice' },
        last_name: { S: 'Smith' },
        dob: { S: '1985-06-15' },
        email: { S: 'alice@example.com' },
        password: { S: hashedPassword },
        speciality: { S: 'General Practitioner' },
        visiting_hours: {
            M: {
                monday: { M: { start: { S: '09:00' }, end: { S: '17:00' } } },
                tuesday: { M: { start: { S: '10:00' }, end: { S: '16:00' } } },
                wednesday: { M: { start: { S: '10:00' }, end: { S: '16:00' } } },
                thursday: { M: { start: { S: '10:00' }, end: { S: '16:00' } } },
                friday: { M: { start: { S: '10:00' }, end: { S: '16:00' } } },
            },
        },
    };

    const command = new PutItemCommand({
        TableName: 'Doctors',
        Item: doctor,
    });

    try {
        await client.send(command);
        console.log('Doctor added successfully!');
    } catch (error) {
        console.error('Error adding doctor:', error);
    }
};

addDoctor();
