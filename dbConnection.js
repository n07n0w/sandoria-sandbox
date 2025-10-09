const mysql = require('mysql2/promise');
const dbConfig = require('./dbConfig');

// Enhanced pool configuration for production stability
const poolConfig = {
    ...dbConfig,
    connectionLimit: 10,
    acquireTimeout: 60000,
    timeout: 60000,
    reconnect: true,
    charset: 'utf8mb4',
    multipleStatements: false,
    // Connection health checks
    idleTimeout: 300000, // 5 minutes
    maxIdle: 5,
    // Error handling
    handleDisconnects: true
};

const pool = mysql.createPool(poolConfig);

// Handle pool errors
pool.on('connection', (connection) => {
    console.log('Database connection established as id ' + connection.threadId);
});

pool.on('error', (err) => {
    console.error('Database pool error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Database connection lost, pool will reconnect automatically');
    } else {
        console.error('Database pool error code:', err.code);
    }
});

// Test the connection on startup
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        await connection.ping();
        connection.release();
        console.log('✅ Database connection pool initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection pool test failed:', error.message);
        return false;
    }
}

// Initialize connection test
testConnection();

module.exports = pool;