
module.exports = function buildLdapTlsOptions(url) {
  if (!String(url || "").toLowerCase().startsWith("ldaps://")) return undefined;

  return {
    rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== "false",
  };
};
