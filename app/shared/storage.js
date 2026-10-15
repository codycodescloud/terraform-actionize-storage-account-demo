// Minimal, dependency-free Azure Blob client with two deliberately different auth paths:
//
//   * putBlobWithKey   -> Shared Key (the leaked ACCESS_KEY). Breaks the moment key1 is rotated.
//   * listBlobs /
//     putBlobWithIdentity -> the Function App's managed identity (Entra ID). Unaffected by key rotation.
"use strict";

const crypto = require("crypto");

const API_VERSION = "2021-08-06";

const account = () => process.env.BOARD_ACCOUNT_NAME;
const endpoint = () =>
  (process.env.BOARD_BLOB_ENDPOINT || `https://${account()}.blob.core.windows.net`).replace(/\/+$/, "");

function blobUrl(container, name) {
  return new URL(`${endpoint()}/${container}/${encodeURIComponent(name)}`);
}

class StorageError extends Error {
  constructor(status, code, detail) {
    super(`${status} ${code || ""}`.trim());
    this.status = status;
    this.code = code;
    this.detail = detail;
  }
}

async function check(res) {
  if (res.ok) return res;
  const body = await res.text();
  const msg = /<Message>([\s\S]*?)<\/Message>/.exec(body);
  throw new StorageError(res.status, res.headers.get("x-ms-error-code"), msg ? msg[1].split("\n")[0] : body.slice(0, 300));
}

// ---------------------------------------------------------------------------
// Shared Key: https://learn.microsoft.com/rest/api/storageservices/authorize-with-shared-key
// ---------------------------------------------------------------------------
async function putBlobWithKey(container, name, text, key = process.env.ACCESS_KEY || "") {
  const body = Buffer.from(text, "utf8");
  const url = blobUrl(container, name);
  const contentType = "application/json; charset=utf-8";
  const msHeaders = {
    "x-ms-blob-type": "BlockBlob",
    "x-ms-date": new Date().toUTCString(),
    "x-ms-version": API_VERSION,
  };

  const stringToSign =
    [
      "PUT",
      "", // Content-Encoding
      "", // Content-Language
      String(body.length), // Content-Length
      "", // Content-MD5
      contentType,
      "", // Date (x-ms-date is used instead)
      "", // If-Modified-Since
      "", // If-Match
      "", // If-None-Match
      "", // If-Unmodified-Since
      "", // Range
    ].join("\n") +
    "\n" +
    Object.keys(msHeaders).sort().map((h) => `${h}:${msHeaders[h]}\n`).join("") +
    `/${account()}${url.pathname}`;

  const signature = crypto
    .createHmac("sha256", Buffer.from(key, "base64"))
    .update(stringToSign, "utf8")
    .digest("base64");

  return check(
    await fetch(url, {
      method: "PUT",
      headers: { ...msHeaders, "content-type": contentType, authorization: `SharedKey ${account()}:${signature}` },
      body,
    })
  );
}

// ---------------------------------------------------------------------------
// Managed identity (App Service / Functions identity endpoint)
// ---------------------------------------------------------------------------
let cachedToken;

async function getToken() {
  if (process.env.BOARD_DEV_BEARER) return process.env.BOARD_DEV_BEARER; // local testing only
  if (cachedToken && cachedToken.expiresOn - 300 > Date.now() / 1000) return cachedToken.token;

  const url = new URL(process.env.IDENTITY_ENDPOINT);
  url.searchParams.set("resource", "https://storage.azure.com/");
  url.searchParams.set("api-version", "2019-08-01");
  const res = await fetch(url, { headers: { "X-IDENTITY-HEADER": process.env.IDENTITY_HEADER } });
  if (!res.ok) throw new StorageError(res.status, "ManagedIdentityTokenFailed", await res.text());
  const json = await res.json();
  cachedToken = { token: json.access_token, expiresOn: Number(json.expires_on) };
  return cachedToken.token;
}

async function identityHeaders() {
  return { authorization: `Bearer ${await getToken()}`, "x-ms-version": API_VERSION };
}

const decodeXml = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

async function listBlobs(container) {
  const blobs = [];
  let marker = "";
  do {
    const url = new URL(`${endpoint()}/${container}`);
    url.searchParams.set("restype", "container");
    url.searchParams.set("comp", "list");
    if (marker) url.searchParams.set("marker", marker);
    const xml = await (await check(await fetch(url, { headers: await identityHeaders() }))).text();

    for (const [, blob] of xml.matchAll(/<Blob>([\s\S]*?)<\/Blob>/g)) {
      const name = /<Name[^>]*>([\s\S]*?)<\/Name>/.exec(blob);
      const modified = /<Last-Modified>([\s\S]*?)<\/Last-Modified>/.exec(blob);
      if (name) blobs.push({ name: decodeXml(name[1]), lastModified: modified ? new Date(modified[1]).toISOString() : null });
    }
    const next = /<NextMarker>([\s\S]*?)<\/NextMarker>/.exec(xml);
    marker = next ? decodeXml(next[1]) : "";
  } while (marker);
  return blobs;
}

async function putBlobWithIdentity(container, name, text) {
  return check(
    await fetch(blobUrl(container, name), {
      method: "PUT",
      headers: { ...(await identityHeaders()), "x-ms-blob-type": "BlockBlob", "content-type": "application/json; charset=utf-8" },
      body: Buffer.from(text, "utf8"),
    })
  );
}

module.exports = { StorageError, putBlobWithKey, putBlobWithIdentity, listBlobs };
