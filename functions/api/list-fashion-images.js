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

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    assertAuth(request, env);

    const githubToken = requireEnv(env, "GITHUB_TOKEN");
    const githubRepo = requireEnv(env, "GITHUB_REPO");
    const githubBranch = env.GITHUB_BRANCH || "main";

    const listUrl = `${GITHUB_API_BASE}/repos/${githubRepo}/contents/fashion?ref=${encodeURIComponent(githubBranch)}`;
    const res = await fetch(listUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "cloudflare-image-uploader",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to list fashion images: ${res.status} ${text}`);
    }

    const items = await res.json();
    const allowedExt = /\.(webp|jpg|jpeg|png|gif|avif)$/i;
    const imageItems = (Array.isArray(items) ? items : [])
      .filter((item) => item && item.type === "file" && allowedExt.test(item.name || ""))
      .map((item) => ({
        src: `fashion/${item.name}`,
        previewUrl: item.download_url || "",
      }))
      .sort((a, b) => a.src.localeCompare(b.src));

    const sources = imageItems.map((item) => item.src);

    return json(200, {
      ok: true,
      sources,
      images: imageItems,
    });
  } catch (error) {
    if (error.message === "Unauthorized") {
      return json(401, { error: "Unauthorized" });
    }
    return json(500, { error: error.message || "Unexpected error" });
  }
}
