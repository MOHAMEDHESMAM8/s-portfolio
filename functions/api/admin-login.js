function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

function requireEnv(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const expectedUser = requireEnv(env, "ADMIN_USERNAME");
    const expectedPass = requireEnv(env, "ADMIN_PASSWORD");
    const providedUser = request.headers.get("x-admin-user");
    const providedPass = request.headers.get("x-admin-pass");

    if (
      !providedUser ||
      !providedPass ||
      providedUser !== expectedUser ||
      providedPass !== expectedPass
    ) {
      return json(401, { error: "Wrong username or password" });
    }

    return json(200, { ok: true });
  } catch (error) {
    return json(500, { error: error.message || "Unexpected error" });
  }
}
