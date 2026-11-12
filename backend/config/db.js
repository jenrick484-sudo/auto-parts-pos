const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production' || 
                     (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com'));

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      user: process.env.DB_USER || process.env.PGUSER || 'postgres',
      host: process.env.DB_HOST || process.env.PGHOST || 'localhost',
      database: process.env.DB_NAME || process.env.PGDATABASE || 'postgres',
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD || '',
      port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
    });

pool.on('error', (err) => {
  console.error('❌ Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;