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

const handleLogin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ 'message': 'Email and password are required.' });

    const foundUser = await getUserByEmail(email);
    if (!foundUser) return res.sendStatus(401);

    const match = await bcrypt.compare(password, foundUser.password);
    if (match) {
		req.session.user = foundUser;
        return res.redirect('/');
    }
    res.sendStatus(401);
}

module.exports = { handleLogin };