const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');
const bcrypt = require('bcryptjs');
const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const getUserProfile = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ success: false, message: 'User ID is required' });
        }

        let tableName;
        if (id.startsWith('DOC')) {
            tableName = 'Doctors';
        } else if (id.startsWith('PAT')) {
            tableName = 'Patients';
        } else if (id.startsWith('PHAR')) {
            tableName = 'Pharmacy';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid user ID prefix' });
        }

        const command = new GetItemCommand({
            TableName: tableName,
            Key: { id: { S: id } },
        });

        const result = await client.send(command);

        if (!result.Item) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const userData = {};
        for (const [key, value] of Object.entries(result.Item)) {
            if (key === 'password') continue; // Skip password
            if (value.S !== undefined) userData[key] = value.S;
            else if (value.N !== undefined) userData[key] = Number(value.N);
            else if (value.BOOL !== undefined) userData[key] = value.BOOL;
            else if (value.M !== undefined) {
                userData[key] = Object.fromEntries(
                    Object.entries(value.M).map(([k, v]) => [k, v.S || v.N || v.BOOL || null])
                );
            }
        }

        return res.status(200).json({
            success: true,
            message: 'User profile fetched successfully',
            data: userData,
        });
    } catch (err) {
        console.error('Error fetching user profile:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

const resetPassword = async (req, res) => {
    try {
        const { id, oldPassword, newPassword } = req.body;

        if (!id || !oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'id, oldPassword, and newPassword are required' });
        }

        let tableName;
        if (id.startsWith('DOC')) {
            tableName = 'Doctors';
        } else if (id.startsWith('PAT')) {
            tableName = 'Patients';
        } else if (id.startsWith('PHAR')) {
            tableName = 'Pharmacy';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid user ID' });
        }

        const getCmd = new GetItemCommand({
            TableName: tableName,
            Key: { id: { S: id } },
        });

        const result = await client.send(getCmd);

        if (!result.Item) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const storedHash = result.Item.password?.S;
        if (!storedHash) return res.status(500).json({ success: false, message: 'User has no password set' });

        const isMatch = await bcrypt.compare(oldPassword, storedHash);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Old password is incorrect' });

        const hashedPassword = await generateHashedPassword(newPassword);
        const now = new Date().toISOString();

        const updateCmd = new UpdateItemCommand({
            TableName: tableName,
            Key: { id: { S: id } },
            UpdateExpression: 'SET password = :newPassword, last_password_update_utc = :now',
            ExpressionAttributeValues: {
                ':newPassword': { S: hashedPassword },
                ':now': { S: now },
            },
        });

        await client.send(updateCmd);

        return res.status(200).json({
            success: true,
            message: 'Password updated successfully. All previous sessions are now invalid.',
        });
    } catch (err) {
        console.error('Error resetting password:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};

module.exports = {
    getUserProfile,
    resetPassword,
};
