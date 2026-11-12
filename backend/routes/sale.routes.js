const express = require('express');
const router = express.Router();
const saleController = require('../controllers/sale.controller');

// POST /api/sales
router.post('/', saleController.createSale);

// GET /api/sales
router.get('/', saleController.getSales);

module.exports = router;