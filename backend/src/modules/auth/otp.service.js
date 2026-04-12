const crypto = require("crypto");
const OTP = require("./otp.model");
const { sendEmail } = require("./email.service");

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 30;

const generateOTP = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const hashOTP = (otp) => {
  return crypto.createHash("sha256").update(otp).digest("hex");
};

exports.generateOTP = async (userId, email, phoneNumber) => {
  const contactMethod = email ? "email" : "phone";
  const contactValue = email || phoneNumber;

  const existingOTP = await OTP.findOne({ contactValue, verified: false });
  if (existingOTP) {
    const timeSinceCreated = (Date.now() - existingOTP.createdAt.getTime()) / 1000;
    if (timeSinceCreated < RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - timeSinceCreated);
      throw new Error(`Please wait ${remaining} seconds before requesting a new OTP`);
    }
    await OTP.deleteMany({ contactValue, verified: false });
  }

  const otp = generateOTP();
  const otpHash = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await OTP.create({
    userId: userId || null,
    otpHash,
    contactMethod,
    contactValue,
    expiresAt
  });

  console.log(`\n========================================`);
  console.log(`📧 OTP GENERATED (Not sent to email)`);
  console.log(`   Contact: ${contactValue}`);
  console.log(`   OTP: ${otp}`);
  console.log(`   Use this OTP to verify!`);
  console.log(`========================================\n`);

  if (contactMethod === "email") {
    console.log("📧 Calling sendEmail for:", contactValue);
    await sendEmail(contactValue, otp);
  } else {
    console.log(`[SMS] OTP for ${contactValue}: ${otp}`);
  }

  return { contactMethod, contactValue: contactValue.substring(0, 4) + "***" + contactValue.substring(contactValue.length - 4) };
};

exports.verifyOTP = async (userId, otp) => {
  const otpRecord = await OTP.findOne({ userId, verified: false }).sort({ createdAt: -1 });
  
  if (!otpRecord) {
    throw new Error("No OTP found. Please request a new OTP");
  }

  if (new Date() > otpRecord.expiresAt) {
    await OTP.deleteMany({ userId, verified: false });
    throw new Error("OTP expired. Please request a new OTP");
  }

  if (otpRecord.attemptCount >= MAX_ATTEMPTS) {
    await OTP.deleteMany({ userId, verified: false });
    throw new Error("Maximum attempts exceeded. Please request a new OTP");
  }

  const inputHash = hashOTP(otp);
  
  if (inputHash !== otpRecord.otpHash) {
    otpRecord.attemptCount += 1;
    await otpRecord.save();
    throw new Error("Invalid OTP");
  }

  otpRecord.verified = true;
  await otpRecord.save();

  return true;
};

exports.resendOTP = async (userId, email, phoneNumber) => {
  return this.generateOTP(userId, email, phoneNumber);
};