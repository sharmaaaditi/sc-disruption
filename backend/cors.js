const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000",
];

function parseOrigins(corsOrigins) {
  if (Array.isArray(corsOrigins)) {
    return corsOrigins.map((o) => String(o).trim()).filter(Boolean);
  }
  if (typeof corsOrigins === "string" && corsOrigins.trim() !== "") {
    return corsOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return DEFAULT_ALLOWED_ORIGINS;
}

function createCorsMiddleware(corsOrigins) {
  const allowedOrigins = parseOrigins(corsOrigins);
  const allowedSet = new Set(allowedOrigins);

  return (req, res, next) => {
    const origin = req.headers.origin;

    if (origin && allowedSet.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
      res.setHeader(
        "Access-Control-Allow-Headers",
        req.headers["access-control-request-headers"] ||
          "Content-Type, Authorization"
      );
      res.setHeader("Access-Control-Max-Age", "86400");
    }

    if (req.method === "OPTIONS") {
      if (origin && allowedSet.has(origin)) {
        return res.sendStatus(204);
      }
      return res.status(403).end();
    }

    next();
  };
}

module.exports = {
  createCorsMiddleware,
  parseOrigins,
  DEFAULT_ALLOWED_ORIGINS,
};
