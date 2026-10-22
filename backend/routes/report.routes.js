const express = require('express');
const router = express.Router();
const reportController = require('../controllers/report.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/summary', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), reportController.getSalesReport);
router.get('/daily-items', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), reportController.getDailyItemizedLog);

module.exports = router;