const crypto = require("crypto");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./user.model");
const { JWT_SECRET } = require("../../config/env");
const { generateOTP } = require("./otp.service");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.sendOtp = async (req, res) => {
  try {
    console.log("📨 SEND OTP REQUEST RECEIVED");
    console.log("📨 Body:", req.body);
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ message: "Email or phone number is required" });
    }

    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
    }

    await generateOTP(null, email, phoneNumber);

    res.json({ message: "OTP sent" });

  } catch (err) {
    console.error("SEND OTP ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const OTP = require("./otp.model");
    const otpRecord = await OTP.findOne({
      contactValue: email,
      verified: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ message: "No OTP found" });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteMany({ contactValue: email, verified: false });
      return res.status(400).json({ message: "OTP expired" });
    }

    const crypto = require("crypto");
    const inputHash = crypto.createHash("sha256").update(otp).digest("hex");
    
    if (inputHash !== otpRecord.otpHash) {
      otpRecord.attemptCount += 1;
      await otpRecord.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    otpRecord.verified = true;
    await otpRecord.save();

    const tempToken = jwt.sign(
      { contactValue: email, verified: true },
      JWT_SECRET,
      { expiresIn: "10min" }
    );

    res.json({ message: "Verified", tempToken });

  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.completeRegister = async (req, res) => {
  try {
    const { tempToken, name, password } = req.body;

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Session expired" });
    }

    if (!decoded.verified) {
      return res.status(400).json({ message: "Verify email first" });
    }

    const existingUser = await User.findOne({ email: decoded.contactValue });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: decoded.contactValue,
      password: hashedPassword
    });

    const token = generateToken(user);

    res.json({
      message: "Created",
      user: { id: user._id, name: user.name, email: user.email },
      token
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  console.log("🔐 LOGIN REQUEST RECEIVED");
  console.log("🔐 Body:", req.body);
  try {
    const { email, password } = req.body;
    console.log("🔐 Login attempt for:", email);
    const user = await User.findOne({ email });
    
    if (!user) {
      console.log("🔐 User not found");
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log("🔐 Password match:", isMatch);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const token = generateToken(user);
    console.log("🔐 Login successful for:", email);
    res.json({
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
  } catch (err) {
    console.error("🔐 Login error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    console.log("🔑 FORGOT PASSWORD for:", email);
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const OTP = require("./otp.model");
    await OTP.deleteMany({ contactValue: email, verified: false });
    await OTP.create({
      userId: user._id,
      otpHash,
      contactMethod: "email",
      contactValue: email,
      expiresAt
    });

    console.log("📧 Password reset OTP:", otp);
    const { sendEmail } = require("./email.service");
    await sendEmail(email, otp);

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("🔑 Forgot password error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    const OTP = require("./otp.model");
    const otpRecord = await OTP.findOne({
      contactValue: email,
      verified: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ message: "No OTP found" });
    }

    if (new Date() > otpRecord.expiresAt) {
      return res.status(400).json({ message: "OTP expired" });
    }

    const inputHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (inputHash !== otpRecord.otpHash) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = await User.findOne({ email });
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await OTP.deleteMany({ contactValue: email, verified: false });

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q;
    if (!q) return res.json([]);
    
    const users = await User.find({
      $or: [
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } }
      ]
    }).select("_id name email");

    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};