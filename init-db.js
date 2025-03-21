const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('./dbConfig');

async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryConnect(config, retries = 5, delay = 5000) {
    for (let i = 0; i < retries; i++) {
        try {
            const connection = await mysql.createConnection(config);
            return connection;
        } catch (err) {
            if (i === retries - 1) throw err;
            console.log(`Failed to connect, retrying in ${delay/1000} seconds...`);
            await wait(delay);
        }
    }
}

async function initializeDatabase() {
    let connection;
    try {
        // First connect without database to create it if needed
        const { database, ...configWithoutDB } = config;
        console.log('Attempting to connect to database server...');
        connection = await tryConnect(configWithoutDB);
        
        // Create database if not exists
        console.log('Creating database if not exists...');
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${database}`);
        await connection.query(`USE ${database}`);
        
        // Read and execute the SQL file
        console.log('Reading SQL file...');
        const sqlFile = await fs.readFile(path.join(__dirname, 'DB', 'sandbox.sql'), 'utf8');
        
        // Split SQL file into individual statements
        const statements = sqlFile
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0);
        
        // Execute each statement
        console.log('Executing SQL statements...');
        for (const statement of statements) {
            if (statement.length > 0) {
                try {
                    await connection.query(statement);
                } catch (err) {
                    console.error(`Error executing statement: ${statement.substring(0, 150)}...`);
                    console.error(err);
                }
            }
        }
        
        console.log('Database initialized successfully');
    } catch (err) {
        console.error('Error initializing database:', err);
        throw err;
    } finally {
        if (connection) {
            await connection.end();
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