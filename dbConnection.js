const mysql = require('mysql2/promise');
const dbConfig = require('./dbConfig');
 
const pool = mysql.createPool(dbConfig);
 
module.exports = pool;