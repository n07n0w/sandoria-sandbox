require('dotenv').config();

function parseJawsDBUrl() {
	const dbUrl = process.env.JAWSDB_MARIA_URL || process.env.JAWSDB_URL;
	if (dbUrl) {
		try {
			const url = new URL(dbUrl);
			return {
				host: url.hostname,
				port: parseInt(url.port, 10) || 3306,
				user: url.username,
				password: url.password,
				database: url.pathname.substring(1),
				ssl: {
					rejectUnauthorized: false
				}
			};
		} catch (err) {
			console.error('Error parsing JAWSDB URL:', err.message);
			return null;
		}
	}
	return null;
}

const jawsConfig = parseJawsDBUrl();

// Check if the host is AWS RDS
const isAWSRDS = (host) => host && host.includes('.rds.amazonaws.com');

const config = jawsConfig || {
	host: process.env.DB_HOST || 'localhost',
	port: parseInt(process.env.DB_PORT, 10) || 3306,
	user: process.env.DB_USER || 'root',
	password: process.env.DB_PASSWORD || '',
	database: process.env.DB_NAME || 'sandbox',
	waitForConnections: process.env.DB_waitForConnections !== 'false',
	connectionLimit: parseInt(process.env.DB_connectionLimit, 10) || 10,
	queueLimit: parseInt(process.env.DB_queueLimit, 10) || 0,
	ssl: isAWSRDS(process.env.DB_HOST) ? {
		rejectUnauthorized: false
	} : false
};

// Log configuration (without password) for debugging
console.log('Database configuration:', {
	host: config.host,
	port: config.port,
	user: config.user,
	database: config.database,
	ssl: config.ssl ? 'enabled' : 'disabled',
	source: jawsConfig ? 'JAWSDB_URL' : 'Environment variables'
});

// Validate required configuration
if (!config.host || !config.user || !config.database) {
	const missing = [];
	if (!config.host) missing.push('DB_HOST');
	if (!config.user) missing.push('DB_USER');
	if (!config.database) missing.push('DB_NAME');

	console.error(`Missing required database configuration: ${missing.join(', ')}`);
	console.error('Please set the following environment variables or provide JAWSDB_MARIA_URL/JAWSDB_URL');

	// In production, we should fail fast
	if (process.env.NODE_ENV === 'production') {
		throw new Error(`Missing required database configuration: ${missing.join(', ')}`);
	}
}

module.exports = config;
