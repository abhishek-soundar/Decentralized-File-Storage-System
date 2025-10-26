// src/services/pinata.service.js
const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const config = require("../config");

const PINATA_BASE_URL = "https://api.pinata.cloud/pinning";
const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs";

async function pinFile(filePath) {
  if (!config.pinataJwt && (!config.pinataApiKey || !config.pinataApiSecret)) {
    throw new Error("Pinata credentials missing in .env");
  }

  const data = new FormData();
  data.append("file", fs.createReadStream(filePath));

  const metadata = JSON.stringify({
    name: filePath.split("/").pop(),
  });
  data.append("pinataMetadata", metadata);

  const options = JSON.stringify({
    cidVersion: 1,
  });
  data.append("pinataOptions", options);

  const headers = {
    ...data.getHeaders(),
    Authorization: `Bearer ${config.pinataJwt}`,
  };

  const res = await axios.post(`${PINATA_BASE_URL}/pinFileToIPFS`, data, { headers });
  return res.data.IpfsHash;
}

async function unpin(cid) {
  const headers = {
    Authorization: `Bearer ${config.pinataJwt}`,
  };
  const res = await axios.delete(`${PINATA_BASE_URL}/unpin/${cid}`, { headers });
  return res.data;
}

// NEW: fetch file from Pinata gateway as a stream
async function fetchFileStream(cid) {
  if (!cid) throw new Error("CID required");
  const url = `${PINATA_GATEWAY}/${cid}`;
  // No auth needed for the gateway; it returns the file bytes.
  const res = await axios.get(url, { responseType: "stream", timeout: 600000 });
  // res.data is a readable stream
  return { stream: res.data, headers: res.headers };
}

module.exports = { pinFile, unpin, fetchFileStream };
