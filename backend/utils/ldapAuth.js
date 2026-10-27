const ldap = require("ldapjs");
const buildLdapTlsOptions = require("../config/ldapTls");

function buildLdapUserName(username) {
  const clean = String(username || "").trim();
  if (!clean) throw new Error("Username is required");
  return clean.includes("@") ? clean : `${clean}@${process.env.LDAP_DOMAIN}`;
}

function verifyLDAPUser(username, password) {
  return new Promise((resolve, reject) => {
    const LDAP_URL = process.env.LDAP_URL;
    const LDAP_DOMAIN = process.env.LDAP_DOMAIN;

    if (!LDAP_URL || !LDAP_DOMAIN) {
      return reject(new Error("LDAP_URL and LDAP_DOMAIN must be configured"));
    }

    // empty password would act as an anonymous bind and "succeed"
    if (!password) {
      const e = new Error("Password is required");
      e.name = "InvalidCredentialsError";
      return reject(e);
    }

    let bindUser;
    try {
      bindUser = buildLdapUserName(username);
    } catch (e) {
      return reject(e);
    }

    const client = ldap.createClient({
      url: LDAP_URL,
      timeout: 5000,
      connectTimeout: 5000,
      tlsOptions: buildLdapTlsOptions(LDAP_URL),
    });

    let finished = false;
    const finish = (err) => {
      if (finished) return;
      finished = true;
      try { client.unbind(() => {}); } catch (_) {}
      err ? reject(err) : resolve(true);
    };

    client.on("error", finish); // prevents an unhandled error crashing the server
    client.bind(bindUser, password, (err) => finish(err));
  });
}

module.exports = { verifyLDAPUser };