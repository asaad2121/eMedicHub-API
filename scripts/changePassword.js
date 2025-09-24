#!/usr/bin/env node
const { DynamoDBClient, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { generateHashedPassword } = require('../controllers/utils/functions');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

async function changePassword() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node scripts/changePassword.js <USER_ID> <NEW_PASSWORD>');
        process.exit(1);
    }

    const [userId, newPassword] = args;

    let tableName;
    if (userId.startsWith('DOC')) {
        tableName = 'Doctors';
    } else if (userId.startsWith('PAT')) {
        tableName = 'Patients';
    } else if (userId.startsWith('PHAR')) {
        tableName = 'Pharmacy';
    } else {
        console.error('Invalid user ID prefix. Must start with DOC, PAT, or PHAR.');
        process.exit(1);
    }

    try {
        return;
        const hashedPassword = await generateHashedPassword(newPassword);
        const now = new Date().toISOString();

        const updateCmd = new UpdateItemCommand({
            TableName: tableName,
            Key: { id: { S: userId } },
            UpdateExpression: 'SET password = :newPassword, last_password_update_utc = :now',
            ExpressionAttributeValues: {
                ':newPassword': { S: hashedPassword },
                ':now': { S: now },
            },
        });

        await client.send(updateCmd);
        console.log(`Password updated successfully for ${userId}`);
    } catch (err) {
        console.error('Error updating password:', err);
        process.exit(1);
    }
}

changePassword();
