var express = require('express');
var router = express.Router();

const pool = require('../dbConnection');
const logger = require('../logger');
const CategoryRepository = require('../repository/categoryRepository').CategoryRepository;
var categoryRepository = new CategoryRepository();


function getUser(location, area, rooms, maxNum) {
	logger.info(["getLocationSimilars :: START", location, area, rooms, maxNum])
	let connection = null;
	try {
		connection = pool.getConnection();
		let values = [location, area + areaDelta, area - areaDelta, rooms + roomDelta, rooms - roomDelta, maxNum];

		var sql = "SELECT * FROM properties WHERE locationID = ? AND state='inactive' AND (constructedArea <= ? AND constructedArea >= ?) AND (roomNumber <= ? AND roomNumber >= ?) order by constructedArea, roomNumber desc LIMIT ?";
		const [results, fields] = connection.query(sql, values);
		logger.info(results);
		connection.release();
		return results;
	} catch (error) {
		logger.error('Error connecting to the MySQL server:', error);
		return null;
	}
}

const handleGetIndex = async (req, res) => {
	var user = req.session.user;
	var categories = await categoryRepository.getCategories();
	res.render('index', {
		user: user,
		categories: categories,
		title: 'Express'
	});
}

/* GET home page. */
router.get('/', handleGetIndex);

module.exports = router;
