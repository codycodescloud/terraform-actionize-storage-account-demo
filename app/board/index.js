// GET /  -> the big-screen board. Reads happen via /api/messages (managed identity).
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "shared", "board.html"), "utf8");

module.exports = async function (context) {
  context.res = { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, body: html };
};
