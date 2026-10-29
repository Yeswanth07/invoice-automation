#!/usr/bin/env node
// One-time setup for the invoice automation.
// Runs inside the n8n image (see docker-compose.yml) before n8n starts:
//   1. creates the 4 Google credentials with the shared OAuth client filled in
//   2. links every node in the workflow to those credentials
//   3. imports the workflow (inactive, ready to configure)
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const N8N_DIR = '/home/node/.n8n';
const MARKER = path.join(N8N_DIR, '.invoice-setup-done');
const WORKFLOW_DIR = process.env.WORKFLOW_DIR || '/workflow';
const TMP_DIR = '/tmp/invoice-setup';
const FORCE = String(process.env.FORCE_SETUP).toLowerCase() === 'true';

// Fixed IDs so the workflow nodes can be linked to the credentials automatically.
const CREDENTIALS = [
  { type: 'googleSheetsOAuth2Api', id: 'invGoogleSheets1', name: 'Google Sheets account' },
  { type: 'googleDriveOAuth2Api', id: 'invGoogleDrive01', name: 'Google Drive account' },
  { type: 'googleDocsOAuth2Api', id: 'invGoogleDocs001', name: 'Google Docs account' },
  { type: 'gmailOAuth2', id: 'invGmail00000001', name: 'Gmail account' },
];
const WORKFLOW_ID = 'invoiceWorkflow1';

const log = (msg) => console.log(`[setup] ${msg}`);
const fail = (msg) => {
  console.error(`[setup] ERROR: ${msg}`);
  process.exit(1);
};

// ---- Already done? ---------------------------------------------------------
if (fs.existsSync(MARKER) && !FORCE) {
  log('Already set up - nothing to do. (Set FORCE_SETUP=true in .env to re-import.)');
  process.exit(0);
}
if (FORCE) log('FORCE_SETUP=true - re-importing workflow and credentials.');

// ---- Check .env values -----------------------------------------------------
const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim();
const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
if (!clientId || clientId.startsWith('PASTE_')) fail('GOOGLE_CLIENT_ID is not set in .env');
if (!clientSecret || clientSecret.startsWith('PASTE_')) fail('GOOGLE_CLIENT_SECRET is not set in .env');

// ---- Load the workflow export ---------------------------------------------
if (!fs.existsSync(WORKFLOW_DIR)) fail(`Workflow folder not found: ${WORKFLOW_DIR}`);
const files = fs.readdirSync(WORKFLOW_DIR).filter((f) => f.toLowerCase().endsWith('.json'));
if (files.length !== 1) {
  fail(`Expected exactly one .json file in the workflow/ folder, found ${files.length}: ${files.join(', ') || 'none'}`);
}

let workflow;
try {
  workflow = JSON.parse(fs.readFileSync(path.join(WORKFLOW_DIR, files[0]), 'utf8'));
} catch (e) {
  fail(`Could not read ${files[0]}: ${e.message}`);
}
if (!workflow || !Array.isArray(workflow.nodes)) fail(`${files[0]} does not look like an n8n workflow export`);

// ---- Link nodes to the fixed credential IDs -------------------------------
const byType = Object.fromEntries(CREDENTIALS.map((c) => [c.type, c]));
let linked = 0;
for (const node of workflow.nodes) {
  if (!node.credentials) continue;
  for (const type of Object.keys(node.credentials)) {
    const cred = byType[type];
    if (cred) {
      node.credentials[type] = { id: cred.id, name: cred.name };
      linked++;
    } else {
      log(`Note: node "${node.name}" uses a "${type}" credential that is not created automatically.`);
    }
  }
}

workflow.id = WORKFLOW_ID;
workflow.active = false; // published by the user after signing in to Google
delete workflow.tags;
delete workflow.shared;
delete workflow.activeVersionId;

// ---- Write temp files and import ------------------------------------------
fs.mkdirSync(TMP_DIR, { recursive: true });
const credFile = path.join(TMP_DIR, 'credentials.json');
const wfFile = path.join(TMP_DIR, 'workflow.json');

fs.writeFileSync(
  credFile,
  JSON.stringify(
    CREDENTIALS.map((c) => ({ id: c.id, name: c.name, type: c.type, data: { clientId, clientSecret } })),
    null,
    2,
  ),
);
fs.writeFileSync(wfFile, JSON.stringify(workflow, null, 2));

const run = (args) => execFileSync('n8n', args, { stdio: 'inherit' });

try {
  log('Importing Google credentials...');
  run(['import:credentials', `--input=${credFile}`]);
  log(`Importing workflow "${workflow.name || files[0]}"...`);
  run(['import:workflow', `--input=${wfFile}`]);
} catch (e) {
  fail(`Import failed: ${e.message}`);
} finally {
  fs.rmSync(TMP_DIR, { recursive: true, force: true }); // don't leave the client secret lying around
}

fs.writeFileSync(MARKER, `Set up on ${new Date().toISOString()}\n`);
log(`Done. ${CREDENTIALS.length} credentials created, ${linked} node credential links set.`);
log('Open http://localhost:5678 and follow the README from "First launch".');
