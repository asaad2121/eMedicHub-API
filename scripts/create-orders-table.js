// node scripts/create-orders-table.js
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const params = {
    TableName: 'Orders',
    AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'appointment_id', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
        {
            IndexName: 'appointment-index',
            KeySchema: [{ AttributeName: 'appointment_id', KeyType: 'HASH' }],
            Projection: { ProjectionType: 'ALL' },
        },
    ],
    BillingMode: 'PAY_PER_REQUEST',
};

const run = async () => {
    try {
        const data = await client.send(new CreateTableCommand(params));
        console.log('Orders table created:', data.TableDescription.TableName);
    } catch (err) {
        console.error('Error creating Orders table:', err);
    }
};

run();
