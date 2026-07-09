export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8082";

const responseCache = new Map();
const inFlightRequests = new Map();
const cacheLinks = new Map();
const DEFAULT_CACHE_TTL_MS = 120000;

const normalizeHeaders = (headers = {}) => {
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }
  return { ...(headers || {}) };
};

const buildCacheKey = (url, token, customKey) => {
  const scope = token || "anonymous";
  const base = customKey || url;
  return `${base}::${scope}`;
};

const registerCacheLinks = (keys = []) => {
  const uniqueKeys = Array.from(new Set((Array.isArray(keys) ? keys : []).filter(Boolean)));
  if (uniqueKeys.length <= 1) return;

  uniqueKeys.forEach((key) => {
    const linked = cacheLinks.get(key) || new Set();
    uniqueKeys.forEach((otherKey) => {
      if (otherKey !== key) linked.add(otherKey);
    });
    if (linked.size > 0) {
      cacheLinks.set(key, linked);
    }
  });
};

const collectLinkedKeys = (seedKeys = []) => {
  const queue = Array.from(new Set((Array.isArray(seedKeys) ? seedKeys : []).filter(Boolean)));
  const collected = new Set();

  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || collected.has(key)) continue;
    collected.add(key);
    const linked = cacheLinks.get(key);
    if (!linked) continue;
    linked.forEach((relatedKey) => {
      if (!collected.has(relatedKey)) {
        queue.push(relatedKey);
      }
    });
  }

  return collected;
};

const unlinkCacheKeys = (keys = []) => {
  const toRemove = new Set((Array.isArray(keys) ? keys : []).filter(Boolean));
  if (toRemove.size === 0) return;

  toRemove.forEach((key) => {
    cacheLinks.delete(key);
  });

  Array.from(cacheLinks.entries()).forEach(([key, linked]) => {
    let changed = false;
    toRemove.forEach((removedKey) => {
      if (linked.delete(removedKey)) {
        changed = true;
      }
    });
    if (changed) {
      if (linked.size === 0) {
        cacheLinks.delete(key);
      } else {
        cacheLinks.set(key, linked);
      }
    }
  });
};

const cloneData = (data) => {
  if (data == null) return data;
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }
  try {
    return JSON.parse(JSON.stringify(data));
  } catch {
    return data;
  }
};

const readErrorMessage = async (res) => {
  const fallback = `Request failed (${res.status})`;
  try {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await res.json();
      return body?.message || body?.error || fallback;
    }
    const text = await res.text();
    return text || fallback;
  } catch {
    return fallback;
  }
};

export const invalidateApiCache = (matcher) => {
  if (!matcher) {
    responseCache.clear();
    inFlightRequests.clear();
    cacheLinks.clear();
    return;
  }

  const candidateKeys = Array.from(
    new Set([
      ...responseCache.keys(),
      ...inFlightRequests.keys(),
      ...cacheLinks.keys(),
    ])
  );

  const matchedKeys = candidateKeys.filter((key) => {
    const shouldDelete = typeof matcher === "function"
      ? !!matcher(key)
      : matcher instanceof RegExp
        ? matcher.test(key)
        : String(key).includes(String(matcher));
    return shouldDelete;
  });

  const keysToDelete = collectLinkedKeys(matchedKeys);
  keysToDelete.forEach((key) => {
    responseCache.delete(key);
    inFlightRequests.delete(key);
  });
  unlinkCacheKeys(Array.from(keysToDelete));
};

export const fetchJson = async (url, options = {}) => {
  const { token, headers, ...init } = options;
  const normalizedHeaders = normalizeHeaders(headers);
  if (token) {
    normalizedHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...init,
    headers: normalizedHeaders,
  });

  if (!res.ok) {
    throw new Error(await readErrorMessage(res));
  }

  return res.json();
};

export const fetchJsonCached = async (url, options = {}) => {
  const {
    token,
    ttlMs = DEFAULT_CACHE_TTL_MS,
    force = false,
    cacheKey,
    ...rest
  } = options;

  const primaryKey = buildCacheKey(url, token, cacheKey);
  const urlScopedKey = buildCacheKey(url, token, null);
  const relatedKeys =
    primaryKey === urlScopedKey
      ? [primaryKey]
      : [primaryKey, urlScopedKey];
  registerCacheLinks(relatedKeys);
  const now = Date.now();
  if (!force) {
    for (const key of relatedKeys) {
      const cached = responseCache.get(key);
      if (cached && cached.expiresAt > now) {
        if (key !== primaryKey) {
          responseCache.set(primaryKey, cached);
        }
        return cloneData(cached.data);
      }
    }
  }

  if (!force) {
    for (const key of relatedKeys) {
      if (inFlightRequests.has(key)) {
        const inFlight = inFlightRequests.get(key);
        if (key !== primaryKey) {
          inFlightRequests.set(primaryKey, inFlight);
        }
        return cloneData(await inFlight);
      }
    }
  }

  const task = (async () => {
    const data = await fetchJson(url, { token, ...rest });
    const expiresAt = now + Math.max(1000, Number(ttlMs) || DEFAULT_CACHE_TTL_MS);
    relatedKeys.forEach((key) => {
      responseCache.set(key, { data, expiresAt });
    });
    return data;
  })();

  relatedKeys.forEach((key) => {
    inFlightRequests.set(key, task);
  });
  try {
    return cloneData(await task);
  } finally {
    relatedKeys.forEach((key) => {
      inFlightRequests.delete(key);
    });
  }
};

export const resolveFileUrl = (url) => {
  if (!url || typeof url !== "string") return "";
  let value = url.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("data:") || value.startsWith("blob:")) return value;

  const base = API_BASE_URL.replace(/\/+$/, "");

  // Handle legacy "ObjectId('...')" formats.
  const objectIdMatch = value.match(/[a-f\d]{24}/i);
  if (objectIdMatch) {
    return `${base}/api/files/${objectIdMatch[0]}`;
  }

  // Normalize old `/files/...` routes to current `/api/files/...`.
  if (value.startsWith("/files/")) {
    return `${base}/api${value}`;
  }
  if (value.startsWith("files/")) {
    return `${base}/api/${value}`;
  }

  // Support legacy values that may store only the GridFS object id.
  if (!value.includes("/")) {
    // Some older records may store the GridFS filename instead of id/path.
    const looksLikeFilename = value.startsWith("avatar_") || value.includes(".");
    return looksLikeFilename ? `${base}/api/files/${encodeURIComponent(value)}` : "";
  }

  const path = value.startsWith("/") ? value : `/${value}`;
  return `${base}${path}`;
};
