const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');
const config = require('./dbConfig');

async function initializeDatabase() {
    let connection;
    try {
        // First connect without database to create it if needed
        const { database, ...configWithoutDB } = config;
        connection = await mysql.createConnection(configWithoutDB);
        
        // Create database if not exists
        await connection.query(`CREATE DATABASE IF NOT EXISTS ${database}`);
        await connection.query(`USE ${database}`);
        
        // Read and execute the SQL file
        const sqlFile = await fs.readFile(path.join(__dirname, 'DB', 'sandbox.sql'), 'utf8');
        
        // Split SQL file into individual statements
        const statements = sqlFile
            .split(';')
            .map(statement => statement.trim())
            .filter(statement => statement.length > 0);
        
        // Execute each statement
        for (const statement of statements) {
            if (statement.length > 0) {
                try {
                    await connection.query(statement);
                } catch (err) {
                    console.error(`Error executing statement: ${statement}`);
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