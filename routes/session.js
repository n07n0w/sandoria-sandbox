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


/*
const categoriesDB = {
    categories: require('../model/categories.json')
}
*/

/*
async function getCategories() {
	logger.info(["getCategories :: START"])
        var categories = {};
	try {
		var sql = "SELECT c.*, ci.id AS imageId, ci.categoryId, ci.image, ci.title AS imageTitle FROM categories c INNER JOIN categoryImage ci ON ci.categoryId = c.id";
		const [results, fields] = await pool.execute(sql);
		logger.info(results);
		for (let category of results) {
			let categoryId = category.id;
			let image = {"id": category.imageId, "image": category.image, "title": category.imageTitle};
			if (typeof categories[categoryId] === 'undefined') {
				let cat = { "name": category.name, "id": category.id, "icon": category.icon, "title": category.title, "images": [image] }
				categories[categoryId] = cat;
			} else {
				categories[categoryId].images.push(image);
			}
		}
		logger.info(["getCategories :: END"])
		return categories;
	} catch (error) {
		logger.error('getCategories ERROR:', error);
		return null;
	}
}
*/

const handleGetSession = async (req, res, next) => {
	var sessionId = req.params.sessionId;
	var opponentSessionId = req.params.opponentSessionId;
	var categories = await categoryRepository.getCategories();
//	var categories = await getCategories();
//  res.render('session', {
	res.render('index', {
		categories: categories,
		sessionId: sessionId,
		opponentSessionId: opponentSessionId,
		title: 'Express'
	});
//  res.render('index', { title: 'Express' });
}

const handleGetSessionView = async (req, res, next) => {
	var user = req.session.user;
	var sessionId = req.params.sessionId;
//	var categories = await getCategories();
	var categories = await categoryRepository.getCategories();
	res.render('index', {
		user: user,
		categories: categories,
		sessionId: sessionId,
		title: 'Express'
	});
//  res.render('index', { title: 'Express' });
}

const handlePostSessionInit = async (req, res, next) => {
	var sandboxInsertResult = await sandboxRepository.insertNewSandbox(null, null);
console.log(sandboxInsertResult);
	var newSandbox = await sandboxRepository.getSandboxById(sandboxInsertResult.insertId);
console.log(newSandbox);
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
