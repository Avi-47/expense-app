const nodemailer = require("nodemailer");
const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT } = require("../../config/env");

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST || "smtp.gmail.com",
  port: EMAIL_PORT || 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
});

exports.sendEmail = async (to, otp) => {
  const mailOptions = {
    from: `"Expense Splitter" <${EMAIL_USER}>`,
    to,
    subject: "Your Verification OTP",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #333;">Verify Your Account</h2>
        <p style="color: #666;">Your verification code is:</p>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
          ${otp}
        </div>
        <p style="color: #999; font-size: 12px;">This code will expire in 5 minutes.</p>
        <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (err) {
    console.error("Email send error:", err.message);
    console.log(`[FALLBACK] OTP for ${to}: ${otp}`);
  }
};