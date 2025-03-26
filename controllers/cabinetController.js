const pool = require('../dbConnection');
const logger = require('../logger');

const { 
  v1: uuidv1,
  v4: uuidv4,
} = require('uuid');


async function insertNewSandbox(name, owner, sessionuuid) {
	logger.info(["insertNewSandbox :: START", name, owner, sessionuuid]);
	try {
		let values = [name, owner, sessionuuid];
		var sql = "INSERT INTO sandboxes (`name`, `ownerId`, `sessionUuid`) VALUES (?, ?, ?)";
		const [results, fields] = await pool.execute(sql, values);
		logger.info(results);
		logger.info(["insertNewSandbox :: END", name, owner, sessionuuid]);
		return results;
	} catch (error) {
		logger.error('insertNewSandbox ERROR:', error);
		return null;
	}
}

const handleNewSandbox = async (req, res) => {
    const { sandbox } = req.body;
    var user = req.session.user;

    if (!user) return res.status(400).json({ 'message': 'Пользователь не залогинен' });
    if (!sandbox) return res.status(400).json({ 'message': 'Имя песочницы - обязательное поле' });
    // check for duplicate usernames in the db
    try {
        //store the new user
	await insertNewSandbox(sandbox, user.uuid, uuidv4());
	res.redirect('/cabinet');
    } catch (err) {
        res.status(500).json({ 'message': err.message });
    }
}

module.exports = { handleNewSandbox };