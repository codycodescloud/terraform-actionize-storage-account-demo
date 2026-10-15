// GET /cowsay.js -> the same renderer the functions use, for the browser.
const fs = require("fs");
const path = require("path");

const js = fs.readFileSync(path.join(__dirname, "..", "shared", "cowsay.js"), "utf8");

module.exports = async function (context) {
  context.res = { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "public, max-age=300" }, body: js };
};
