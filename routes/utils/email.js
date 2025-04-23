const nodemailer = require('nodemailer');

/**
 * Configure nodemailer transporter
 * Use your SMTP settings or a service like Gmail, SendGrid, etc.
 */
const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    }
});

/**
 * Send a password reset email with instructions
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} resetUrl - Password reset URL with token
 * @returns {Promise} - Email sending result
 */
const sendResetEmail = async (email, name, resetUrl) => {
    try {
        const mailOptions = {
            from: `KnockNFix <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'KnockNFix - Password Reset Instructions',
            html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://your-logo-url.com" alt="KnockNFix Logo" style="max-height: 60px;">
          </div>
          
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px 10px 0 0; padding: 20px; text-align: center;">
            <h2 style="margin: 0; font-size: 24px;">Reset Your Password</h2>
          </div>
          
          <div style="background-color: #ffffff; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            <p style="margin-top: 0;">Hello ${name},</p>
            <p>We received a request to reset the password for your KnockNFix account.</p>
            <p>To reset your password, click the button below. This link will expire in 1 hour.</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
            </div>
            
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; background-color: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 14px;"><a href="${resetUrl}" style="color: #764ba2; text-decoration: none;">${resetUrl}</a></p>
          </div>
          
          <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 14px;">
            <p>&copy; ${new Date().getFullYear()} KnockNFix. All rights reserved.</p>
            <p>Our address, City, Country</p>
          </div>
        </div>
      `
        };

        const info = await transporter.sendMail(mailOptions);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendResetEmail
};