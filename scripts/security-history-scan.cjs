// Read-only, redacted repository-history inspection for the security review.
// This is a targeted heuristic scan, not proof that all secrets are absent.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const git = (args, options = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
const history = git(['rev-list', '--objects', '--all']).trim().split('\n');
const files = history.map((line) => {
  const separator = line.indexOf(' ');
  return { id: line.slice(0, separator), name: line.slice(separator + 1) };
}).filter((file) => /\.(?:[cm]?[jt]sx?|json|md|log|ya?ml|toml|ini|txt|env|pem|key)$|(?:^|\/)\.env(?:\.[^/]*)?$|(?:^|\/)\.neon$/.test(file.name));
const signatures = [
  ['private-key', /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{32,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['aws-access-key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['credential-url', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s:@/'"`]+:([^\s@/'"`]{8,})@[^\s/'"`]+/],
  ['gmail-secret-assignment', /GMAIL_APP_PASSWORD\s*[=:]\s*["']?([A-Za-z]{4}(?: ?[A-Za-z]{4}){3})\b/],
  ['admin-plaintext-assignment', /ADMIN_PIN\s*[=:]\s*["']([^"'\r\n]+)["']/],
];
const hits = [];
let scanned = 0;
for (const file of files) {
  let content;
  try { content = git(['cat-file', 'blob', file.id], { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { continue; }
  if (content.includes('\0')) continue;
  scanned++;
  for (const [kind, pattern] of signatures) {
    if (pattern.test(content)) hits.push({ blob: file.id, file: file.name, kind });
  }
}
const workingTreeHits = [];
for (const name of git(['ls-files']).trim().split('\n')) {
  if (!/\.(?:[cm]?[jt]sx?|json|md|log|ya?ml|txt)$/.test(name)) continue;
  let content;
  try { content = fs.readFileSync(path.join(root, name), 'utf8'); } catch { continue; }
  for (const [kind, pattern] of signatures) if (pattern.test(content)) workingTreeHits.push({ file: name, kind });
}
const piiHistory = [];
const uniqueIdentities = new Set();
for (const commit of git(['log', '--all', '--format=%h', '--', '.participants_data.json']).trim().split(/\s+/)) {
  try {
    const records = JSON.parse(git(['show', `${commit}:.participants_data.json`], { stdio: ['ignore', 'pipe', 'ignore'] }));
    for (const record of records) uniqueIdentities.add(String(record.nimNip));
    piiHistory.push({ commit, recordCount: records.length, fields: [...new Set(records.flatMap((record) => Object.keys(record)))], tokenCount: records.filter((record) => record.qrToken).length });
  } catch { /* deleted snapshots */ }
}
const result = {
  sourceCommit: git(['rev-parse', 'HEAD']).trim(),
  commitCount: Number(git(['rev-list', '--count', '--all']).trim()),
  scannedTextBlobs: scanned,
  credentialPatternHits: hits,
  workingTreePatternHits: workingTreeHits,
  participantSnapshots: piiHistory,
  distinctHistoricalNims: uniqueIdentities.size,
  trackedSensitivePaths: git(['ls-files', '.env', '.env.local', '.participants_data.json', '.neon', 'dev26.log']).trim().split('\n').filter(Boolean),
  limitations: 'Pattern matches require manual classification. Values intentionally omitted. No remote/database queries; live token validity is unknown.',
};
console.log(JSON.stringify(result, null, 2));
