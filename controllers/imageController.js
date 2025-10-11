const pool = require('../dbConnection');
const logger = require('../logger');
const fs = require('node:fs');
const path = require('path');

const SCREENSHOT_BASE_DIR = path.join(__dirname, '..', 'public', 'images', 'screenshots');
const SAFE_ID_REGEX = /^[A-Za-z0-9_-]+$/;

function ensureDirectoryExistence(dirPath) {
  if (fs.existsSync(dirPath)) return true; // eslint-disable-line security/detect-non-literal-fs-filename
  ensureDirectoryExistence(path.dirname(dirPath));
  fs.mkdirSync(dirPath, { recursive: true }); // eslint-disable-line security/detect-non-literal-fs-filename
  return true;
}

async function getSessionImagesCount(sessionId) {
	logger.info(["getSessionImagesCount :: START", sessionId])
	try {
		const sql = "SELECT count(*) as imagesCount FROM sessionimage WHERE sessionId = ?";
		const [results] = await pool.execute(sql, [sessionId]);
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
		const sql = "INSERT INTO sessionimage (`sessionId`, `image`, `createDt`) VALUES (?, ?, ?)";
		const [results] = await pool.execute(sql, [sessionId, imagePath, createDt]);
		logger.info(results);
		return results;
	} catch (error) {
		logger.error('saveSessionImageToDatabase ERROR:', error);
		return null;
	}
}

const handlePost = async (req, res) => {
    const sessionId = req.params.sessionId;
    const createDt  = req.body.eventTime;
    if (!SAFE_ID_REGEX.test(sessionId)) {
      return res.status(400).json({ message: 'Invalid session id' });
    }
    const sessionImagesCount = await getSessionImagesCount(sessionId);
    const image = req.body.imgBase64;

    if (image) {
        const imageDbPath = `${sessionId}/${sessionImagesCount}.png`;
        const targetDir = path.join(SCREENSHOT_BASE_DIR, sessionId);
        ensureDirectoryExistence(targetDir);
        const safeFullPath = path.join(SCREENSHOT_BASE_DIR, imageDbPath);
        if (!safeFullPath.startsWith(SCREENSHOT_BASE_DIR)) {
          return res.status(400).json({ message: 'Invalid path resolution' });
        }
        try {
          const data = image.replace(/^data:image\/\w+;base64,/, "");
          const buf = Buffer.from(data, "base64");
          fs.writeFileSync(safeFullPath, buf); // eslint-disable-line security/detect-non-literal-fs-filename
          await saveSessionImageToDatabase(sessionId, imageDbPath, createDt);
          return res.json({ imagePath: imageDbPath, eventTime: createDt });
        } catch (e) {
          logger.error('Failed to save image', e);
          return res.status(500).json({ message: 'Failed to save image' });
        }
    }
    return res.status(500).json({ message: 'POST canvas image processing error' });
}

module.exports = { handlePost };