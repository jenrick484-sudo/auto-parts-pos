const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { verifyToken, authorizeRoles } = require('../middleware/authMiddleware');

// Tanging ADMIN lamang ang pwedeng kumuha, gumawa, o mag-delete ng users
router.get('/', verifyToken, authorizeRoles('ADMIN'), userController.getAllUsers);
router.post('/', verifyToken, authorizeRoles('ADMIN'), userController.createUser);
router.delete('/:id', verifyToken, authorizeRoles('ADMIN'), userController.deleteUser);

module.exports = router;