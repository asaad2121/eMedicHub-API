const IdTypes = Object.freeze({
    PASSPORT: 'Passport',
    DRIVER_LICENSE: 'Driver License',
    NATIONAL_ID: 'National ID',
});

const OrderStatus = Object.freeze({
    CREATED: 'Created',
    READY: 'Ready',
    COLLECTED: 'Collected',
});

const BloodGroups = Object.freeze({
    A_POS: 'A+',
    A_NEG: 'A-',
    B_POS: 'B+',
    B_NEG: 'B-',
    O_POS: 'O+',
    O_NEG: 'O-',
    AB_POS: 'AB+',
    AB_NEG: 'AB-',
});

const AgeRanges = Object.freeze({
    '0-9': [0, 9],
    '10-17': [10, 17],
    '18-30': [18, 30],
    '31-50': [31, 50],
    '51+': [51, 200],
});

module.exports = { IdTypes, BloodGroups, OrderStatus, AgeRanges };
