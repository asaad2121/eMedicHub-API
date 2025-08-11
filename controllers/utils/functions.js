const bcrypt = require('bcryptjs');

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

module.exports = {
    generateHashedPassword,
    verifyPassword,
};
