const pool = require('../dbConnection');
const logger = require('../logger');

CategoryRepository = function() {
	this.categories;

	this.getCategories = async function () {
		logger.info(["getCategories :: START"])
		if (typeof this.categories === 'undefined') {
			logger.info(["Categories cache not init. Loading categories from database."])
			var categories = new Map();
			try {
				var sql = "SELECT c.*, ci.id AS imageId, ci.categoryId, ci.image, ci.title AS imageTitle FROM categories c INNER JOIN categoryImage ci ON ci.categoryId = c.id";
				const [results, fields] = await pool.execute(sql);
				if (!results || results.length === 0) {
					logger.info(["No categories found in database, using empty map"])
					this.categories = new Map();
				} else {
					logger.info(["Found", results.length, "categories"])
					for (let category of results) {
						let categoryId = category.id;
						let image = {"id": category.imageId, "image": category.image, "title": category.imageTitle};
						let existingCategory = categories.get(categoryId);
						if (typeof existingCategory === 'undefined') {
							let cat = { "name": category.name, "id": category.id, "icon": category.icon, "invert_icon": category.invert_icon, "title": category.title, "images": [image] }
							categories.set(categoryId, cat);
						} else {
							existingCategory.images.push(image);
						}
					}
					this.categories = categories;
				}
			} catch (error) {
				logger.error('getCategories ERROR:', error);
				this.categories = new Map();
			}
		}
		logger.info(["getCategories :: END"])
		return this.categories;
	}
}

exports.CategoryRepository = CategoryRepository;