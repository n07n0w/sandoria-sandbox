var express = require('express');
var router = express.Router();

const pool = require('../dbConnection');
const logger = require('../logger');
const CategoryRepository = require('../repository/categoryRepository').CategoryRepository;
var categoryRepository = new CategoryRepository();

const SandboxRepository = require('../repository/sandboxRepository').SandboxRepository;
var sandboxRepository = new SandboxRepository();

const configurationDB = {
    configuration: require('../model/configuration.json')
}

const handleGetSession = async (req, res, next) => {
	var sessionId = req.params.sessionId;
	var opponentSessionId = req.params.opponentSessionId;
	var categories = await categoryRepository.getCategories();
	res.render('index', {
		categories: categories,
		sessionId: sessionId,
		opponentSessionId: opponentSessionId,
		title: 'Express'
	});
}

const handleGetSessionView = async (req, res, next) => {
	var user = req.session.user;
	var sessionId = req.params.sessionId;
	var categories = await categoryRepository.getCategories();
	res.render('index', {
		user: user,
		categories: categories,
		sessionId: sessionId,
		title: 'Express'
	});
}

const handlePostSessionInit = async (req, res, next) => {
	var sandboxInsertResult = await sandboxRepository.insertNewSandbox(null, null);
	var newSandbox = await sandboxRepository.getSandboxById(sandboxInsertResult.insertId);
	var sessionLink = configurationDB.configuration.servername.concat("/s/", newSandbox.uuid);
	res.json({
		sessionId: newSandbox.sessionUuid,
		opponentSessionId: newSandbox.uuid,
		sessionLink: sessionLink
	});
}

router.get('/sid_:sessionId/opsid_:opponentSessionId', handleGetSession);
router.get('/view/:sessionId', handleGetSessionView);

router.post('/init', handlePostSessionInit);

module.exports = router;
