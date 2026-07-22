const nodemailer = require('nodemailer');

// Create email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.ADMIN_EMAIL,
        pass: process.env.ADMIN_EMAIL_PASSWORD
    }
});

// Send admin notification
const sendAdminNotification = async (subject, message, phoneNumber = null) => {
    try {
        const mailOptions = {
            from: process.env.ADMIN_EMAIL,
            to: process.env.ADMIN_EMAIL,
            subject: `🔔 ${subject}`,
            html: `
                <div style="font-family: 'Courier New', monospace; max-width: 700px; margin: 0 auto; padding: 20px; background: #0a0a0a; color: #fff; border-radius: 10px; border: 1px solid #333;">
                    <div style="background: #1a1a2e; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center;">
                        <h2 style="color: #4fc3f7; margin: 0;">🏦 Waafi Loan Monitor</h2>
                        <p style="color: #888; margin: 5px 0 0 0; font-size: 12px;">${new Date().toLocaleString()}</p>
                    </div>
                    <div style="background: #16213e; padding: 20px; border-radius: 8px;">
                        ${message}
                    </div>
                    <div style="margin-top: 20px; padding: 10px; background: #1a1a2e; border-radius: 8px; text-align: center; font-size: 11px; color: #666;">
                        ⚠️ Testing Environment - All user inputs are being monitored
                    </div>
                </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('📧 Admin notification sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('📧 Email error:', error);
        // Fallback: log to console
        console.log('🔔 ADMIN POPUP (Console):');
        console.log(`Subject: ${subject}`);
        console.log(`Phone: ${phoneNumber}`);
        console.log(`Message: ${message}`);
        return { success: false, error: error.message };
    }
};

module.exports = { sendAdminNotification };