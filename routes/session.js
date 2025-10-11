var express = require('express');
var router = express.Router();

const _pool = require('../dbConnection');
const _logger = require('../logger');
const constants = require('../constants');

const CategoryRepository = require('../repository/categoryRepository').CategoryRepository;
var categoryRepository = new CategoryRepository();

const SandboxRepository = require('../repository/sandboxRepository').SandboxRepository;
var sandboxRepository = new SandboxRepository();

const _configurationDB = {
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
	var sessionLink = constants.BASE_URL.concat("/s/", newSandbox.uuid);

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
