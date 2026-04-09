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
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid Credentials" });
    }

    const token = generateToken(user);
    res.json({
      user: { id: user._id, name: user.name, email: user.email },
      token
    });
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