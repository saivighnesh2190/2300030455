const axios = require("axios");

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJNYXBDbGFpbXMiOnsiYXVkIjoiaHR0cDovLzIwLjI0NC41Ni4xNDQvZXZhbHVhdGlvbi1zZXJ2aWNlIiwiZW1haWwiOiIyMzAwMDMwNDU1QGtsdW5pdmVyc2l0eS5pbiIsImV4cCI6MTc4MDEyMDM1OSwiaWF0IjoxNzgwMTE5NDU5LCJpc3MiOiJBZmZvcmQgTWVkaWNhbCBUZWNobm9sb2dpZXMgUHJpdmF0ZSBMaW1pdGVkIiwianRpIjoiMGU4MDc5YjQtZmEzNS00NmIzLWIyMzctNTVhYjdmZjkwNThmIiwibG9jYWxlIjoiZW4tSU4iLCJuYW1lIjoibmVra2FudGkgc2FpIHZpZ2huZXNoIiwic3ViIjoiNzQ3NzBhYTQtZDJkYS00NjJiLWExNjctZTAxNjI2NjUyNDI3In0sImVtYWlsIjoiMjMwMDAzMDQ1NUBrbHVuaXZlcnNpdHkuaW4iLCJuYW1lIjoibmVra2FudGkgc2FpIHZpZ2huZXNoIiwicm9sbE5vIjoiMjMwMDAzMDQ1NSIsImFjY2Vzc0NvZGUiOiJBdnJBQUsiLCJjbGllbnRJRCI6Ijc0NzcwYWE0LWQyZGEtNDYyYi1hMTY3LWUwMTYyNjY1MjQyNyIsImNsaWVudFNlY3JldCI6ImRRampoQVZyRUdFZ0dhZWEifQ.IV6UsTwJO4faTEEARfoA0JTcBlIv-_HGusGWaqJ0UBs";

const LOG_URL = "http://4.224.186.213/evaluation-service/logs";

/**
 * Sends a structured log entry to the evaluation service.
 *
 * @param {string} stack   - The stack/layer (e.g. "backend", "frontend")
 * @param {string} level   - Log level: "info", "warn", "error", "debug"
 * @param {string} pkg     - Package or module name (e.g. "middleware", "scheduler")
 * @param {string} message - Human-readable log message
 * @returns {object|undefined} The response data from the logging service
 */
async function Log(stack, level, pkg, message) {
  // Also print locally for easy debugging
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level.toUpperCase()}] [${pkg}] ${message}`);

  try {
    const res = await axios.post(
      LOG_URL,
      { stack, level, package: pkg, message },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );
    console.log(`  ↳ [LOG SUCCESS] logID: ${res.data.logID}`);
    return res.data;
  } catch (err) {
    console.error(`  ↳ [LOG ERROR] ${err.message}`);
  }
}

module.exports = { Log, TOKEN };
