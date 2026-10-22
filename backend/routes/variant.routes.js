const express = require('express');
const router = express.Router();
const variantController = require('../controllers/variant.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, variantController.getAllVariants);
router.post('/', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), variantController.createVariant);
router.patch('/:code/restock', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), variantController.restockVariant);

module.exports = router;