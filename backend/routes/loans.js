const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');

// Get user loan info and eligibility
router.get('/user/:userId', loanController.getUserLoanInfo);

// Apply for a loan
router.post('/apply', loanController.applyForLoan);

// Get loan history
router.get('/history/:userId', loanController.getLoanHistory);

// Repay a loan
router.post('/repay', loanController.repayLoan);

module.exports = router;