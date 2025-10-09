const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('./dbConfig');

console.log('Database config loaded:', {
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl ? 'enabled' : 'disabled'
});

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryConnect(config, retries = 5, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`Connection attempt ${i + 1} of ${retries}...`);
            const connection = await mysql.createConnection(config);
            console.log('Connection successful!');
            return connection;
        } catch (err) {
            console.error(`Connection attempt ${i + 1} failed:`, err.message);
            console.error('Error code:', err.code);
            console.error('Error errno:', err.errno);
            if (i === retries - 1) throw err;
            console.log(`Failed to connect, retrying in ${delay/1000} seconds...`);
            await wait(delay);
        }
    }
}

async function initializeDatabase() {
    let connection;
    try {
        // Validate config first
        if (!config.host || !config.user || !config.database) {
            throw new Error('Missing required database configuration. Check environment variables.');
        }

        // First connect without database to create it if needed
        const { database, ...configWithoutDB } = config;
        console.log('Attempting to connect to database server...');
        connection = await tryConnect(configWithoutDB);
        
        // Create database if not exists
        console.log(`Creating database '${database}' if not exists...`);
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\``);
        await connection.query(`USE \`${database}\``);

        // Check if SQL file exists
        const sqlFilePath = path.join(__dirname, 'DB', 'sandbox.sql');
        try {
            await fs.access(sqlFilePath);
        } catch (err) {
            console.log('SQL file not found, skipping database initialization');
            return;
        }

        // Read and execute the SQL file
        console.log('Reading SQL file...');
        const sqlFile = await fs.readFile(sqlFilePath, 'utf8');

        // Split SQL file into individual statements
        const statements = sqlFile
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0);
        
        console.log(`Found ${statements.length} SQL statements to execute`);

        // Execute each statement
        console.log('Executing SQL statements...');
        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.length > 0) {
                try {
                    await connection.query(statement);
                    console.log(`Statement ${i + 1}/${statements.length} executed successfully`);
                } catch (err) {
                    console.error(`Error executing statement ${i + 1}: ${statement.substring(0, 150)}...`);
                    console.error('SQL Error:', err.message);
                    // Don't throw here, continue with other statements
                }
            }
        }
        
        console.log('Database initialization completed successfully');
    } catch (err) {
        console.error('Error initializing database:', err.message);
        console.error('Full error:', err);
        throw err;
    } finally {
        if (connection) {
            await connection.end();
            console.log('Database connection closed');
        }
    }
}

// If this file is run directly (not required as a module)
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('Database initialization completed');
            process.exit(0);
        })
        .catch(err => {
            console.error('Database initialization failed:', err);
            process.exit(1);
        });
}

module.exports = initializeDatabase;
