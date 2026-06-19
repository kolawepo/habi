import { GoogleAuth } from "google-auth-library";
import fs from "fs";

const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
const projectId = sa.project_id;
const auth = new GoogleAuth({ credentials: sa, scopes: ["https://www.googleapis.com/auth/cloud-platform"] });
const client = await auth.getClient();
const token = (await client.getAccessToken()).token;

const rulesContent = fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");

async function api(path, method, body) {
  const res = await fetch(`https://firebaserules.googleapis.com/v1/${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// 1. Create a new ruleset with our rules content
const created = await api(`projects/${projectId}/rulesets`, "POST", {
  source: { files: [{ name: "firestore.rules", content: rulesContent }] },
});
console.log("Created ruleset:", created.name);

// 2. Point the cloud.firestore release at the new ruleset
const updated = await api(
  `projects/${projectId}/releases/cloud.firestore`,
  "PATCH",
  { release: { name: `projects/${projectId}/releases/cloud.firestore`, rulesetName: created.name } }
);
console.log("Release updated:", JSON.stringify(updated, null, 2));
