function parseJawsDBUrl() {
	if (process.env.JAWSDB_URL) {
		const url = new URL(process.env.JAWSDB_URL);
		return {
			host: url.hostname,
			port: parseInt(url.port, 10),
			user: url.username,
			password: url.password,
			database: url.pathname.substring(1),
			ssl: process.env.NODE_ENV === 'production' ? {
				rejectUnauthorized: false
			} : false
		};
	}
	return null;
}

const jawsConfig = parseJawsDBUrl();

module.exports = jawsConfig || {
	host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
	user: process.env.DB_USER || 'sandboxu',
	password: process.env.DB_PASSWORD || 'BuEAutVLFdVX',
	database: process.env.DB_NAME || 'sandbox',
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
	ssl: process.env.NODE_ENV === 'production' ? {
		rejectUnauthorized: false
	} : false
};