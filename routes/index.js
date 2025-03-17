var express = require('express');
var router = express.Router();

const pool = require('../dbConnection');
const logger = require('../logger');
//const doctorService = require('../repository/categoryRepository');
const CategoryRepository = require('../repository/categoryRepository').CategoryRepository;
var categoryRepository = new CategoryRepository();

/*
const categoriesDB = {
    categories: require('../model/categories.json')
}
*/

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

/*
async function getCategories() {
	logger.info(["getCategories :: START"])
	var categories = new Map();
	try {
		var sql = "SELECT c.*, ci.id AS imageId, ci.categoryId, ci.image, ci.title AS imageTitle FROM categories c INNER JOIN categoryImage ci ON ci.categoryId = c.id";
		const [results, fields] = await pool.execute(sql);
		logger.info(results);
		for (let category of results) {
			let categoryId = category.id;
			let image = {"id": category.imageId, "image": category.image, "title": category.imageTitle};
			let existingCatgory = categories.get(categoryId);
			if (typeof existingCatgory === 'undefined') {
				let cat = { "name": category.name, "id": category.id, "icon": category.icon, "title": category.title, "images": [image] }
				categories.set(categoryId, cat);
			} else {
				existingCatgory.images.push(image);
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

const handleGetIndex = async (req, res) => {
	var user = req.session.user;
//	var categories = await getCategories();
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
