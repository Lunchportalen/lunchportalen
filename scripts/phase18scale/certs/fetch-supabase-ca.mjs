#!/usr/bin/env node
/**
 * Capture Supabase Root 2021 CA (+ intermediate) from the official pooler TLS chain.
 * Writes PEM files used for verified Node pg connections (rejectUnauthorized: true).
 */
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import tls from "node:tls";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const host = process.env.PHASE18_DB_POOLER_HOST || "aws-0-eu-west-1.pooler.supabase.com";

function toPem(raw) {
  const b64 = raw.toString("base64");
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----\n`;
}

await new Promise((resolve, reject) => {
  const sock = net.connect({ host, port: 5432 }, () => {
    const sslRequest = Buffer.alloc(8);
    sslRequest.writeInt32BE(8, 0);
    sslRequest.writeInt32BE(80877103, 4);
    sock.write(sslRequest);
  });
  sock.once("data", (buf) => {
    if (buf.toString("utf8")[0] !== "S") {
      reject(new Error("POOLER_SSL_NOT_SUPPORTED"));
      return;
    }
    const ts = tls.connect({ socket: sock, servername: host, rejectUnauthorized: false }, () => {
      const leaf = ts.getPeerCertificate(true);
      const certs = [];
      let c = leaf;
      let guard = 0;
      while (c?.raw && guard++ < 12) {
        certs.push(c);
        if (!c.issuerCertificate || c.issuerCertificate === c) break;
        c = c.issuerCertificate;
      }
      const root = certs[certs.length - 1];
      const intermediate = certs.find((x) => String(x.subject?.CN || "").includes("Intermediate"));
      if (!root?.raw || String(root.subject?.CN || "") !== "Supabase Root 2021 CA") {
        reject(new Error(`UNEXPECTED_ROOT_CA: ${root?.subject?.CN || "missing"}`));
        return;
      }
      const rootPem = toPem(root.raw);
      const interPem = intermediate?.raw ? toPem(intermediate.raw) : "";
      fs.writeFileSync(path.join(__dirname, "supabase-prod-ca-2021.crt"), rootPem);
      fs.writeFileSync(path.join(__dirname, "supabase-pooler-ca-bundle.crt"), `${interPem}${rootPem}`);
      console.log(
        JSON.stringify(
          {
            host,
            root_cn: root.subject.CN,
            root_fingerprint256: root.fingerprint256,
            intermediate_cn: intermediate?.subject?.CN || null,
            root_path: "scripts/phase18scale/certs/supabase-prod-ca-2021.crt",
            bundle_path: "scripts/phase18scale/certs/supabase-pooler-ca-bundle.crt",
          },
          null,
          2,
        ),
      );
      ts.end();
      resolve();
    });
    ts.on("error", reject);
  });
  sock.on("error", reject);
});
