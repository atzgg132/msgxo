const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if(!authHeader) {
    return res.status(401).json({ msg: 'No token' });
  }
  const token = authHeader.split(' ')[1];
  if(!token) {
    return res.status(401).json({ msg: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch(err) {
    console.error(err);
    return res.status(401).json({ msg: 'Invalid token' });
  }
};
