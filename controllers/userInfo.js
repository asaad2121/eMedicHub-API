const { DynamoDBClient, GetItemCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const getUserProfile = async (req, res) => {
    try {
        const { id } = req.query;

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

module.exports = {
    getUserProfile,
};
