// GET /api/messages -> every message blob + every blocked attempt, read with the MANAGED IDENTITY.
// This keeps working after the access key is rotated, so the board stays up while the hackers get 403s.
const { listBlobs } = require("../shared/storage");
const { parse } = require("../shared/cowsay");

const MESSAGES = process.env.MESSAGES_CONTAINER || "messages";
const BLOCKED = process.env.BLOCKED_CONTAINER || "blocked";
const json = (status, body) => ({ status, headers: { "content-type": "application/json", "cache-control": "no-store" }, body });

module.exports = async function (context) {
  try {
    const [messages, blocked] = await Promise.all([listBlobs(MESSAGES), listBlobs(BLOCKED)]);
    const newestFirst = (a, b) => (b.lastModified || "").localeCompare(a.lastModified || "");

    context.res = json(200, {
      account: process.env.BOARD_ACCOUNT_NAME,
      messages: messages.sort(newestFirst).slice(0, 200).map((b) => ({ ...b, ...parse(b.name) })),
      blocked: {
        count: blocked.length,
        // blocked blob names are "<ISO timestamp> <attempted message blob name>"
        recent: blocked.sort(newestFirst).slice(0, 20).map((b) => ({ at: b.lastModified, ...parse(b.name.replace(/^\S+ /, "")) })),
      },
    });
  } catch (err) {
    context.log.error("Board read failed", err);
    context.res = json(502, { error: err.message, code: err.code, detail: err.detail });
  }
};
