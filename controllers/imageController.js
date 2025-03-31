const pool = require('../dbConnection');
const logger = require('../logger');
const fs = require('node:fs');
const path = require('path');

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

async function getSessionImagesCount(sessionId) {
	logger.info(["getSessionImagesCount :: START", sessionId])
	try {
		let values = [sessionId];
		var sql = "SELECT count(*) as imagesCount FROM sessionimage WHERE sessionId = ?";
		const [results, fields] = await pool.execute(sql, values);
		logger.info(results);
		return results[0]['imagesCount'];
	} catch (error) {
		logger.error('getUserByEmail ERROR:', error);
		return null;
	}
}

async function saveSessionImageToDatabase(sessionId, imagePath, createDt) {
	logger.info(["saveSessionImageToDatabase :: START", sessionId, imagePath, createDt, '***']);
	try {
		let values = [sessionId, imagePath, createDt];
		var sql = "INSERT INTO sessionimage (`sessionId`, `image`, `createDt`) VALUES (?, ?, ?)";
		const [results, fields] = await pool.execute(sql, values);
		logger.info(results);
		return results;
	} catch (error) {
		logger.error('saveSessionImageToDatabase ERROR:', error);
		return null;
	}
}

const handlePost = async (req, res, next) => {
    var sessionId = req.params.sessionId;
    var createDt  = req.body.eventTime;
    var sessionImagesCount = await getSessionImagesCount(sessionId);
    const image = req.body.imgBase64;

    if (image) {
        let imageDbPath = `${sessionId}/${sessionImagesCount}.png`;
        let newpath = `public/images/screenshots/${imageDbPath}`;

        ensureDirectoryExistence(newpath);
        const data = image.replace(/^data:image\/\w+;base64,/, "");
        const buf = Buffer.from(data, "base64");
        await fs.writeFileSync(newpath, buf);
        await saveSessionImageToDatabase(sessionId, imageDbPath, createDt);
	res.json({
		imagePath: imageDbPath,
		eventTime: createDt	
	});
    } else {
    	return res.status(5000).json({ 'message': 'POST canvas image processing error' });
    }
}

module.exports = { handlePost };