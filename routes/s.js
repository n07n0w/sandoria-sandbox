var express = require('express');
var router = express.Router();

const pool = require('../dbConnection');
const logger = require('../logger');
const CategoryRepository = require('../repository/categoryRepository').CategoryRepository;
var categoryRepository = new CategoryRepository();

async function getSessionIdByOpponentSessionId(opponentSessionId) {
	logger.info(["getSessionIdByOpponentSessionId :: START"], opponentSessionId)
	try {
		let values = [opponentSessionId];
		var sql = "SELECT sessionUuid FROM sandboxes WHERE uuid = ?";
		const [results, fields] = await pool.execute(sql, values);
		logger.info(results);
		logger.info(results[0]);
		logger.info(["getSessionIdByOpponentSessionId :: END"], opponentSessionId)
		return results[0]['sessionUuid'];
	} catch (error) {
		logger.error('getCategories ERROR:', error);
		return null;
	}
}

const handleGetSession = async (req, res, next) => {
	var sessionId = req.params.sessionId;
	var opponentSessionId = req.params.opponentSessionId;
	var categories = await categoryRepository.getCategories();
        var sessionId = await getSessionIdByOpponentSessionId(opponentSessionId);
        if (!sessionId) return res.status(400).json({ 'message': 'Cannot find appropriate session' });

	res.render('index', {                                                                   
		categories: categories,
		sessionId: sessionId,
		opponentSessionId: opponentSessionId,
		title: 'Express'
	});
}

router.get('/:opponentSessionId', handleGetSession);

module.exports = router;
