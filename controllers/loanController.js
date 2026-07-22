const { promisePool } = require('../config/database');
const telegramService = require('../services/telegramService');

// Generate unique reference
const generateReference = () => {
    const prefix = 'LN';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${prefix}-${timestamp}-${random}`;
};

// Get user's loan eligibility and limit
const getUserLoanInfo = async (req, res) => {
    try {
        const userId = req.params.userId;
        
        if (!userId) {
            return res.status(400).json({
                success: false,
                message: 'User ID is required'
            });
        }
        
        const [users] = await promisePool.query(
            'SELECT id, phone_number, full_name, loan_limit, total_borrowed, current_balance FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const user = users[0];
        const availableLimit = parseFloat(user.loan_limit) - parseFloat(user.total_borrowed);
        
        // Get active loans
        const [activeLoans] = await promisePool.query(
            'SELECT id, loan_reference, amount, total_repayable, status, disbursement_date, due_date FROM loans WHERE user_id = ? AND status IN ("approved", "disbursed")',
            [userId]
        );
        
        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                phoneNumber: user.phone_number,
                fullName: user.full_name,
                loanLimit: user.loan_limit,
                totalBorrowed: user.total_borrowed,
                currentBalance: user.current_balance,
                availableLimit: availableLimit
            },
            activeLoans: activeLoans,
            canApply: availableLimit > 0
        });
        
    } catch (error) {
        console.error('Get loan info error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Apply for a loan
const applyForLoan = async (req, res) => {
    try {
        const { userId, amount, interestRate } = req.body;
        
        if (!userId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'User ID and amount are required'
            });
        }
        
        const loanAmount = parseFloat(amount);
        
        if (loanAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Loan amount must be greater than zero'
            });
        }
        
        // Get user info
        const [users] = await promisePool.query(
            'SELECT id, phone_number, full_name, loan_limit, total_borrowed FROM users WHERE id = ?',
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        const user = users[0];
        const availableLimit = parseFloat(user.loan_limit) - parseFloat(user.total_borrowed);
        
        if (loanAmount > availableLimit) {
            return res.status(400).json({
                success: false,
                message: `Loan amount exceeds available limit. Available: ${availableLimit}`,
                availableLimit: availableLimit
            });
        }
        
        const rate = interestRate || 5.00;
        const totalRepayable = loanAmount + (loanAmount * (rate / 100));
        const loanReference = generateReference();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        
        // Create loan application
        const [result] = await promisePool.query(
            `INSERT INTO loans 
            (user_id, loan_reference, amount, interest_rate, total_repayable, status, due_date) 
            VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            [userId, loanReference, loanAmount, rate, totalRepayable, dueDate]
        );
        
        // Log transaction
        await promisePool.query(
            `INSERT INTO transactions (user_id, transaction_type, amount, status) 
            VALUES (?, 'disbursement', ?, 'pending')`,
            [userId, loanAmount]
        );
        
        // 🔔 TELEGRAM NOTIFICATION: Loan application
        await telegramService.notifyLoanApplication(user, {
            reference: loanReference,
            amount: loanAmount,
            totalRepayable: totalRepayable,
            dueDate: dueDate
        });
        
        // Auto-disburse for testing
        await approveAndDisburseLoan(result.insertId, userId, loanAmount, user.phone_number);
        
        res.status(201).json({
            success: true,
            message: 'Loan application submitted and disbursed (testing)',
            loan: {
                id: result.insertId,
                reference: loanReference,
                amount: loanAmount,
                interestRate: rate,
                totalRepayable: totalRepayable,
                dueDate: dueDate,
                status: 'disbursed'
            }
        });
        
    } catch (error) {
        console.error('Apply for loan error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Approve and disburse loan
const approveAndDisburseLoan = async (loanId, userId, amount, phoneNumber) => {
    try {
        // Update loan status to approved
        await promisePool.query(
            'UPDATE loans SET status = ? WHERE id = ?',
            ['approved', loanId]
        );
        
        // Mock Waafi disbursement
        const disbursementResult = await disburseViaWaafi(phoneNumber, amount);
        
        // Get user info for notification
        const [users] = await promisePool.query(
            'SELECT id, phone_number, full_name FROM users WHERE id = ?',
            [userId]
        );
        const user = users[0];
        
        if (disbursementResult.success) {
            // Update loan status to disbursed
            await promisePool.query(
                `UPDATE loans 
                SET status = 'disbursed', 
                    disbursement_date = NOW(),
                    waafi_transaction_id = ?
                WHERE id = ?`,
                [disbursementResult.transactionId, loanId]
            );
            
            // Update user's total borrowed
            await promisePool.query(
                'UPDATE users SET total_borrowed = total_borrowed + ? WHERE id = ?',
                [amount, userId]
            );
            
            // 🔔 TELEGRAM NOTIFICATION: Disbursement successful
            await telegramService.notifyLoanDisbursement(user, amount, disbursementResult.transactionId);
            
        } else {
            // 🔔 TELEGRAM NOTIFICATION: Disbursement failed
            await telegramService.notifyLoanFailure(user, amount, disbursementResult.error || 'Unknown error');
        }
        
        return disbursementResult;
        
    } catch (error) {
        console.error('Disbursement error:', error);
        await telegramService.notifyError(error, 'Loan Disbursement');
        return {
            success: false,
            error: error.message
        };
    }
};

// Mock Waafi disbursement - Replace with actual API
const disburseViaWaafi = async (phoneNumber, amount) => {
    try {
        // Mock success (90% success rate for testing)
        const isSuccess = Math.random() < 0.9;
        
        if (isSuccess) {
            return {
                success: true,
                transactionId: `WAAFI-${Date.now()}`,
                message: `Successfully disbursed ${amount} to ${phoneNumber}`
            };
        } else {
            return {
                success: false,
                error: 'Transaction failed - insufficient balance'
            };
        }
        
    } catch (error) {
        console.error('Waafi disbursement error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

// Get user's loan history
const getLoanHistory = async (req, res) => {
    try {
        const userId = req.params.userId;
        
        const [loans] = await promisePool.query(
            'SELECT * FROM loans WHERE user_id = ? ORDER BY created_at DESC',
            [userId]
        );
        
        res.status(200).json({
            success: true,
            count: loans.length,
            loans: loans
        });
        
    } catch (error) {
        console.error('Get loan history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Repay loan
const repayLoan = async (req, res) => {
    try {
        const { loanId, amount } = req.body;
        
        if (!loanId || !amount) {
            return res.status(400).json({
                success: false,
                message: 'Loan ID and amount are required'
            });
        }
        
        const [loans] = await promisePool.query(
            'SELECT * FROM loans WHERE id = ?',
            [loanId]
        );
        
        if (loans.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Loan not found'
            });
        }
        
        const loan = loans[0];
        
        if (parseFloat(amount) >= parseFloat(loan.total_repayable)) {
            // Update loan status
            await promisePool.query(
                `UPDATE loans 
                SET status = 'repaid', 
                    repayment_date = NOW()
                WHERE id = ?`,
                [loanId]
            );
            
            // Update user's total borrowed
            await promisePool.query(
                'UPDATE users SET total_borrowed = total_borrowed - ? WHERE id = ?',
                [loan.amount, loan.user_id]
            );
            
            // 🔔 TELEGRAM NOTIFICATION: Loan repaid
            await telegramService.sendNotification(
                '💰 Loan Repaid',
                {
                    '📋 Reference': loan.loan_reference,
                    '💰 Amount': `${loan.amount.toLocaleString()} SOS`,
                    '✅ Status': 'Repaid'
                },
                '💰'
            );
            
            res.status(200).json({
                success: true,
                message: 'Loan repaid successfully'
            });
        } else {
            res.status(400).json({
                success: false,
                message: `Amount must be at least ${loan.total_repayable}`,
                required: loan.total_repayable
            });
        }
        
    } catch (error) {
        console.error('Repayment error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    getUserLoanInfo,
    applyForLoan,
    getLoanHistory,
    repayLoan
};