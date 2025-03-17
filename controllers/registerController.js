const pool = require('../dbConnection');
const logger = require('../logger');

const usersDB = {
    users: require('../model/users.json'),
    setUsers: function (data) { this.users = data }
}
const fsPromises = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');
const { 
  v1: uuidv1,
  v4: uuidv4,
} = require('uuid');

async function getUserByEmail(email) {
	logger.info(["getUserByEmail :: START", email]);
	try {
		let values = [email];
		var sql = "SELECT * FROM users WHERE email = ?";
		const [results, fields] = await pool.execute(sql, values);
console.log(results);
		logger.info(results);
		return results;
	} catch (error) {
		logger.error('getUserByEmail ERROR:', error);
console.log(error);
		return null;
	}
}

async function insertNewUser(email, username, password) {
	logger.info(["insertNewUser :: START", email, username, '***']);
	try {
		let values = [username, email, password];
		var sql = "INSERT INTO users (`username`, `email`, `password`) VALUES (?, ?, ?)";
		const [results, fields] = await pool.execute(sql, values);
console.log(results);
console.log(results.insertId);
		logger.info(results);
		return results;
	} catch (error) {
		logger.error('getUserByEmail ERROR:', error);
console.log(error);
		return null;
	}
}

const handleNewUser = async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ 'message': 'Username and password are required.' });
    // check for duplicate usernames in the db
//    const duplicate = usersDB.users.find(person => person.email === email);
//    const duplicate = usersDB.users.find(person => person.email === email);
    const duplicate = getUserByEmail(email);
console.log(duplicate);
//    if (duplicate) return res.sendStatus(409); //Conflict 
    if (duplicate && 0 < duplicate.length) {
        return res.status(409).json({ 'message': 'Пользователь с таким емейлом уже есть в системе' }); //Conflict 
    }
    try {
        //encrypt the password
        const hashedPwd = await bcrypt.hash(password, 10);
        //store the new user
//        const newUser = { "username": name, "email": email, "password": hashedPwd, "uuid": uuidv4() };
//        usersDB.setUsers([...usersDB.users, newUser]);
//        await fsPromises.writeFile(
//            path.join(__dirname, '..', 'model', 'users.json'),
//            JSON.stringify(usersDB.users)
//        );
//        console.log(usersDB.users);
        insertNewUser(email, name, hashedPwd);
        res.status(201).json({ 'success': `New user ${name} created!` });
    } catch (err) {
        res.status(500).json({ 'message': err.message });
    }
}

module.exports = { handleNewUser };