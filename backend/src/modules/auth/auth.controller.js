const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./user.model");
const { JWT_SECRET } = require("../../config/env");
const { generateOTP, verifyOTP, resendOTP } = require("./otp.service");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, phoneNumber, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: "Name and password are required" });
    }

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

    // Generate temp token for verification
    const tempToken = jwt.sign(
      { name, email, phoneNumber, password },
      JWT_SECRET,
      { expiresIn: "10min" }
    );

    await generateOTP(null, email, phoneNumber);

    res.status(201).json({
      message: "OTP sent. Complete verification to create account.",
      tempToken // Send temp token to verify endpoint
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { otp, tempToken } = req.body;

    if (!otp || !tempToken) {
      return res.status(400).json({ message: "OTP and temp token are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Registration token expired. Please register again." });
    }

    const { name, email, phoneNumber, password } = decoded;

    // Verify OTP using email/phone
    const contactValue = email || phoneNumber;
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
      password: hashedPassword,
      isVerified: true,
      verificationMethod: email ? "email" : "phone"
    });

    const token = generateToken(user);

    res.json({
      message: "Account created and verified successfully!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: true
      },
      token
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { otp, tempToken } = req.body;

    if (!otp || !tempToken) {
      return res.status(400).json({ message: "OTP and temp token are required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Registration token expired. Please register again." });
    }

    const { name, email, phoneNumber, password } = decoded;
    const contactValue = email || phoneNumber;
    
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

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
      password: hashedPassword,
      isVerified: true,
      verificationMethod: email ? "email" : "phone"
    });

    const token = generateToken(user);

    res.json({
      message: "Account created and verified successfully!",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: true
      },
      token
    });

  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(400).json({ message: err.message });
  }
};

exports.resendOTP = async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      return res.status(400).json({ message: "Temp token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ message: "Token expired. Please register again." });
    }

    const { email, phoneNumber } = decoded;
    await generateOTP(null, email, phoneNumber);

    res.json({
      message: "OTP resent successfully"
    });

  } catch (err) {
    console.error("RESEND OTP ERROR:", err);
    res.status(400).json({ message: err.message });
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
        message: "Account not verified. Please verify your email/phone.",
        userId: user._id,
        pendingVerification: true
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