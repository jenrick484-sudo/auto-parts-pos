const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, supplierController.getAllSuppliers);
router.post('/', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), supplierController.createSupplier);
router.delete('/:id', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), supplierController.deleteSupplier);

module.exports = router;