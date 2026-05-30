const axios = require("axios");

const AUTH_URL = "http://4.224.186.213/evaluation-service/auth";
const LOG_URL = "http://4.224.186.213/evaluation-service/logs";
const CREDS = {
  email: "2300030455@kluniversity.in",
  name: "nekkanti sai vighnesh",
  rollNo: "2300030455",
  accessCode: "AvrAAK",
  clientID: "74770aa4-d2da-462b-a167-e01626652427",
  clientSecret: "dQjjhAVrEGEgGaea"
};

let token = null;
let tokenExpiry = 0;

async function getToken() {
  if (token && Date.now() < tokenExpiry - 30000) return token;
  const res = await axios.post(AUTH_URL, CREDS, {
    headers: { "Content-Type": "application/json" }
  });
  token = res.data.access_token;
  tokenExpiry = res.data.expires_in * 1000;
  return token;
}

async function authHeaders() {
  const t = await getToken();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${t}`
  };
}

async function Log(stack, level, pkg, message) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] [${level.toUpperCase()}] [${pkg}] ${message}`);
  try {
    const headers = await authHeaders();
    const body = { stack, level, message: message.substring(0, 48) };
    body["package"] = pkg;
    const res = await axios.post(LOG_URL, body, { headers });
    console.log(`  -> logID: ${res.data.logID}`);
    return res.data;
  } catch (err) {
    console.error(`  -> LOG ERROR: ${err.response ? JSON.stringify(err.response.data) : err.message}`);
  }
}

module.exports = { Log, getToken, authHeaders };
