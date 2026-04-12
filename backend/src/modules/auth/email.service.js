const nodemailer = require("nodemailer");
const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT } = require("../../config/env");

console.log("📧 ====== EMAIL SERVICE INIT ======");
console.log("📧 EMAIL_USER:", EMAIL_USER ? "set" : "NOT SET");
console.log("📧 EMAIL_PASS:", EMAIL_PASS ? "set" : "NOT SET");
console.log("📧 EMAIL_HOST:", EMAIL_HOST || "smtp.gmail.com (default)");
console.log("📧 EMAIL_PORT:", parseInt(EMAIL_PORT) || 587, "(parsed)");

const transporter = nodemailer.createTransport({
  host: EMAIL_HOST || "smtp.gmail.com",
  port: parseInt(EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  },
  tls: {
    rejectUnauthorized: false
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.log("📧 SMTP verification FAILED:", error.code, error.message);
  } else {
    console.log("📧 SMTP server is ready to take our messages");
  }
});

console.log("📧 Email config:", { host: EMAIL_HOST, port: EMAIL_PORT, user: EMAIL_USER, hasPass: !!EMAIL_PASS });

exports.sendEmail = async (to, otp) => {
  if (!EMAIL_USER || !EMAIL_PASS) {
    console.log(`\n========================================`);
    console.log(`📧 EMAIL NOT CONFIGURED - OTP FALLBACK`);
    console.log(`   To: ${to}`);
    console.log(`   OTP: ${otp}`);
    console.log(`========================================\n`);
    return;
  }

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

  console.log(`📧 Attempting to send email to ${to}...`);
  console.log(`📧 Using SMTP: ${EMAIL_HOST}:${EMAIL_PORT}`);
  
  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${to}`);
  } catch (err) {
    console.error("❌ Email send FAILED:", err.code, err.message);
    console.error("📧 Full error:", JSON.stringify(err));
    console.log(`\n========================================`);
    console.log(`📧 OTP FALLBACK (Email failed)`);
    console.log(`   To: ${to}`);
    console.log(`   OTP: ${otp}`);
    console.log(`========================================\n`);
  }
};