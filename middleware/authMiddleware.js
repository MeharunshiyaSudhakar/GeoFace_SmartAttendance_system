// middleware/authMiddleware.js
import jwt from "jsonwebtoken";

export const protect = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1]; // "Bearer <token>"

    if (!token) {
      return res.status(401).json({ message: "No token, unauthorized" });
    }

    // ✅ Verify access token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }

    next();
  } catch (err) {
    // ✅ Detect specific JWT errors for frontend auto-refresh
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "TokenExpired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }

    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// ✅ Role-based authorization (no change)
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: You are not allowed to perform this action",
      });
    }
    next();
  };
};
