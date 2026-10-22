const express = require('express');
const router = express.Router();
const masterController = require('../controllers/master.controller');
const { verifyToken, authorizeRoles } = require('../middleware/auth.middleware');

// GET /api/masters - Kunin ang lahat ng Master Items kasama ang stock valuation
router.get('/', verifyToken, masterController.getAllMasters);

// GET /api/masters/:id - Kunin ang partikular na Master Item at ang mga variant nito
router.get('/:id', verifyToken, masterController.getMasterById);

// POST /api/masters - Mag-rehistro ng bagong Master Item (ADMIN at MANAGER lang ang may access)
router.post('/', verifyToken, authorizeRoles('ADMIN', 'MANAGER'), masterController.createMaster);

module.exports = router;