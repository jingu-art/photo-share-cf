export interface Env {
  R2: R2Bucket;
  R2_ACCOUNT_ID: string;
  R2_ACCESS_KEY_ID: string;
  R2_SECRET_ACCESS_KEY: string;
  R2_BUCKET_NAME: string;
}

interface FolderMetadata {
  name: string;
  createdAt: string;
  fileCount: number;
  totalUploaded: number;
}

interface Folder extends FolderMetadata {
  id: string;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ── AWS Signature V4 helpers ──────────────────────────────────────────────

async function sha256Hex(msg: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(msg));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(key: ArrayBuffer | Uint8Array, msg: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
}

async function signingKey(secret: string, date: string, region: string, service: string): Promise<ArrayBuffer> {
  const d = await hmac(new TextEncoder().encode(`AWS4${secret}`), date);
  const r = await hmac(new Uint8Array(d), region);
  const s = await hmac(new Uint8Array(r), service);
  return hmac(new Uint8Array(s), "aws4_request");
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function presignedUrl(method: "PUT" | "GET", env: Env, key: string, expiresIn = 3600): Promise<string> {
  const region = "auto";
  const service = "s3";
  const host = `${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const dateStr = amzDate.slice(0, 8);
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  const path = `/${env.R2_BUCKET_NAME}/${encodedKey}`;
  const credScope = `${dateStr}/${region}/${service}/aws4_request`;

  const params: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${env.R2_ACCESS_KEY_ID}/${credScope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expiresIn)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  params.sort(([a], [b]) => a.localeCompare(b));
  const qs = params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");

  const canonical = [method, path, qs, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const sts = ["AWS4-HMAC-SHA256", amzDate, credScope, await sha256Hex(canonical)].join("\n");
  const sk = await signingKey(env.R2_SECRET_ACCESS_KEY, dateStr, region, service);
  const sig = toHex(await hmac(new Uint8Array(sk), sts));

  return `https://${host}${path}?${qs}&X-Amz-Signature=${sig}`;
}

// ── R2 helpers ───────────────────────────────────────────────────────────

async function listAll(r2: R2Bucket, prefix = ""): Promise<R2Object[]> {
  const items: R2Object[] = [];
  let cursor: string | undefined;
  do {
    const res = await r2.list({ prefix, cursor, limit: 1000 });
    items.push(...res.objects);
    cursor = res.truncated ? res.cursor : undefined;
  } while (cursor);
  return items;
}

async function readMeta(r2: R2Bucket, id: string): Promise<FolderMetadata | null> {
  const obj = await r2.get(`${id}/_metadata.json`);
  if (!obj) return null;
  return obj.json<FolderMetadata>();
}

async function writeMeta(r2: R2Bucket, id: string, meta: FolderMetadata): Promise<void> {
  await r2.put(`${id}/_metadata.json`, JSON.stringify(meta), {
    httpMetadata: { contentType: "application/json" },
  });
}

// ── Route handlers ───────────────────────────────────────────────────────

async function handleListFolders(env: Env): Promise<Response> {
  const all = await listAll(env.R2);
  const metaKeys = all.filter((o) => o.key.endsWith("/_metadata.json"));
  const folders = (
    await Promise.all(
      metaKeys.map(async (o) => {
        const meta = await readMeta(env.R2, o.key.replace("/_metadata.json", ""));
        if (!meta) return null;
        return { id: o.key.replace("/_metadata.json", ""), ...meta } as Folder;
      })
    )
  )
    .filter((f): f is Folder => f !== null)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return json(folders);
}

async function handleGetFolder(id: string, env: Env): Promise<Response> {
  const meta = await readMeta(env.R2, id);
  if (!meta) return json({ error: "フォルダが見つかりません" }, 404);
  return json({ id, ...meta });
}

async function handleCreateFolder(req: Request, env: Env): Promise<Response> {
  const { name } = await req.json<{ name: string }>();
  if (!name?.trim()) return json({ error: "フォルダ名を入力してください" }, 400);
  const id = crypto.randomUUID();
  const meta: FolderMetadata = {
    name: name.trim(),
    createdAt: new Date().toISOString(),
    fileCount: 0,
    totalUploaded: 0,
  };
  await writeMeta(env.R2, id, meta);
  return json({ id, ...meta }, 201);
}

async function handleRenameFolder(id: string, req: Request, env: Env): Promise<Response> {
  const { name } = await req.json<{ name: string }>();
  if (!name?.trim()) return json({ error: "フォルダ名を入力してください" }, 400);
  const meta = await readMeta(env.R2, id);
  if (!meta) return json({ error: "フォルダが見つかりません" }, 404);
  meta.name = name.trim();
  await writeMeta(env.R2, id, meta);
  return json({ id, ...meta });
}

async function handleDeleteFolder(id: string, env: Env): Promise<Response> {
  const all = await listAll(env.R2, `${id}/`);
  await Promise.all(all.map((o) => env.R2.delete(o.key)));
  return json({ success: true });
}

async function handleListPhotos(folderId: string, env: Env): Promise<Response> {
  const all = await listAll(env.R2, `${folderId}/`);
  const photos = all
    .filter((o) => !o.key.endsWith("/_metadata.json") && !o.key.includes("/thumbs/"))
    .sort((a, b) => a.key.localeCompare(b.key));

  const result = await Promise.all(
    photos.map(async (o) => {
      const filename = o.key.split("/").pop()!;
      const thumbKey = `${folderId}/thumbs/${filename}`;
      const [url, thumbUrl] = await Promise.all([
        presignedUrl("GET", env, o.key, 86400),
        presignedUrl("GET", env, thumbKey, 86400),
      ]);
      return { key: o.key, name: filename, thumbKey, url, thumbUrl, size: o.size };
    })
  );
  return json(result);
}

async function handleDeletePhoto(url: URL, env: Env): Promise<Response> {
  const key = url.searchParams.get("key");
  if (!key) return json({ error: "key が必要です" }, 400);

  await env.R2.delete(key);

  const parts = key.split("/");
  const filename = parts.slice(1).join("/").replace(/^thumbs\//, "");
  const folderId = parts[0];
  const thumbKey = `${folderId}/thumbs/${filename.split("/").pop()}`;
  await env.R2.delete(thumbKey).catch(() => undefined);

  const meta = await readMeta(env.R2, folderId);
  if (meta) {
    meta.fileCount = Math.max(0, meta.fileCount - 1);
    await writeMeta(env.R2, folderId, meta);
  }
  return json({ success: true });
}

async function handleUploadPrepare(req: Request, env: Env): Promise<Response> {
  // ── 8GB 使用量チェック ──────────────────────────────────────────────
  const all = await listAll(env.R2);
  const totalBytes = all.reduce((s, o) => s + o.size, 0);
  const limitBytes = 8 * 1024 * 1024 * 1024;
  if (totalBytes > limitBytes) {
    return json(
      { error: "ストレージ容量が上限(8GB)に達しました。古いフォルダを削除してください。" },
      429
    );
  }

  const { folderId, filenames } = await req.json<{ folderId: string; filenames: string[] }>();
  const meta = await readMeta(env.R2, folderId);
  if (!meta) return json({ error: "フォルダが見つかりません" }, 404);

  const startIndex = meta.totalUploaded;

  const items = await Promise.all(
    filenames.map(async (filename, i) => {
      const idx = String(startIndex + i).padStart(4, "0");
      const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      const key = `${folderId}/${idx}_${safeFilename}`;
      const thumbKey = `${folderId}/thumbs/${idx}_${safeFilename}`;
      const [uploadUrl, thumbUploadUrl] = await Promise.all([
        presignedUrl("PUT", env, key),
        presignedUrl("PUT", env, thumbKey),
      ]);
      return { filename, key, thumbKey, uploadUrl, thumbUploadUrl };
    })
  );

  // totalUploaded を先に加算（重複インデックス防止）
  meta.totalUploaded = startIndex + filenames.length;
  meta.fileCount = meta.fileCount + filenames.length;
  await writeMeta(env.R2, folderId, meta);

  return json({ items, newFileCount: meta.fileCount });
}

async function handleUsage(env: Env): Promise<Response> {
  const all = await listAll(env.R2);
  const totalBytes = all.reduce((s, o) => s + o.size, 0);
  return json({ totalBytes, limitBytes: 8 * 1024 * 1024 * 1024 });
}

// ── Auto-delete cron ─────────────────────────────────────────────────────

async function deleteOldFolders(env: Env): Promise<void> {
  const all = await listAll(env.R2);
  const metaKeys = all.filter((o) => o.key.endsWith("/_metadata.json"));
  const threshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const o of metaKeys) {
    const meta = await readMeta(env.R2, o.key.replace("/_metadata.json", ""));
    if (!meta) continue;
    if (new Date(meta.createdAt) < threshold) {
      const folderId = o.key.replace("/_metadata.json", "");
      const folderObjects = all.filter((x) => x.key.startsWith(`${folderId}/`));
      await Promise.all(folderObjects.map((x) => env.R2.delete(x.key)));
    }
  }
}

// ── Main export ──────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      if (method === "GET" && path === "/api/folders") return handleListFolders(env);
      if (method === "POST" && path === "/api/folders") return handleCreateFolder(request, env);
      if (method === "POST" && path === "/api/upload-prepare") return handleUploadPrepare(request, env);
      if (method === "GET" && path === "/api/usage") return handleUsage(env);

      const folderMatch = path.match(/^\/api\/folders\/([^/]+)$/);
      if (folderMatch) {
        const id = decodeURIComponent(folderMatch[1]);
        if (method === "GET") return handleGetFolder(id, env);
        if (method === "DELETE") return handleDeleteFolder(id, env);
        if (method === "PATCH") return handleRenameFolder(id, request, env);
      }

      const photosMatch = path.match(/^\/api\/folders\/([^/]+)\/photos$/);
      if (photosMatch && method === "GET") return handleListPhotos(decodeURIComponent(photosMatch[1]), env);

      if (method === "DELETE" && path === "/api/photos") return handleDeletePhoto(url, env);

      return json({ error: "Not found" }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: "Internal server error" }, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    await deleteOldFolders(env);
  },
};
