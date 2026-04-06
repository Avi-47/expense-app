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

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
      password: hashedPassword,
      isVerified: false,
      verificationMethod: email ? "email" : "phone"
    });

    await generateOTP(user._id, email, phoneNumber);

    res.status(201).json({
      message: "Registration successful. Please verify your account.",
      userId: user._id,
      pendingVerification: true
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { userId, otp } = req.body;

    if (!userId || !otp) {
      return res.status(400).json({ message: "User ID and OTP are required" });
    }

    await verifyOTP(userId, otp);

    await User.findByIdAndUpdate(userId, { isVerified: true });

    const user = await User.findById(userId);
    const token = generateToken(user);

    res.json({
      message: "Email verified successfully",
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
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: "User is already verified" });
    }

    const result = await resendOTP(userId, user.email, user.phoneNumber);

    res.json({
      message: "OTP sent successfully",
      contact: result.contactValue
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