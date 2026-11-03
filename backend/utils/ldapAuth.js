const ldap = require("ldapjs");
const buildLdapTlsOptions = require("../config/ldapTls");

// Tried in this order until one accepts the credentials
function getDomains() {
  return [
    { key: "GROUP", url: process.env.LDAP_GROUP_URL || process.env.LDAP_URL, netbios: process.env.LDAP_GROUP_NETBIOS || "MPLGROUP" },
    { key: "MCT", url: process.env.LDAP_MCT_URL, upn: process.env.LDAP_MCT_DOMAIN },
    { key: "VDP", url: process.env.LDAP_VDP_URL, upn: process.env.LDAP_VDP_DOMAIN },
  ].filter((d) => d.url && (d.netbios || d.upn));
}

// "MPLGROUP\john" -> "john", "john@x.com" -> "john", "john" -> "john"
function extractUserName(username) {
  let clean = String(username || "").trim();
  if (clean.includes("\\")) clean = clean.split("\\").pop();
  if (clean.includes("@")) clean = clean.split("@")[0];
  return clean.trim();
}

function bindOnce(url, bindUser, password) {
  return new Promise((resolve, reject) => {
    const client = ldap.createClient({
      url,
      timeout: 5000,
      connectTimeout: 5000,
      tlsOptions: buildLdapTlsOptions(url),
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

async function verifyLDAPUser(username, password) {
  // empty password would act as an anonymous bind and "succeed"
  if (!password) {
    const e = new Error("Password is required");
    e.name = "InvalidCredentialsError";
    throw e;
  }

  const sam = extractUserName(username);
  if (!sam) throw new Error("Username is required");

  const domains = getDomains();
  if (domains.length === 0) throw new Error("No LDAP domains are configured");

  let connectionError = null;

  for (const d of domains) {
    const bindUser = d.netbios ? `${d.netbios}\\${sam}` : `${sam}@${d.upn}`;
    try {
      await bindOnce(d.url, bindUser, password);
      return true; // authenticated in this domain
    } catch (err) {
      if (err.name === "InvalidCredentialsError") continue; // try the next domain
      console.warn(`LDAP ${d.key} unavailable:`, err.name, err.message);
      connectionError = err;
    }
  }

  // a domain couldn't be reached, so we can't be sure the credentials are wrong
  if (connectionError) throw connectionError;

  const e = new Error("Invalid credentials");
  e.name = "InvalidCredentialsError";
  throw e;
}

module.exports = { verifyLDAPUser };