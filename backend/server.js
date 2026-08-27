const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

// MIDDLEWARES
app.use(cors());
app.use(express.json({ limit: '10mb' })); // EXPANDED LIMIT FOR BASE64 IMAGES IF APPLICABLE
app.use(express.urlencoded({ extended: true }));

// SYSTEM HEALTH CHECK ROUTE (USEFUL FOR RENDER MONITORING)
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({ status: 'OK', database: 'Connected' });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', database: err.message });
  }
});

// API ROUTE IMPORTS
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/masters', require('./routes/master.routes'));
app.use('/api/variants', require('./routes/variant.routes'));
app.use('/api/sales', require('./routes/sale.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/users', require('./routes/user.routes'));

// GLOBAL 404 HANDLER
app.use((req, res) => {
  res.status(404).json({ message: 'API Endpoint Not Found' });
});

// GLOBAL ERROR HANDLING MIDDLEWARE
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.stack);
  res.status(500).json({ message: 'Internal Server Error', error: err.message });
});

// START EXPRESS SERVER
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});