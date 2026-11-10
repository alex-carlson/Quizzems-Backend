export const isAdmin = (userId) => {
  const adminList = process.env.ADMIN_UUIDS
    ? process.env.ADMIN_UUIDS.split(',').map(id => id.trim())
    : [];
  return adminList.includes(userId);
};

/**
 * Middleware to verify admin status
 * Requires verifySupabaseToken to run first
 * Checks against ADMIN_UUIDS environment variable
 */
export const verifyAdminToken = async (req, res, next) => {
  // Ensure user is authenticated first
  if (!req.user || !req.user.id) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isAdmin(req.user.id)) {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }

  next();
};

export default verifyAdminToken;
