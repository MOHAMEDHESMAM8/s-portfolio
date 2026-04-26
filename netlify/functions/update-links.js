const GITHUB_API_BASE = "https://api.github.com";
const LINKS_FILE_PATH = "data/links.json";

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

function assertString(value, name) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid field: ${name}`);
  }
  return value.trim();
}

function assertVideoList(value, name, includeLabel) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid field: ${name} must be a non-empty array`);
  }

  return value.map(function (item, index) {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid field: ${name}[${index}] must be an object`);
    }
    const normalized = {
      title: assertString(item.title, `${name}[${index}].title`),
      previewUrl: assertString(item.previewUrl, `${name}[${index}].previewUrl`),
    };
    if (includeLabel) {
      normalized.label = assertString(item.label, `${name}[${index}].label`);
    }
    return normalized;
  });
}

function assertImageList(value, name) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Invalid field: ${name} must be a non-empty array`);
  }
  return value.map(function (item, index) {
    if (!item || typeof item !== "object") {
      throw new Error(`Invalid field: ${name}[${index}] must be an object`);
    }
    return {
      src: assertString(item.src, `${name}[${index}].src`),
      alt: assertString(item.alt, `${name}[${index}].alt`),
    };
  });
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
      return jsonResponse(401, { error: "Unauthorized" });
    }

    const payload = JSON.parse(event.body || "{}");
    const links = {
      instagramUrl: assertString(payload.instagramUrl, "instagramUrl"),
      instagramHandle: assertString(payload.instagramHandle, "instagramHandle"),
      whatsappUrl: assertString(payload.whatsappUrl, "whatsappUrl"),
      phoneDisplay: assertString(payload.phoneDisplay, "phoneDisplay"),
      phoneRaw: assertString(payload.phoneRaw, "phoneRaw"),
      fashionGalleryUrl: assertString(payload.fashionGalleryUrl, "fashionGalleryUrl"),
      ugcGalleryUrl: assertString(payload.ugcGalleryUrl, "ugcGalleryUrl"),
      eventsGalleryUrl: assertString(payload.eventsGalleryUrl, "eventsGalleryUrl"),
      fashionVideos: assertVideoList(payload.fashionVideos, "fashionVideos", false),
      fashionImages: assertImageList(payload.fashionImages, "fashionImages"),
      ugcVideos: assertVideoList(payload.ugcVideos, "ugcVideos", true),
      eventsVideos: assertVideoList(payload.eventsVideos, "eventsVideos", true),
    };

    const githubToken = requireEnv("GITHUB_TOKEN");
    const githubRepo = requireEnv("GITHUB_REPO");
    const githubBranch = process.env.GITHUB_BRANCH || "main";

    const fileUrl = `${GITHUB_API_BASE}/repos/${githubRepo}/contents/${LINKS_FILE_PATH}?ref=${encodeURIComponent(githubBranch)}`;
    const getRes = await fetch(fileUrl, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "netlify-links-dashboard",
      },
    });

    if (!getRes.ok) {
      const text = await getRes.text();
      throw new Error(`Failed to read ${LINKS_FILE_PATH}: ${getRes.status} ${text}`);
    }

    const existingFile = await getRes.json();
    const content = Buffer.from(JSON.stringify(links, null, 2) + "\n", "utf8").toString("base64");

    const updateRes = await fetch(`${GITHUB_API_BASE}/repos/${githubRepo}/contents/${LINKS_FILE_PATH}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "netlify-links-dashboard",
      },
      body: JSON.stringify({
        message: "chore: update site links via dashboard",
        content,
        sha: existingFile.sha,
        branch: githubBranch,
      }),
    });

    if (!updateRes.ok) {
      const text = await updateRes.text();
      throw new Error(`Failed to update ${LINKS_FILE_PATH}: ${updateRes.status} ${text}`);
    }

    return jsonResponse(200, {
      ok: true,
      updatedAt: new Date().toISOString(),
      branch: githubBranch,
    });
  } catch (error) {
    return jsonResponse(500, { error: error.message || "Unexpected error" });
  }
};
