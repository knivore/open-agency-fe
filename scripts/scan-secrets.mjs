import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const ignoredDirNames = new Set([
  '.git',
  '.next',
  '.venv',
  '__pycache__',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'test-results',
  'venv',
]);
const localEnvFiles = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.test',
];
const maxFileBytes = 1_000_000;
const allowMarker = 'secret-scan: allow';
const placeholderValuePattern =
  /^(?:change-me|example|example-value|fake|dummy|test|sample|replace(?:-me)?(?:-.+)?|your-.+|none|null|localhost|127\.0\.0\.1)$/i;
const secretPatterns = [
  { name: 'private-key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  {
    name: 'github-pat',
    pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  { name: 'openai-key', pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: 'aws-access-key', pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/ },
  { name: 'google-api-key', pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { name: 'slack-token', pattern: /\bxox(?:a|b|p|r|s)-[0-9A-Za-z-]{10,}\b/ },
  { name: 'stripe-live-key', pattern: /\bsk_live_[0-9A-Za-z]{16,}\b/ },
  {
    name: 'suspicious-env-assignment',
    pattern:
      /\b([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API[_-]?KEY)[A-Z0-9_]*)\s*=\s*([^\s#]+)/i,
    envOnly: true,
  },
];

function gitCandidatePaths() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: repoRoot,
      encoding: 'utf-8',
    }
  );
  return output.split('\0').filter(Boolean);
}

function localSecretPaths() {
  return localEnvFiles.filter((file) => {
    try {
      return statSync(path.join(repoRoot, file)).isFile();
    } catch {
      return false;
    }
  });
}

function shouldIgnore(relativePath) {
  const parts = relativePath.split(path.sep);
  return parts.slice(0, -1).some((part) => ignoredDirNames.has(part));
}

function looksLikeEnvFile(relativePath) {
  const name = path.basename(relativePath).toLowerCase();
  return name === '.env' || name.startsWith('.env.');
}

function isPlaceholderValue(value) {
  const cleaned = value.replace(/^['"]|['"]$/g, '');
  return !cleaned || placeholderValuePattern.test(cleaned);
}

function isBinary(buffer) {
  return buffer.includes(0);
}

function scanText(relativePath, text) {
  const isEnvFile = looksLikeEnvFile(relativePath);
  const findings = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.includes(allowMarker)) {
      continue;
    }
    for (const secretPattern of secretPatterns) {
      if (secretPattern.envOnly && !isEnvFile) {
        continue;
      }
      const match = secretPattern.pattern.exec(line);
      if (!match) {
        continue;
      }
      if (
        secretPattern.name === 'suspicious-env-assignment' &&
        isPlaceholderValue(match[2])
      ) {
        continue;
      }
      findings.push({
        path: relativePath,
        lineNumber: index + 1,
        rule: secretPattern.name,
        snippet: line.trim(),
      });
      break;
    }
  }
  return findings;
}

function scanRepo() {
  const candidatePaths = new Set([
    ...gitCandidatePaths(),
    ...localSecretPaths(),
  ]);
  const findings = [];
  for (const relativePath of [...candidatePaths].sort()) {
    if (shouldIgnore(relativePath)) {
      continue;
    }
    const absolutePath = path.join(repoRoot, relativePath);
    let stat;
    try {
      stat = statSync(absolutePath);
    } catch {
      continue;
    }
    if (!stat.isFile() || stat.size > maxFileBytes) {
      continue;
    }
    const buffer = readFileSync(absolutePath);
    if (isBinary(buffer)) {
      continue;
    }
    findings.push(...scanText(relativePath, buffer.toString('utf-8')));
  }
  return findings;
}

const findings = scanRepo();
if (!findings.length) {
  console.log(`secret-scan: no high-signal secrets found in ${repoRoot}`);
  process.exit(0);
}

console.error(
  `secret-scan: found ${findings.length} potential secret(s) in ${repoRoot}`
);
for (const finding of findings) {
  console.error(
    `${finding.path}:${finding.lineNumber}: [${finding.rule}] ${finding.snippet}`
  );
}
process.exit(1);
