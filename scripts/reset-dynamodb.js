// node scripts/reset-dynamodb.js
const {
    DynamoDBClient,
    ListTablesCommand,
    DeleteTableCommand,
    DescribeTableCommand,
} = require('@aws-sdk/client-dynamodb');
const { exec } = require('child_process');
require('dotenv').config({ quiet: true });

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const projectTables = ['Medicines', 'Doctors', 'Patients', 'Appointments', 'Pharmacy', 'Orders', 'OrderCounter'];

async function deleteProjectTables() {
    try {
        const tablesData = await client.send(new ListTablesCommand({}));
        const existingTables = tablesData?.TableNames || [];

        const tablesToDelete = existingTables?.filter((t) => projectTables.includes(t));

        if (tablesToDelete?.length === 0) {
            console.log('No project tables found to delete.');
            return;
        }

        console.log('Tables to delete:', tablesToDelete);

        for (const tableName of tablesToDelete) {
            console.log(`Deleting table: ${tableName}`);
            await client.send(new DeleteTableCommand({ TableName: tableName }));

            // Wait until table is deleted before continuing
            await waitForTableDeleted(tableName);
            console.log(`Deleted table: ${tableName}`);
        }
    } catch (err) {
        console.error('Error deleting tables:', err);
        throw err;
    }
}

async function waitForTableDeleted(tableName) {
    // Poll DescribeTable until table no longer exists
    while (true) {
        try {
            await client.send(new DescribeTableCommand({ TableName: tableName }));
            console.log(`Waiting for table ${tableName} to be deleted...`);
            await sleep(3000);
        } catch (err) {
            if (err.name === 'ResourceNotFoundException') {
                // Table deleted
                break;
            }
            console.error('Error checking table deletion status:', err);
            throw err;
        }
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function runScript(command) {
    return new Promise((resolve, reject) => {
        console.log(`Running: ${command}`);
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error running ${command}:`, error);
                reject(error);
                return;
            }
            if (stdout) console.log(stdout);
            if (stderr) console.error(stderr);
            resolve();
        });
    });
}

async function waitForTableActive(tableName) {
    while (true) {
        try {
            const data = await client.send(new DescribeTableCommand({ TableName: tableName }));
            if (data.Table.TableStatus === 'ACTIVE') {
                console.log(`Table ${tableName} is ACTIVE`);
                break;
            }
            console.log(`Waiting for table ${tableName} to become ACTIVE...`);
            await sleep(3000);
        } catch (err) {
            console.error(`Error checking table status for ${tableName}:`, err);
            throw err;
        }
    }
}

async function main() {
    return; // Do not use it
    try {
        if (process.env.ENVIRONMENT !== 'dev') {
            console.error('ERROR: Reset script can only be run in local development environment!');
            process.exit(1);
        }

        await deleteProjectTables();

        // Create Doctors table and wait for it to be ACTIVE
        await runScript('node scripts/create-doctors-table.js');
        await waitForTableActive('Doctors');

        // Create Patients table and wait for it to be ACTIVE
        await runScript('node scripts/create-patients-table.js');
        await waitForTableActive('Patients');

        // Create Pharmacy table and wait for it to be ACTIVE
        await runScript('node scripts/create-pharmacy-table.js');
        await waitForTableActive('Pharmacy');

        // Create Medicines table and wait for it to be ACTIVE
        await runScript('node scripts/create-medicines-table.js');
        await waitForTableActive('Medicines');

        // Create Orders table and wait for it to be ACTIVE
        await runScript('node scripts/create-orders-table.js');
        await waitForTableActive('Orders');

        // Create Appointments table and wait for it to be ACTIVE
        await runScript('node scripts/create-appointments-table.js');
        await waitForTableActive('Appointments');

        // Create OrderCounter table and wait for it to be ACTIVE
        await runScript('node scripts/create-order-counter-table.js');
        await runScript('node scripts/populate-order-counter.js');
        await waitForTableActive('OrderCounter');

        // Now tables are active, add doctors, patients, pharmacy & medicines
        await runScript('node scripts/add-doctor-to-table.js');
        await runScript('node scripts/add-patient-to-table.js');
        await runScript('node scripts/add-pharmacy-to-table.js');
        await runScript('node scripts/add-medicines-from-csv.js');
        await runScript('node scripts/populate-order-counter.js');

        console.log('All tables reset and seeded successfully.');
    } catch (err) {
        console.error('Failed to reset DynamoDB:', err);
    }
}

main();
