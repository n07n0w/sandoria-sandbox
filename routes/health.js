const express = require('express');
const router = express.Router();
const pool = require('../dbConnection');

router.get('/health', async (req, res) => {
  try {
    // Check database connection
    await pool.execute('SELECT 1 as test');

    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      version: process.env.VERSION || '0.0.0',
      commit: process.env.COMMIT || 'unknown'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: error.message,
      version: process.env.VERSION || '0.0.0',
      commit: process.env.COMMIT || 'unknown'
    });
  }
});

module.exports = router;