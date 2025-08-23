// node scripts/add-medicines-from-csv.js
const fs = require('fs');
const csv = require('csv-parser');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const filePath = 'csv/medicine_data.csv';

let counter = 1;

const addMedicine = async (medicine) => {
    const item = {
        id: { S: `MED-${String(counter).padStart(3, '0')}` }, // eg. MED-001
        name: { S: medicine['Name'] },
        price: { N: medicine['Cost'] },
        company: { S: medicine['Company'] || 'Unknown' },
        salt: { S: medicine['Salt'] || 'Unknown' },
        prescription_required: { BOOL: medicine['Prescription Required'].toLowerCase() === 'yes' },
    };

    counter++;

    const command = new PutItemCommand({
        TableName: 'Medicines',
        Item: item,
    });

    try {
        await client.send(command);
        console.log(`Added: ${item.id.S} -> ${item.name.S}`);
    } catch (err) {
        console.error('Error adding medicine:', err);
    }
};

const run = async () => {
    fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
            addMedicine(row);
        })
        .on('end', () => {
            console.log('CSV processing completed.');
        });
};

run();
