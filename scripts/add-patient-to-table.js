// node scripts/add-patient-to-table.js
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const hashPassword = async (plainPassword) => {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    return await bcrypt.hash(plainPassword, salt);
};

const addPatient = async () => {
    const hashedPassword = await hashPassword('Test@123');

    const patient = {
        id: { S: 'PAT-0001' },
        first_name: { S: 'John' },
        last_name: { S: 'Doe' },
        dob: { S: '1990-05-20' },
        email: { S: 'john.doe@example.com' },
        password: { S: hashedPassword },
        blood_grp: { S: 'O+' },
        address: { S: '123 Main Street, Wellington' },
        phone_no: { S: '0211234567' },
        gp_id: { S: 'DOC-001' },
        id_type: { S: 'Passport' },
        id_number: { S: 'NZ1234567' },
        last_gp_visited: { S: 'DOC-001' },
    };

    const command = new PutItemCommand({
        TableName: 'Patients',
        Item: patient,
    });

    try {
        await client.send(command);
        console.log('Patient added successfully!');
    } catch (error) {
        console.error('Error adding patient:', error);
    }
};

addPatient();
