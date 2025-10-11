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
            const connection = await mysql.createConnection({
                ...config,
                multipleStatements: true,
                charset: 'utf8mb4'
            });
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

function cleanSqlStatement(statement) {
    // Remove MySQL-specific comments that might cause issues
    return statement
        .replace(/\/\*!\d+\s+.*?\*\/;?/g, '') // Remove MySQL version-specific comments
        .replace(/\/\*.*?\*\//g, '') // Remove regular SQL comments
        .replace(/--.*$/gm, '') // Remove line comments
        .trim();
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
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await connection.query(`USE \`${database}\``);

        // Check if SQL file exists
        const sqlFilePath = path.join(__dirname, 'DB', 'sandbox.sql');
        try {
            await fs.access(sqlFilePath);
        } catch {
            console.log('SQL file not found, skipping database initialization');
            return;
        }

        // Read and execute the SQL file
        console.log('Reading SQL file...');
        const sqlFile = await fs.readFile(sqlFilePath, 'utf8');

        // Split SQL file into individual statements and clean them
        const statements = sqlFile
            .split(';')
            .map(statement => cleanSqlStatement(statement))
            .filter(statement => statement.length > 0 && !statement.match(/^\s*$/));

        console.log(`Found ${statements.length} SQL statements to execute`);

        // Execute each statement with proper error handling
        console.log('Executing SQL statements...');
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            if (statement.length > 0) {
                try {
                    await connection.execute(statement);
                    console.log(`Statement ${i + 1}/${statements.length} executed successfully`);
                    successCount++;
                } catch (err) {
                    console.error(`Error executing statement ${i + 1}: ${statement.substring(0, 100)}...`);
                    console.error('SQL Error:', err.message);
                    errorCount++;

                    // Continue with other statements unless it's a critical error
                    if (err.code !== 'ER_TABLE_EXISTS_ERROR' &&
                        err.code !== 'ER_DB_CREATE_EXISTS' &&
                        err.code !== 'ER_DUP_ENTRY') {
                        console.warn('Non-critical error, continuing...');
                    }
                }
            }
        }
        
        console.log(`Database initialization completed: ${successCount} successful, ${errorCount} errors`);
    } catch (err) {
        console.error('Error initializing database:', err.message);
        console.error('Full error:', err);
        throw err;
    } finally {
        if (connection) {
            try {
                await connection.end();
                console.log('Database connection closed');
            } catch (closeErr) {
                console.error('Error closing connection:', closeErr.message);
            }
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
