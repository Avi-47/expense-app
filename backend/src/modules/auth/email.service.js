const nodemailer = require("nodemailer");
const { EMAIL_USER, EMAIL_PASS, EMAIL_HOST, EMAIL_PORT, RESEND_API_KEY } = require("../../config/env");

console.log("📧 ====== EMAIL SERVICE INIT ======");
console.log("📧 RESEND_API_KEY starts with:", RESEND_API_KEY ? RESEND_API_KEY.substring(0, 5) : "NOT SET");
console.log("📧 RESEND_API_KEY full:", RESEND_API_KEY ? "set" : "NOT SET");
console.log("📧 EMAIL_USER:", EMAIL_USER ? "set" : "NOT SET");

let transporter;
if (EMAIL_USER && EMAIL_PASS) {
  transporter = nodemailer.createTransport({
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
}

exports.sendEmail = async (to, otp) => {
  console.log(`📧 ====== SEND EMAIL START ======`);
  console.log(`📧 To: ${to}, OTP: ${otp}`);
  console.log(`📧 RESEND_API_KEY exists:`, !!RESEND_API_KEY);

  if (RESEND_API_KEY) {
    console.log(`📧 Using RESEND API...`);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: "Expense Splitter <onboarding@resend.dev>",
          to: [to],
          subject: "Your Verification OTP",
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: 0 auto;">
              <h2 style="color: #333;">Verify Your Account</h2>
              <p style="color: #666;">Your verification code is:</p>
              <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${otp}
              </div>
              <p style="color: #999; font-size: 12px;">This code will expire in 5 minutes.</p>
            </div>
          `
        })
      });
      const data = await response.json();
      if (data.id) {
        console.log(`✅ Email sent via Resend to ${to}`);
        return;
      }
      throw new Error(data.message || "Resend failed");
    } catch (err) {
      console.error("❌ Resend failed:", err.message);
    }
  }

  if (transporter) {
    console.log(`📧 Using SMTP (Gmail)...`);
    try {
      await transporter.sendMail({
        from: `"Expense Splitter" <${EMAIL_USER}>`,
        to,
        subject: "Your Verification OTP",
        html: `<p>Your OTP: <strong>${otp}</strong></p>`
      });
      console.log(`✅ Email sent via SMTP to ${to}`);
      return;
    } catch (err) {
      console.error("❌ SMTP failed:", err.message);
    }
  }

  console.log(`\n========================================`);
  console.log(`📧 OTP sent to: ${to}`);
  console.log(`========================================\n`);
};