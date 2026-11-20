// Must run after verifyToken, because it reads req.user
function requireRole(...allowed) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!allowed.includes(req.user.role)) {
      return res
        .status(403)
        .json({ message: "You do not have permission to do this" });
    }
    next();
  };
}

// The PDF calls customers "renters"
export const verifyRenter = requireRole("customer");
export const verifyOwner = requireRole("owner");
export const verifyAdmin = requireRole("admin");

// For actions shared by owners and admins, such as editing equipment
export const verifyOwnerOrAdmin = requireRole("owner", "admin");
