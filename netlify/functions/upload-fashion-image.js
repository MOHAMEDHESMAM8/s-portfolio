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

function sanitizeFileName(name) {
  const cleaned = String(name || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!cleaned) {
    return `image-${Date.now()}.webp`;
  }
  return cleaned;
}

exports.handler = async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  try {
    assertAuth(event);

    const payload = JSON.parse(event.body || "{}");
    const fileName = sanitizeFileName(payload.fileName);
    const base64Data = payload.base64Data;
    if (typeof base64Data !== "string" || base64Data.trim() === "") {
      return jsonResponse(400, { error: "Invalid image data" });
    }

    const githubToken = requireEnv("GITHUB_TOKEN");
    const githubRepo = requireEnv("GITHUB_REPO");
    const githubBranch = process.env.GITHUB_BRANCH || "main";
    const targetPath = `fashion/${fileName}`;

    const putRes = await fetch(`${GITHUB_API_BASE}/repos/${githubRepo}/contents/${targetPath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "netlify-image-uploader",
      },
      body: JSON.stringify({
        message: `chore: upload fashion image ${fileName}`,
        content: base64Data,
        branch: githubBranch,
      }),
    });

    if (!putRes.ok) {
      const text = await putRes.text();
      throw new Error(`Failed to upload image: ${putRes.status} ${text}`);
    }

    return jsonResponse(200, {
      ok: true,
      src: targetPath,
    });
  } catch (error) {
    if (error.message === "Unauthorized") {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    return jsonResponse(500, { error: error.message || "Unexpected error" });
  }
};
