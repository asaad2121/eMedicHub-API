// node scripts/add-pharmacy-to-table.js
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const hashPassword = async (plainPassword) => {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(plainPassword, salt);
};

const addPharmacy = async () => {
    const hashedPassword = await hashPassword('Pharma@123');

    const pharmacy = {
        id: { S: 'PHAR-001' },
        name: { S: 'City Pharmacy' },
        manager: { S: 'John Doe' },
        email: { S: 'citypharma@example.com' },
        password: { S: hashedPassword },
        working_hours: {
            M: {
                monday: { M: { start: { S: '09:00' }, end: { S: '18:00' } } },
                tuesday: { M: { start: { S: '09:00' }, end: { S: '18:00' } } },
                wednesday: { M: { start: { S: '09:00' }, end: { S: '18:00' } } },
                thursday: { M: { start: { S: '09:00' }, end: { S: '18:00' } } },
                friday: { M: { start: { S: '09:00' }, end: { S: '18:00' } } },
            },
        },
    };

    try {
        await client.send(new PutItemCommand({ TableName: 'Pharmacy', Item: pharmacy }));
        console.log('Pharmacy added successfully!');
    } catch (err) {
        console.error('Error adding pharmacy:', err);
    }
};

addPharmacy();
