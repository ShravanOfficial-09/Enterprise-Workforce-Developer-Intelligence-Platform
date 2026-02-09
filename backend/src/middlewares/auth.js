// JWT verification should be handled by a dedicated auth middleware upstream.
// This module only enforces presence of a user and role-based access control.
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  return next();
};

const requireRole = (roles = []) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  return next();
};

module.exports = { requireAuth, requireRole };
