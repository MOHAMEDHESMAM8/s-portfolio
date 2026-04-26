const GITHUB_API_BASE = "https://api.github.com";

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

function getHeader(event, name) {
  const lower = name.toLowerCase();
  return event.headers[lower] || event.headers[name] || "";
}

function assertAuth(event) {
  const expectedUser = requireEnv("ADMIN_USERNAME");
  const expectedPass = requireEnv("ADMIN_PASSWORD");
  const providedUser = getHeader(event, "x-admin-user");
  const providedPass = getHeader(event, "x-admin-pass");
  if (
    !providedUser ||
    !providedPass ||
    providedUser !== expectedUser ||
    providedPass !== expectedPass
  ) {
    throw new Error("Unauthorized");
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "GET") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    assertAuth(event);

    const githubToken = requireEnv("GITHUB_TOKEN");
    const githubRepo = requireEnv("GITHUB_REPO");
    const githubBranch = process.env.GITHUB_BRANCH || "main";

    const listUrl = `${GITHUB_API_BASE}/repos/${githubRepo}/contents/fashion?ref=${encodeURIComponent(githubBranch)}`;
    const res = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "netlify-image-uploader",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to list fashion images: ${res.status} ${text}`);
    }

    const items = await res.json();
    const allowedExt = /\.(webp|jpg|jpeg|png|gif|avif)$/i;
    const sources = (Array.isArray(items) ? items : [])
      .filter((item) => item && item.type === "file" && allowedExt.test(item.name || ""))
      .map((item) => `fashion/${item.name}`)
      .sort((a, b) => a.localeCompare(b));

    return jsonResponse(200, {
      ok: true,
      sources,
    });
  } catch (error) {
    if (error.message === "Unauthorized") {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    return jsonResponse(500, { error: error.message || "Unexpected error" });
  }
};
