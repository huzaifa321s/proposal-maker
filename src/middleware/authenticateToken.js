import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
console.log('token',token)
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user; // { id, role }
    next();
  });
};



export const requireRole = (roles) => (req, res, next) => {
  console.log('roles',roles)
  console.log('req.user',req.user)
  console.log("rolessss",!roles.includes(req.user.role))
  if (!req.user || !roles.includes(req.user.role)) {
      console.log('ddd')
    return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
  }
  next();
};
