const { sendOtpEmail } = require('../lib/mailer');
const db = require('../models'); // Adjust path to your Sequelize models index file

exports.requestOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // 1. Generate random 6-digit OTP and expiration (10 minutes)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000);

    // 2. Save or update OTP in your MySQL database via Sequelize
    // (upsert ensures if the email already requested an old OTP, it overwrites it safely)
    await db.Otp.upsert({
      email: email,
      code: otpCode,
      expiresAt: expiresAt
    });

    // 3. Send the email via Brevo
    const result = await sendOtpEmail(email, otpCode);

    if (!result.success) {
      return res.status(500).json({ error: 'Failed to send OTP email.' });
    }

    res.status(200).json({ message: 'OTP sent successfully to your email.' });
  } catch (err) {
    console.error('OTP Request Error:', err);
    res.status(500).json({ error: 'Server error while sending OTP' });
  }
};
