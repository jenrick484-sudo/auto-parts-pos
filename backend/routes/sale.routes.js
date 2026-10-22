const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');
const { verifyToken } = require('../middleware/authMiddleware');

router.post('/checkout', verifyToken, saleController.processCheckout);

module.exports = router;