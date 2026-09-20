const jwt = require("jsonwebtoken");

/** Vérifie le jeton JWT dans l'en-tête Authorization ("Bearer <token>") et
 *  expose req.user = { id, role, agencyId, agentRole }. Renvoie 401 si le
 *  jeton est absent, mal formé, expiré, ou invalide. */
function authenticate(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthenticated" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: "invalid_token" });
  }
}

/** À utiliser après authenticate — restreint la route aux rôles donnés.
 *  Usage : router.delete("/:id", authenticate, requireRole("admin"), ...) */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "forbidden" });
    }
    next();
  };
}

module.exports = { authenticate, requireRole };
