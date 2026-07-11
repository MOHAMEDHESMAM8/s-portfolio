const GITHUB_API_BASE = "https://api.github.com";

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

function assertAuth(request, env) {
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

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    assertAuth(request, env);

    const payload = await request.json().catch(() => ({}));
    const fileName = sanitizeFileName(payload.fileName);
    const base64Data = payload.base64Data;
    if (typeof base64Data !== "string" || base64Data.trim() === "") {
      return json(400, { error: "Invalid image data" });
    }

    const githubToken = requireEnv(env, "GITHUB_TOKEN");
    const githubRepo = requireEnv(env, "GITHUB_REPO");
    const githubBranch = env.GITHUB_BRANCH || "main";
    const targetPath = `fashion/${fileName}`;

    const putRes = await fetch(`${GITHUB_API_BASE}/repos/${githubRepo}/contents/${targetPath}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-image-uploader",
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

    return json(200, {
      ok: true,
      src: targetPath,
    });
  } catch (error) {
    if (error.message === "Unauthorized") {
      return json(401, { error: "Unauthorized" });
    }
    return json(500, { error: error.message || "Unexpected error" });
  }
}
