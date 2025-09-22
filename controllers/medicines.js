const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const getMedsByName = async (req, res) => {
    const { name } = req.query;

    if (typeof name !== 'string') {
        return res.status(400).json({
            success: false,
            message: 'Search term must be a string',
        });
    }

    if (!name || name?.length < 4) {
        return res.status(400).json({
            success: false,
            message: 'Search term must be at least 4 characters',
        });
    }

    try {
        const safeName = name.trim();
        const capitalizedName = safeName.charAt(0).toUpperCase() + safeName.slice(1);
        const command = new ScanCommand({
            TableName: 'Medicines',
            FilterExpression: 'contains(#nm, :name)',
            ExpressionAttributeNames: {
                '#nm': 'name',
            },
            ExpressionAttributeValues: {
                ':name': { S: capitalizedName },
            },
        });

        const response = await client.send(command);

        const medicines = response.Items.map((item) => ({
            id: item.id?.S,
            name: item.name?.S,
            price: parseFloat(item.price?.N),
            // company: item.company?.S,
            // salt: item.salt?.S,
            // prescription_required: item.prescription_required?.BOOL || false,
        }));

        return res.status(200).json({ success: true, data: medicines, message: 'Medicines fetched' });
    } catch (err) {
        console.error('Error fetching medicines:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = { getMedsByName };
