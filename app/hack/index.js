// GET  /hack -> the "hacker" page (phones).
// POST /hack -> writes "<cow> -_- <message>" to blob storage using ONLY the leaked ACCESS_KEY (Shared Key auth).
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { putBlobWithKey, putBlobWithIdentity, StorageError } = require("../shared/storage");
const { COWS, compose } = require("../shared/cowsay");

const html = fs.readFileSync(path.join(__dirname, "..", "shared", "hack.html"), "utf8");
const MESSAGES = process.env.MESSAGES_CONTAINER || "messages";
const BLOCKED = process.env.BLOCKED_CONTAINER || "blocked";
const MAX_LEN = 120;
// Azure answers a bad Shared Key signature with 403 AuthenticationFailed (the emulator uses 400 InvalidAuthenticationInfo).
const AUTH_ERRORS = new Set(["AuthenticationFailed", "InvalidAuthenticationInfo", "KeyBasedAuthenticationNotPermitted", "AuthorizationFailure"]);

const json = (status, body) => ({ status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body });

// Blob names can be almost anything, but keep them friendly: no path separators, control chars or trailing dots.
function clean(message) {
  return String(message || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\//g, "∕")
    .replace(/\\/g, "⧵")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\.+$/, (dots) => "․".repeat(dots.length))
    .slice(0, MAX_LEN);
}

module.exports = async function (context, req) {
  if (req.method === "GET") {
    context.res = { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body: html };
    return;
  }

  const body = typeof req.body === "string" ? safeJson(req.body) : req.body || {};
  const cow = COWS[body.cow] ? body.cow : "cow";
  const message = clean(body.message);
  if (!message) {
    context.res = json(400, { ok: false, error: "Say something!" });
    return;
  }

  const name = compose(cow, message, crypto.randomBytes(3).toString("hex"));
  const content = JSON.stringify({ cow, message, at: new Date().toISOString() });

  try {
    await putBlobWithKey(MESSAGES, name, content);
    context.log(`HACKED: wrote "${name}" with the leaked access key`);
    context.res = json(201, { ok: true, name });
  } catch (err) {
    if (!(err instanceof StorageError)) throw err;
    context.log.warn(`Shared Key write rejected: ${err.status} ${err.code} - ${err.detail}`);

    const denied = err.status === 401 || err.status === 403 || AUTH_ERRORS.has(err.code);
    if (denied) {
      // Record the failed attempt with the managed identity so the board can gloat about it.
      await putBlobWithIdentity(BLOCKED, `${new Date().toISOString()} ${name}`, content).catch((e) =>
        context.log.error("Could not record blocked attempt", e)
      );
    }
    context.res = json(denied ? 403 : 502, { ok: false, name, status: err.status, code: err.code, detail: err.detail });
  }
};

function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
