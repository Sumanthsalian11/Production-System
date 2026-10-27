const fs = require("fs");

module.exports = function buildLdapTlsOptions(url) {
  if (!String(url || "").toLowerCase().startsWith("ldaps://")) return undefined;

  const options = {
    rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== "false",
  };
  if (process.env.LDAP_CA_FILE) {
    options.ca = [fs.readFileSync(process.env.LDAP_CA_FILE)];
  }
  return options;
};