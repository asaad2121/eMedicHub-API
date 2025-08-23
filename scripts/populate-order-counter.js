// node scripts/populate-order-counter.js
const { DynamoDBClient, ScanCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const projectTables = ['Medicines', 'Doctors', 'Patients', 'Appointments', 'Pharmacy', 'Orders'];

/**
 * Extract numeric part from ID string
 * e.g., 'ORD-120' => 120
 */
const getNumericId = (idStr) => {
    if (!idStr) return 0;
    const match = idStr.match(/\d+$/);
    return match ? parseInt(match[0], 10) : 0;
};

const run = async () => {
    for (const tableName of projectTables) {
        try {
            const command = new ScanCommand({
                TableName: tableName,
                ProjectionExpression: 'id',
            });

            const response = await client.send(command);

            const ids = response.Items.map((item) => {
                return getNumericId(item.id.S);
            });

            const maxId = ids?.length > 0 ? Math.max(...ids) : 0;

            const putCommand = new PutItemCommand({
                TableName: 'OrderCounter',
                Item: {
                    id: { S: tableName },
                    lastValue: { N: maxId.toString() },
                },
            });

            await client.send(putCommand);
            console.log(`Populated counter for ${tableName} with lastValue = ${maxId}`);
        } catch (err) {
            console.error(`Error processing table ${tableName}:`, err);
        }
    }
};

run();
