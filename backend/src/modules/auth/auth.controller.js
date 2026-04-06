const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("./user.model");
const { JWT_SECRET } = require("../../config/env");

const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // ✅ Proper hashing
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword
    });

    const token = generateToken(user);

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      token
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.login = async(req,res)=>{
    try{
        const {email,password}=req.body;
        const user = await User.findOne({email});
        if(!user){
            return res.status(400).json({message:"Invalid Credentials"});
        }
        const isMatch = await bcrypt.compare(password,user.password);
        if(!isMatch){
            return res.status(400).json({message:"Invalid Credentials"});
        }
        const token = generateToken(user);
        res.json({
            user:{
                id:user._id,
                name:user.name,
                email:user.email
            },
            token
        });
    }catch(err){
        res.status(500).json({message:err.message});
    }
}

exports.searchUsers = async (req, res) => {
  try {
    const q = req.query.q;

    if (!q) {
      return res.json([]);
    }

    const users = await User.find({
      email: { $regex: q, $options: "i" }
    }).select("name email");

    res.json(users);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};