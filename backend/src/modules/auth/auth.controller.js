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
    const { email, phoneNumber } = req.body;

    if (!email && !phoneNumber) {
      return res.status(400).json({ message: "Email or phone number is required" });
    }

    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ message: "Invalid email format" });
      }
    }

    const existingUser = await User.findOne({
      $or: [
        ...(email ? [{ email }] : []),
        ...(phoneNumber ? [{ phoneNumber }] : [])
      ]
    });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email or phone" });
    }

    await generateOTP(null, email, phoneNumber);

    res.json({ message: "OTP sent to your email/phone" });

  } catch (err) {
    console.error("SEND OTP ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, phoneNumber, otp } = req.body;

    if (!otp) {
      return res.status(400).json({ message: "OTP is required" });
    }

    const contactValue = email || phoneNumber;
    if (!contactValue) {
      return res.status(400).json({ message: "Email or phone is required" });
    }

    const OTP = require("./otp.model");
    const otpRecord = await OTP.findOne({
      contactValue,
      verified: false
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ message: "No OTP found. Please request a new one." });
    }

    if (new Date() > otpRecord.expiresAt) {
      await OTP.deleteMany({ contactValue, verified: false });
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
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
      { contactValue, verified: true },
      JWT_SECRET,
      { expiresIn: "10min" }
    );

    res.json({
      message: "Email/phone verified successfully",
      tempToken
    });

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.completeRegister = async (req, res) => {
  try {
    const { tempToken, name, password } = req.body;

    if (!tempToken || !name || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Session expired. Please start over." });
    }

    if (!decoded.verified) {
      return res.status(400).json({ message: "Please verify your email/phone first." });
    }

    const contactValue = decoded.contactValue;
    const isEmail = contactValue.includes("@");

    const existingUser = await User.findOne({
      $or: [
        ...(isEmail ? [{ email: contactValue }] : []),
        ...(!isEmail ? [{ phoneNumber: contactValue }] : [])
      ]
    });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: isEmail ? contactValue : undefined,
      phoneNumber: !isEmail ? contactValue : undefined,
      password: hashedPassword,
      isVerified: true,
      verificationMethod: isEmail ? "email" : "phone"
    });

    const token = generateToken(user);

    res.json({
      message: "Account created successfully!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: true
      },
      token
    });

  } catch (err) {
    console.error("COMPLETE REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({
      $or: [{ email }, { phoneNumber: email }]
    });
    
    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    if (!user.isVerified) {
      return res.status(403).json({
        message: "Account not verified. Please verify your email/phone."
      });
    }

    const token = generateToken(user);
    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified
      },
      token
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      return res.json([]);
    }

    const users = await User.find({
      $or: [
        { email: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } }
      ]
    }).select("name email");

    res.json(users);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};