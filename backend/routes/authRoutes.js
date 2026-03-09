const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.participantLogin);
router.post('/admin/login', authController.adminLogin);
router.get('/verify', authController.verifyUser);

module.exports = router;