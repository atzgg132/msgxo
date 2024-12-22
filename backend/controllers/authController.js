const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

exports.registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if(!username || !email || !password) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    // check if email or username exist
    const existingEmail = await User.findOne({ email });
    if(existingEmail) {
      return res.status(400).json({ msg: 'Email already used' });
    }
    const existingUser = await User.findOne({ username });
    if(existingUser) {
      return res.status(400).json({ msg: 'Username taken' });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username,
      email,
      password: hashed
    });

    // create JWT
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    return res.status(201).json({
      msg: 'Registered',
      token,
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    if(!email || !password) {
      return res.status(400).json({ msg: 'All fields are required' });
    }

    const user = await User.findOne({ email });
    if(!user) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if(!match) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });

    return res.status(200).json({
      msg: 'Logged in',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email
      }
    });
  } catch(err) {
    console.error(err);
    return res.status(500).json({ msg: 'Server error' });
  }
};
