const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');
const multer  = require('multer');
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


router.post('/:sessionId', upload.single('imgBase64'), imageController.handlePost);

module.exports = router;