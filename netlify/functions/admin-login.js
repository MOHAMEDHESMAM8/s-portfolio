function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    const expectedUser = requireEnv("ADMIN_USERNAME");
    const expectedPass = requireEnv("ADMIN_PASSWORD");
    const providedUser = event.headers["x-admin-user"] || event.headers["X-Admin-User"];
    const providedPass = event.headers["x-admin-pass"] || event.headers["X-Admin-Pass"];

    if (
      !providedUser ||
      !providedPass ||
      providedUser !== expectedUser ||
      providedPass !== expectedPass
    ) {
      return jsonResponse(401, { error: "Wrong username or password" });
    }

    return jsonResponse(200, { ok: true });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Unexpected error" });
  }
};
