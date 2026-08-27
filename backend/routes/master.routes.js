const express = require('express');
const router = express.Router();
const masterController = require('../controllers/master.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', verifyToken, masterController.getAllMasters);
router.post('/', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), masterController.createMaster);

module.exports = router;