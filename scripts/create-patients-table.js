// node scripts/create-patients-table.js
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const params = {
    TableName: 'Patients',
    AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'first_name', AttributeType: 'S' },
        { AttributeName: 'last_name', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
        { AttributeName: 'blood_grp', AttributeType: 'S' },
        { AttributeName: 'phone_no', AttributeType: 'S' },
        { AttributeName: 'gp_id', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
        {
            IndexName: 'first_name-index',
            KeySchema: [{ AttributeName: 'first_name', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
        {
            IndexName: 'last_name-index',
            KeySchema: [{ AttributeName: 'last_name', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
        {
            IndexName: 'email-index',
            KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
        {
            IndexName: 'blood_grp-index',
            KeySchema: [{ AttributeName: 'blood_grp', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
        {
            IndexName: 'phone_no-index',
            KeySchema: [{ AttributeName: 'phone_no', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
        {
            IndexName: 'gp_id-index',
            KeySchema: [{ AttributeName: 'gp_id', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
    ],
    BillingMode: 'PAY_PER_REQUEST',
};

const run = async () => {
    try {
        const data = await client.send(new CreateTableCommand(params));
        console.log('Table created:', data.TableDescription.TableName);
    } catch (err) {
        console.error('Error creating table:', err);
    }
};

run();
