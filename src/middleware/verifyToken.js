import { createRemoteJWKSet, jwtVerify } from "jose";

let jwks;

function authUrl() {
  return (process.env.AUTH_URL || "").replace(/\/+$/, "");
}

// The public keys that Better Auth publishes. Downloaded once, then cached.
function getKeys() {
  const url = authUrl();
  if (!url) throw new Error("AUTH_URL is not set");
  jwks ??= createRemoteJWKSet(new URL(`${url}/api/auth/jwks`));
  return jwks;
}

export default async function verifyToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // 1. Check the token itself: signature, expiry, issuer and audience
  let email;
  try {
    const { payload } = await jwtVerify(token, getKeys(), {
      issuer: authUrl(),
      audience: authUrl(),
    });
    email =
      typeof payload.email === "string" ? payload.email.toLowerCase() : "";
    if (!email) throw new Error("Token has no email");
  } catch (err) {
    console.error("Token verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  // 2. Load the current user and role from the database
  try {
    const user = await req.app.locals.db.collection("user").findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Account not found" });
    }

    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name || "",
      image: user.image || "",
      phone: user.phone || "",
      address: user.address || "",
      role: user.role || "customer",
      requestedRole: user.requestedRole || "none",
      roleRequestStatus: user.roleRequestStatus || "none",
      createdAt: user.createdAt,
    };
    next();
  } catch (err) {
    next(err);
  }
}
