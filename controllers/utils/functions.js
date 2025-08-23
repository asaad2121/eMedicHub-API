const bcrypt = require('bcryptjs');
const { UpdateItemCommand, DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const generateHashedPassword = async (password) => {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
};

const verifyPassword = async (password, hashedPassword) => {
    const result = await bcrypt.compare(password, hashedPassword);
    return result;
};

/**
 * Fetches and atomically increments a counter.
 * @param {string} id_name - Table name (e.g., 'Orders')
 * @returns {Promise<number>} - Next numeric value of the counter
 */
const getNextId = async (id_name) => {

    const command = new UpdateItemCommand({
        TableName: 'OrderCounter',
        Key: {
            id: { S: id_name },
        },
        UpdateExpression: 'SET lastValue = if_not_exists(lastValue, :start) + :inc',
        ExpressionAttributeValues: {
            ':start': { N: '0' },
            ':inc': { N: '1' },
        },
        ReturnValues: 'UPDATED_NEW',
    });

    const result = await client.send(command);

    return result.Attributes.lastValue.N;
};

module.exports = {
    generateHashedPassword,
    verifyPassword,
    getNextId,
};
