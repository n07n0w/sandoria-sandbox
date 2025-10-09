require('dotenv').config();

function parseJawsDBUrl() {
	const dbUrl = process.env.JAWSDB_MARIA_URL || process.env.JAWSDB_URL;
	if (dbUrl) {
		const url = new URL(dbUrl);
		return {
			host: url.hostname,
			port: parseInt(url.port, 10),
			user: url.username,
			password: url.password,
			database: url.pathname.substring(1),
			ssl: {
				rejectUnauthorized: false
			}
		};
	}
	return null;
}

const jawsConfig = parseJawsDBUrl();

// Check if the host is AWS RDS
const isAWSRDS = (host) => host && host.includes('.rds.amazonaws.com');

const config = jawsConfig || {
	host: process.env.DB_HOST,
	port: parseInt(process.env.DB_PORT, 10) || 3306,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	waitForConnections: process.env.DB_waitForConnections,
	connectionLimit: process.env.DB_connectionLimit,
	queueLimit: process.env.DB_queueLimit,
	ssl: isAWSRDS(process.env.DB_HOST) ? {
		rejectUnauthorized: false
	} : false
};

// Validate required configuration
if (!config.host || !config.user || !config.database) {
	throw new Error('Missing required database configuration: host, user, and database are required');
}

module.exports = config;
