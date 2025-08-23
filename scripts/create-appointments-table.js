// node scripts/create-appointments-table.js
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const params = {
    TableName: 'Appointments',
    AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'patient_id', AttributeType: 'S' },
        { AttributeName: 'doctor_id', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
        {
            IndexName: 'patient-index',
            KeySchema: [{ AttributeName: 'patient_id', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
        {
            IndexName: 'doctor-index',
            KeySchema: [{ AttributeName: 'doctor_id', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
    ],
    BillingMode: 'PAY_PER_REQUEST',
};

const run = async () => {
    try {
        const data = await client.send(new CreateTableCommand(params));
        console.log('Appointments table created:', data.TableDescription.TableName);
    } catch (err) {
        console.error('Error creating Appointments table:', err);
    }
};

run();
