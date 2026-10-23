const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Lahat ng nakalogin (Admin, Manager, Cashier) ay pwedeng tumingin ng suppliers list
router.get('/', verifyToken, supplierController.getAllSuppliers);

// Admin at Manager lamang ang pwedeng magdagdag at mag-delete ng suppliers
router.post('/', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), supplierController.createSupplier);
router.delete('/:id', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), supplierController.deleteSupplier);

module.exports = router;