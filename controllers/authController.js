const pool = require('../dbConnection');
const logger = require('../logger');

const usersDB = {
    users: require('../model/users.json'),
    setUsers: function (data) { this.users = data }
}
const bcrypt = require('bcrypt');

async function getUserByEmail(email) {
	logger.info(["getUserByEmail :: START", email])
	try {
		let values = [email];
		var sql = "SELECT * FROM users WHERE email = ?";
		const [results, fields] = await pool.execute(sql, values);
		logger.info(results);
		return results[0];
	} catch (error) {
		logger.error('getUserByEmail ERROR:', error);
		return null;
	}
}

const handleLogin = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ 'message': 'Email and password are required.' });

//    const foundUser = usersDB.users.find(person => person.email === email);
    let foundUser = await getUserByEmail(email);
    if (!foundUser) return res.sendStatus(401); //Unauthorized 

    // evaluate password 
    const match = await bcrypt.compare(password, foundUser.password);
    if (match) {
	req.session.user = foundUser;
        res.redirect('/');
        // create JWTs
//        res.json({ 'success': `User ${foundUser.username} is logged in!` });
    } else {
        res.sendStatus(401);
    }
}

module.exports = { handleLogin };