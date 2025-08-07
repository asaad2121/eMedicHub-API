// node scripts/create-doctors-table.js
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ quiet: true });
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const params = {
    TableName: 'Doctors',
    AttributeDefinitions: [
        { AttributeName: 'id', AttributeType: 'S' },
        { AttributeName: 'email', AttributeType: 'S' },
    ],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    GlobalSecondaryIndexes: [
        {
            IndexName: 'email-index',
            KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
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
