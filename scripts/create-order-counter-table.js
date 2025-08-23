// node scripts/create-order-counter-table.js
const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const params = {
    TableName: 'OrderCounter',
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
};

const run = async () => {
    try {
        const data = await client.send(new CreateTableCommand(params));
        console.log('OrderCounter table created:', data.TableDescription.TableName);
    } catch (err) {
        console.error('Error creating OrderCounter table:', err);
    }
};

run();
