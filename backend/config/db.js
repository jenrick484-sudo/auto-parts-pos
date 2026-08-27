const { Pool } = require('pg');
require('dotenv').config();

// DETECT IF RUNNING IN PRODUCTION (RENDER.COM) OR LOCAL ENVIRONMENT
const isProduction = process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isProduction
    ? { rejectUnauthorized: false } // REQUIRED FOR RENDER POSTGRES
    : false,
});

// TEST DATABASE CONNECTION UPON INITIALIZATION
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error acquiring PostgreSQL client:', err.stack);
  }
  console.log('✅ Successfully connected to PostgreSQL Database!');
  release();
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};