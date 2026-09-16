const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

async function sendOtpEmail(toEmail, otpCode) {
  const mailOptions = {
    from: `"Mwea pure rice" <${process.env.EMAIL_FROM}>`,
    to: toEmail,
    subject: 'Your Verification Code (OTP)',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
        <h2 style="color: #059669;">Mwea pure rice Security</h2>
        <p>Hello,</p>
        <p>Your one-time verification code is:</p>
        <div style="font-size: 24px; font-weight: bold; background: #f3f4f6; padding: 10px 20px; display: inline-block; border-radius: 8px; letter-spacing: 4px; color: #111;">
          ${otpCode}
        </div>
        <p style="margin-top: 20px; font-size: 12px; color: #6b7280;">This code will expire in 10 minutes. If you didn't request this, please ignore this email.</p>
      </div>
    `,
  };

  try {
    let info = await transporter.sendMail(mailOptions);
    console.log('OTP email sent successfully:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return { success: false, error: error.message };
  }
}

module.exports = { sendOtpEmail };
