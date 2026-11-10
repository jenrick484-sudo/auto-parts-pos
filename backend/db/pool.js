const { Pool } = require('pg');

// Kung local ang DATABASE_URL (localhost o 127.0.0.1), huwag gumamit ng SSL
const isLocal = process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

module.exports = pool;