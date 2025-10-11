const pool = require('../dbConnection');
const logger = require('../logger');
const bcrypt = require('bcrypt');

async function getUserByEmail(email) {
	logger.info(["getUserByEmail :: START", email]);
	try {
		const sql = "SELECT * FROM users WHERE email = ?";
		const [results] = await pool.execute(sql, [email]);
		logger.info(results);
		return results && results[0];
	} catch (error) {
		logger.error('getUserByEmail ERROR:', error);
		return null;
	}
}

async function insertNewUser(email, username, password) {
	logger.info(["insertNewUser :: START", email, username, '***']);
	try {
		const sql = "INSERT INTO users (`username`, `email`, `password`) VALUES (?, ?, ?)";
		const [results] = await pool.execute(sql, [username, email, password]);
		logger.info(results);
		return results;
	} catch (error) {
		logger.error('insertNewUser ERROR:', error);
		return null;
	}
}

const handleNewUser = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ 'message': 'Username and password are required.' });

    const duplicate = await getUserByEmail(email);
    if (duplicate) {
        return res.status(409).json({ 'message': 'Пользователь с таким email уже есть в системе' });
    }
    try {
        const hashedPwd = await bcrypt.hash(password, 10);
        await insertNewUser(email, name, hashedPwd);
        return res.status(201).json({ 'success': `New user ${name} created!` });
    } catch (err) {
        return res.status(500).json({ 'message': err.message });
    }
}

module.exports = { handleNewUser };