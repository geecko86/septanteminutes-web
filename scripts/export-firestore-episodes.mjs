#!/usr/bin/env node
// Exports the Firestore "episodes" collection to public/js/data.json.
// Replaces the abandoned node-firestore-import-export CLI, which no longer
// works against the current Firestore API (pagination bug).
//
// Auth: pass a service account JSON path as the first argument, or set
// GOOGLE_APPLICATION_CREDENTIALS.

import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const credentialPath = process.argv[2];

initializeApp({
  credential: credentialPath ? cert(credentialPath) : applicationDefault(),
});

const db = getFirestore();
const snapshot = await db.collection("episodes").get();

const episodes = {};
for (const doc of snapshot.docs) {
  episodes[doc.id] = { ...doc.data(), __collections__: {} };
}

const outPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "js",
  "data.json",
);

await writeFile(outPath, JSON.stringify({ episodes }));
console.log(`Wrote ${Object.keys(episodes).length} episodes to ${outPath}`);
