/*
var sandboxDB = {
    sandboxes: require('../model/sandboxes.json'),
    setSandbox: function (data) { this.sandboxes = data }
}
const fsPromises = require('fs').promises;
const path = require('path');
*/

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
console.log(results);
console.log(results.insertId);
		logger.info(results);
		logger.info(["insertNewSandbox :: END", name, owner, sessionuuid]);
		return results;
	} catch (error) {
		logger.error('insertNewSandbox ERROR:', error);
console.log(error);
		return null;
	}
}

const handleNewSandbox = async (req, res) => {
    const { sandbox } = req.body;
    var user = req.session.user;

    if (!user) return res.status(400).json({ 'message': 'Пользователь не залогинен' });
    if (!sandbox) return res.status(400).json({ 'message': 'Имя песочницы - обязательное поле' });
    // check for duplicate usernames in the db
//    const duplicate = sandboxDB.sandboxes.find(sandbox => sandbox.name === sandbox);
//    if (duplicate) return res.status(409).json({ 'message': 'Песочница с таким именем уже есть' });
    try {
        //store the new user
/*
        const newSandbox = { "name": sandbox, "owner": user.uuid, "uuid": uuidv4(), "sessionuuid": uuidv4()};
        sandboxDB.setSandbox([...sandboxDB.sandboxes, newSandbox]);
        await fsPromises.writeFile(
            path.join(__dirname, '..', 'model', 'sandboxes.json'),
            JSON.stringify(sandboxDB.sandboxes)
        );
        console.log(sandboxDB.sandboxes);
*/
	await insertNewSandbox(sandbox, user.uuid, uuidv4());
//        res.status(201).json({ 'success': `Новая песочница ${sandbox} создана!` });
	res.redirect('/cabinet');
    } catch (err) {
        res.status(500).json({ 'message': err.message });
    }
}

module.exports = { handleNewSandbox };