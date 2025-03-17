var express = require('express');
var router = express.Router();

const pool = require('../dbConnection');
const logger = require('../logger');

const cabinetController = require('../controllers/cabinetController');
/*
const sandboxesDB = {
    sandboxes: require('../model/sandboxes.json')
}
*/

const configurationDB = {
    configuration: require('../model/configuration.json')
}

router.post('/', cabinetController.handleNewSandbox);

async function getSandboxesByOwner(owner) {
	logger.info(["getSandboxesByOwner :: START", owner])
	try {
		let values = [owner];
		var sql = "SELECT * FROM sandboxes WHERE ownerid = ?";
		const [results, fields] = await pool.execute(sql, values);
		logger.info(results);
		logger.info(["getSandboxesByOwner :: END", owner])
		return results;
	} catch (error) {
		logger.error('getSandboxesByOwner ERROR:', error);
		return null;
	}
}

async function getSandboxByUuid(uuid) {
	logger.info(["getSandboxByUuid :: START", uuid])
	try {
		let values = [uuid];
		var sql = "SELECT * FROM sandboxes WHERE uuid = ?";
		const [results, fields] = await pool.execute(sql, values);
		logger.info(results);
		logger.info(["getSandboxByUuid :: END", uuid])
		return results[0];
	} catch (error) {
		logger.error('getSandboxByUuid ERROR:', error);
		return null;
	}
}

const handleGetIndex = async (req, res) => {
	var user = req.session.user;
	console.log(req.session);
	console.log(user);

	var sandboxes = await getSandboxesByOwner(user.uuid);
	res.render('cabinet', {
		user: user,
        	sandboxes: sandboxes,
	        configuration: configurationDB.configuration,
		title: 'Песочницы'
	});

}

const handleGetCabinet = async (req, res) => {
	var user = req.session.user;
	var cabinetUuid = req.params.cabinetUuid;
	console.log(cabinetUuid);
//  var sandbox = sandboxesDB.sandboxes.find(sandbox => sandbox.uuid === cabinetUuid);
	var sandbox = await getSandboxByUuid(cabinetUuid);
	console.log(sandbox);
	if (!sandbox) return res.sendStatus(404); //Unauthorized 
	var sessionLink = configurationDB.configuration.servername.concat("/session/sid_", sandbox.sessionUuid, "/opsid_", sandbox.uuid);
	var sessionViewLink = configurationDB.configuration.servername.concat("/session/view/", sandbox.uuid);

	res.render('cabinetDetails', {
		user: user,
		sandbox: sandbox,
		sessionLink: sessionLink,
		sessionViewLink: sessionViewLink,
		title: 'Песочница ' + sandbox.name
	});
}

/* GET home page. */
router.get('/', handleGetIndex);

router.get('/:cabinetUuid', handleGetCabinet);

module.exports = router;
