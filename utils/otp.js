const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Update the email transporter configuration in utils/otp.js
const emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
    },
    tls: {
        rejectUnauthorized: false
    }
});

// Initialize Twilio client for SMS
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ?
    twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN) : null;

// Generate a random OTP
const generateOTP = (length = 6) => {
    // Generate a random number with specified length
    return Math.floor(100000 + Math.random() * 900000).toString().substring(0, length);
};

// Send OTP via email
const sendEmailOTP = async (email, otp) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'KnockNFix - Email Verification OTP',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e9e9e9; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #3182ce;">KnockNFix Email Verification</h2>
          </div>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <p>Hello,</p>
            <p>Your email verification code is:</p>
            <h3 style="text-align: center; font-size: 24px; letter-spacing: 5px; color: #3182ce; background: #f0f0f0; padding: 10px; border-radius: 5px;">${otp}</h3>
            <p>This code will expire in 10 minutes.</p>
          </div>
          <div style="color: #666; font-size: 13px;">
            <p>If you didn't request this code, please ignore this email.</p>
            <p>Thank you,<br>KnockNFix Team</p>
          </div>
        </div>
      `
        };

        await emailTransporter.sendMail(mailOptions);
        return { success: true };
    } catch (error) {
        console.error('Email sending error:', error);
        return { success: false, error: error.message };
    }
};

// Send OTP via SMS
const sendSmsOTP = async (phoneNumber, otp) => {
    try {
        if (!twilioClient) {
            throw new Error('Twilio client not initialized');
        }

        // Format the phone number if it doesn't include country code
        if (!phoneNumber.startsWith('+')) {
            phoneNumber = `+91${phoneNumber}`; // Assuming Indian numbers, adjust as needed
        }

        await twilioClient.messages.create({
            body: `Your KnockNFix verification code is: ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber
        });

        return { success: true };
    } catch (error) {
        console.error('SMS sending error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    generateOTP,
    sendEmailOTP,
    sendSmsOTP
};