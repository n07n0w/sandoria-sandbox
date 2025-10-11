var express = require('express');
var router = express.Router();

const pool = require('../dbConnection');
const logger = require('../logger');
const CategoryRepository = require('../repository/categoryRepository').CategoryRepository;
var categoryRepository = new CategoryRepository();


async function _getUser(location, area, rooms, maxNum) {
	logger.info(["getLocationSimilars :: START", location, area, rooms, maxNum])
	let connection = null;
	try {
		connection = await pool.getConnection();
		// Define missing delta constants to prevent undefined variable errors
		const areaDelta = 10; // Default area tolerance
		const roomDelta = 1;  // Default room tolerance
		let values = [location, area + areaDelta, area - areaDelta, rooms + roomDelta, rooms - roomDelta, maxNum];

		var sql = "SELECT * FROM properties WHERE locationID = ? AND state='inactive' AND (constructedArea <= ? AND constructedArea >= ?) AND (roomNumber <= ? AND roomNumber >= ?) order by constructedArea, roomNumber desc LIMIT ?";
		const [results] = await connection.query(sql, values);
		logger.info(results);
		connection.release();
		return results;
	} catch (error) {
		logger.error('Error connecting to the MySQL server:', error);
		if (connection) connection.release();
		return null;
	}
}

const handleGetIndex = async (req, res, next) => {
	try {
		var user = req.session.user;
		var categories = await categoryRepository.getCategories();
		res.render('index', {
			user: user,
			categories: categories,
			title: 'Express'
		});
	} catch (error) {
		logger.error('Error in handleGetIndex:', error);
		next(error); // Pass error to Express error handler
	}
}

const handleLogTrace = async (req, res) => {
	const logEntry = req.body;

	// Only log if there's actual content
	if (logEntry && Object.keys(logEntry).length > 0) {
		console.info('Client trace:', logEntry);

		// Log structured trace information
		if (logEntry.message || logEntry.error || logEntry.stack) {
			console.trace('Client trace details:', {
				timestamp: logEntry.timestamp || new Date().toISOString(),
				type: logEntry.type || 'unknown',
				message: logEntry.message || 'No message',
				stack: logEntry.stack || 'No stack trace'
			});
		}
	} else {
		console.warn('Empty trace log received from client');
	}

	res.status(200).send('Trace logged successfully');
}

/* GET home page. */
router.get('/', handleGetIndex);

router.post('/log-trace', handleLogTrace);

module.exports = router;
