#!/usr/bin/env node
// Checks that every external URL and every package coordinate in the site's
// content resolves: Maven Central artifacts, npm and PyPI packages, crates,
// and Docker images (pulled anonymously, the way a reader would).
//
//   node scripts/check-links.mjs --all              every file in scope
//   node scripts/check-links.mjs --changed <ref>    what a branch adds since <ref>
//   node scripts/check-links.mjs <file> [<file>...] just these files
//
// --changed checks the links and coordinates that appear on lines the branch
// adds, in files it adds or modifies, so a PR is never failed for a link it
// did not touch. The weekly --all run covers everything else.
//
// Exit 1 when something definitely does not resolve (404, 410, unknown host,
// missing artifact or version, image that refuses an anonymous pull).
// Timeouts, 429s, 5xx and bot walls are printed as warnings and do not fail
// the run, because they say nothing about whether the link is right.
// Zero dependencies; needs Node 20+.

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

// ── Per-repo config ─────────────────────────────────────────────────────────
const CONFIG = {
  // Directories and files whose content is checked.
  roots: ['src', 'adk/src', 'public/llms.txt', 'README.md'],
  extensions: ['.md', '.mdx', '.astro', '.txt', '.ts', '.js', '.mjs', '.json', '.yml', '.yaml'],
  skipPaths: [/\/node_modules\//, /^src\/gate\/golden\//, /package(-lock)?\.json$/],
  // This site's own origin. A page added in the same PR is not live yet, so
  // failures here are warnings.
  ownHosts: ['jamjet.dev', 'www.jamjet.dev'],
};

// Hosts that refuse or throttle automated requests. A failure from one of
// these is a warning, never a hard error.
const FLAKY_HOSTS = [
  'npmjs.com', 'www.npmjs.com', 'linkedin.com', 'www.linkedin.com', 'x.com', 'twitter.com',
  'medium.com', 'www.reddit.com', 'reddit.com', 'openai.com', 'platform.openai.com',
  'www.anthropic.com', 'anthropic.com', 'docs.anthropic.com', 'stackoverflow.com',
  'www.mckinsey.com', 'www.gartner.com', 'gartner.com', 'www.forbes.com', 'www.bloomberg.com',
  'www.wsj.com', 'www.ft.com', 'www.reuters.com', 'dev.to', 'news.ycombinator.com',
  'marketplace.visualstudio.com', 'www.youtube.com', 'youtube.com', 'discord.com',
  'central.sonatype.com', 'search.maven.org', 'mvnrepository.com', 'www.mvnrepository.com',
  'console.cloud.google.com', 'portal.azure.com', 'console.aws.amazon.com', 'app.jamjet.dev',
  'web.archive.org', 'arxiv.org', 'www.sec.gov', 'sec.gov', 'www.investopedia.com',
];

// URLs that are placeholders, local endpoints or API routes shown in examples.
const SKIP_URL = [
  /[{}<>$`\\]|%7B|%7D/i, /\.\.\.|…/, /\blocalhost\b|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|host\.docker\.internal/,
  /\bexample\.(com|org|net)\b|\.example\b|\.local\b|\.internal\b|\.test\b/,
  /your[-_]|YOUR_|<your|xxx|\/path\/to\//i,
  /^https?:\/\/(api|ingest|otel)\.jamjet\.dev\b/, // API endpoints: method and auth vary
  /^https?:\/\/[^/]*\.svc\b/, /^https?:\/\/schemas?\./, /w3\.org\/2000\/svg|w3\.org\/1999\/xlink/,
  /^https?:\/\/fonts\.(googleapis|gstatic)\.com\/?$/,
];

// ── CLI ─────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
let files;
let addedText; // --changed only: file -> the decoded text of its added lines
if (args[0] === '--all') files = walk(CONFIG.roots);
else if (args[0] === '--changed') {
  const ref = args[1] || 'origin/main';
  const out = execFileSync('git', ['diff', '--name-only', '--diff-filter=AMR', `${ref}...HEAD`], { encoding: 'utf8' });
  files = out.split('\n').filter(Boolean).filter(inScope);
  addedText = new Map();
  for (const f of files) {
    const diff = execFileSync('git', ['diff', '-U0', `${ref}...HEAD`, '--', f], { encoding: 'utf8', maxBuffer: 64 << 20 });
    const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
    addedText.set(f, decode(added.join('\n')));
  }
} else if (args.length) files = args.filter((f) => existsSync(f));
else {
  console.error('usage: check-links.mjs --all | --changed <ref> | <file>...');
  process.exit(2);
}

function inScope(f) {
  if (!existsSync(f)) return false;
  if (CONFIG.skipPaths.some((re) => re.test(f) || re.test('/' + f))) return false;
  if (!CONFIG.extensions.includes(extname(f))) return false;
  return CONFIG.roots.some((r) => f === r || f.startsWith(r.replace(/\/$/, '') + '/'));
}

function walk(roots) {
  const out = [];
  const visit = (p) => {
    if (!existsSync(p)) return;
    if (statSync(p).isDirectory()) {
      if (p.endsWith('node_modules') || p.endsWith('.git')) return;
      for (const e of readdirSync(p)) visit(join(p, e));
    } else if (inScope(p)) out.push(p);
  };
  roots.forEach(visit);
  return out;
}

// ── Extraction ──────────────────────────────────────────────────────────────
function decode(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&');
}

function extract(file) {
  const raw = readFileSync(file, 'utf8');
  // Collapse shell line continuations and strip simple inline markup so a
  // snippet split across lines or across <span>s still reads as one command.
  const text = decode(raw).replace(/\\\r?\n\s*/g, ' ');
  const plain = text.replace(/<\/?span[^>]*>/g, '');
  const found = [];
  const add = (kind, id, extra = {}) => found.push({ kind, id, file, ...extra });

  for (const m of raw.matchAll(/https?:\/\/[^\s<>"'`)\]}|\\]+/g)) {
    let url = decode(m[0]).replace(/[.,;:!?*]+$/, '');
    if (SKIP_URL.some((re) => re.test(url))) continue;
    add('url', url);
  }

  // Maven XML: <groupId>g</groupId> <artifactId>a</artifactId> [<version>v</version>]
  for (const m of plain.matchAll(/<groupId>\s*([\w.-]+)\s*<\/groupId>\s*<artifactId>\s*([\w.-]+)\s*<\/artifactId>(?:\s*<version>\s*([^<\s]+)\s*<\/version>)?/g)) {
    const [, g, a, v] = m;
    add('maven', `${g}:${a}${v && !v.includes('$') ? ':' + v : ''}`);
  }
  // Gradle: implementation("g:a:v") / implementation 'g:a:v'
  for (const m of plain.matchAll(/\b(?:implementation|api|compileOnly|runtimeOnly|testImplementation|testRuntimeOnly|annotationProcessor|kapt|ksp)\s*\(?\s*\(?["']([\w.-]+):([\w.-]+)(?::([\w.+-]+))?["']/g)) {
    const [, g, a, v] = m;
    add('maven', `${g}:${a}${v ? ':' + v : ''}`);
  }

  // Install and run commands only count inside code: fenced blocks, inline
  // code, <code>/<pre>, or a quoted string that starts with the command. Prose
  // such as "pip install gives you" is not a command.
  const segments = [
    ...plain.matchAll(/```[^\n]*\n([\s\S]*?)```/g),
    ...plain.matchAll(/<(?:code|pre)\b[^>]*>([\s\S]*?)<\/(?:code|pre)>/g),
    ...plain.replace(/```[\s\S]*?```/g, '').matchAll(/`([^`\n]+)`/g),
    ...plain.matchAll(/(['"])((?:npm|npx|pnpm|yarn|bun|bunx|pip3?|pipx|uv|poetry|cargo|docker)\s[^'"\n]*)\1/g),
  ].map((m) => m[m.length - 1]);
  for (const line of segments.join('\n').split('\n')) {
    // npm / npx / pnpm / yarn
    for (const m of line.matchAll(/\b(?:npm\s+(?:i|install|add)|pnpm\s+(?:add|i|install)|yarn\s+add|npx|bunx|bun\s+add)\b((?:\s+[^\s|&;#)]+)+)/g)) {
      for (const tok of m[1].trim().split(/\s+/)) {
        if (tok.startsWith('-')) continue;
        if (!/^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*(@[\w.^~<>=*-]+)?$/i.test(tok)) break; // npx runs args after the package
        const at = tok.lastIndexOf('@');
        const name = at > 0 ? tok.slice(0, at) : tok;
        const ver = at > 0 ? tok.slice(at + 1) : '';
        add('npm', name, { version: /^\d+\.\d+\.\d+(-[\w.]+)?$/.test(ver) ? ver : '' });
        if (/\bnpx|bunx/.test(m[0])) break;
      }
    }
    // pip / uv / pipx
    for (const m of line.matchAll(/\b(?:pip3?\s+install|uv\s+(?:add|pip\s+install)|pipx\s+install|poetry\s+add)\b((?:\s+[^\s|&;#)]+)+)/g)) {
      let skipNext = false;
      for (let tok of m[1].trim().split(/\s+/)) {
        tok = tok.replace(/^["']|["']$/g, '');
        if (/^-(r|c|e)$|^--(requirement|constraint|editable|index-url|extra-index-url|find-links)$/.test(tok)) { skipNext = true; continue; }
        if (skipNext) { skipNext = false; continue; }
        if (tok.startsWith('-') || tok.startsWith('.') || tok.includes('/') || tok.includes('$')) continue;
        const mm = tok.match(/^([A-Za-z0-9][\w.-]*)(\[[^\]]*\])?(?:==([\w.+-]+)|[<>=!~].*)?$/);
        if (!mm) break;
        add('pypi', mm[1].toLowerCase(), { version: mm[3] || '' });
      }
    }
    // cargo
    for (const m of line.matchAll(/\bcargo\s+(?:add|install)\s+((?:[^\s|&;#)]+\s*)+)/g)) {
      for (const tok of m[1].trim().split(/\s+/)) {
        if (tok.startsWith('-')) continue;
        const [name, ver = ''] = tok.split('@');
        if (!/^[a-z0-9][\w-]*$/i.test(name)) break;
        add('crate', name, { version: ver });
      }
    }
    // docker run / pull
    const dm = line.match(/\bdocker\s+(?:run|pull|create)\s+(.*)$/);
    if (dm) {
      const toks = dm[1].trim().split(/\s+/);
      const withValue = new Set(['-p', '--publish', '-e', '--env', '-v', '--volume', '--name', '--platform', '--network', '--net', '-w', '--workdir', '--env-file', '--entrypoint', '-u', '--user', '--mount', '-l', '--label', '--add-host', '--restart', '--cpus', '-m', '--memory', '-h', '--hostname', '--pull', '--cidfile', '--log-driver', '--health-cmd']);
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t.startsWith('-')) { if (withValue.has(t)) i++; continue; }
        if (/^[a-z0-9][\w./-]*(:[\w.-]+)?(@sha256:[a-f0-9]+)?$/i.test(t) && !t.includes('$')) add('docker', t);
        break;
      }
    }
    // compose / k8s style: image: repo[:tag]
    const im = line.match(/^\s*-?\s*image:\s*["']?([a-z0-9][\w./-]*(?::[\w.-]+)?)["']?\s*$/i);
    if (im && !im[1].includes('$')) add('docker', im[1]);
  }
  return found;
}

// ── Checks ──────────────────────────────────────────────────────────────────
const UA = 'jamjet-link-check/1.0 (+https://github.com/jamjet-labs)';
const TIMEOUT = 15000;
const PASS = { status: 'ok' };
const fail = (detail) => ({ status: 'fail', detail });
const warn = (detail) => ({ status: 'warn', detail });

async function request(url, opts = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT), ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
      if ((res.status === 429 || res.status >= 500) && attempt < 2) {
        last = res;
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err) {
      last = err;
      const code = err.cause?.code || '';
      if (code === 'ENOTFOUND' || code === 'EAI_NONAME') throw err;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  if (last instanceof Error) throw last;
  return last;
}

// Registry web pages are client-rendered or bot-walled; ask the registry API.
function registryPage(url) {
  let m;
  if ((m = url.match(/^https:\/\/(?:discord\.gg|discord\.com\/invite)\/([\w-]+)\/?$/))) return checkDiscordInvite(m[1]);
  if ((m = url.match(/^https:\/\/crates\.io\/crates\/([\w-]+)(?:\/(\d[\w.+-]*))?\/?$/))) return checkCrate(m[1], m[2] || '');
  if ((m = url.match(/^https:\/\/(?:www\.)?npmjs\.com\/package\/((?:@[\w.-]+\/)?[\w.-]+)(?:\/v\/([\w.+-]+))?\/?$/))) return checkNpm(m[1], m[2] || '');
  if ((m = url.match(/^https:\/\/pypi\.org\/project\/([\w.-]+)(?:\/([\w.+-]+))?\/?$/))) return checkPypi(m[1].toLowerCase(), m[2] || '');
  if ((m = url.match(/^https:\/\/central\.sonatype\.com\/artifact\/([\w.-]+)\/([\w.-]+)(?:\/([\w.+-]+))?\/?$/))) return checkMaven(`${m[1]}:${m[2]}${m[3] ? ':' + m[3] : ''}`);
  return null;
}

// discord.gg answers 200 for an unknown invite; the invite API does not.
async function checkDiscordInvite(code) {
  try {
    const res = await request(`https://discord.com/api/v9/invites/${code}`);
    if (res.ok) return PASS;
    if (res.status === 404) return fail(`Discord invite ${code} is unknown or expired`);
    return warn(`Discord API HTTP ${res.status}`);
  } catch (err) {
    return warn(err.cause?.code || err.message);
  }
}

async function checkUrl(url) {
  const viaApi = registryPage(url);
  if (viaApi) return viaApi;
  const host = new URL(url).hostname;
  const soft = FLAKY_HOSTS.some((h) => host === h || host.endsWith('.' + h)) || CONFIG.ownHosts.includes(host);
  let res;
  try {
    res = await request(url, { method: 'HEAD' });
    if ([403, 404, 405, 406, 501].includes(res.status) || res.status >= 500) res = await request(url, { method: 'GET' });
  } catch (err) {
    const code = err.cause?.code || err.name;
    if ((code === 'ENOTFOUND' || code === 'EAI_NONAME') && !soft) return fail(`unknown host ${host}`);
    return warn(`${code || err.message}`);
  }
  const s = res.status;
  if (s < 400 || s === 401 || s === 405) return PASS; // 401/405: the route exists, it wants auth or another method
  if (soft) return warn(`HTTP ${s}`);
  if (s === 404 || s === 410) return fail(`HTTP ${s}`);
  return warn(`HTTP ${s}`);
}

async function json(url, headers = {}) {
  const res = await request(url, { headers: { Accept: 'application/json', ...headers } });
  return { res, body: res.ok ? await res.json() : null };
}

async function checkMaven(coord) {
  const [g, a, v] = coord.split(':');
  const base = `https://repo1.maven.org/maven2/${g.replace(/\./g, '/')}/${a}`;
  const url = v ? `${base}/${v}/${a}-${v}.pom` : `${base}/maven-metadata.xml`;
  try {
    const res = await request(url, { method: 'HEAD' });
    if (res.ok) return PASS;
    if (res.status === 404) return fail(v ? `${a} ${v} is not on Maven Central` : `${g}:${a} is not on Maven Central`);
    return warn(`Maven Central HTTP ${res.status}`);
  } catch (err) {
    return warn(err.cause?.code || err.message);
  }
}

async function checkNpm(name, version) {
  try {
    const { res, body } = await json(`https://registry.npmjs.org/${name.replace('/', '%2f')}`);
    if (res.status === 404) return fail(`${name} is not on npm`);
    if (!body) return warn(`npm HTTP ${res.status}`);
    if (version && !body.versions?.[version]) return fail(`${name}@${version} is not on npm (latest ${body['dist-tags']?.latest})`);
    return PASS;
  } catch (err) {
    return warn(err.cause?.code || err.message);
  }
}

async function checkPypi(name, version) {
  try {
    const { res, body } = await json(`https://pypi.org/pypi/${name}/json`);
    if (res.status === 404) return fail(`${name} is not on PyPI`);
    if (!body) return warn(`PyPI HTTP ${res.status}`);
    if (version && !body.releases?.[version]) return fail(`${name}==${version} is not on PyPI (latest ${body.info?.version})`);
    return PASS;
  } catch (err) {
    return warn(err.cause?.code || err.message);
  }
}

async function checkCrate(name, version) {
  try {
    const { res, body } = await json(`https://crates.io/api/v1/crates/${name}`);
    if (res.status === 404) return fail(`${name} is not on crates.io`);
    if (!body) return warn(`crates.io HTTP ${res.status}`);
    if (version && !body.versions?.some((x) => x.num === version)) return fail(`${name}@${version} is not on crates.io`);
    return PASS;
  } catch (err) {
    return warn(err.cause?.code || err.message);
  }
}

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

async function checkDocker(ref) {
  let [repo, tag = 'latest'] = ref.split('@')[0].split(/:(?=[^/]*$)/);
  let registry = 'registry-1.docker.io';
  const first = repo.split('/')[0];
  if (repo.includes('/') && (first.includes('.') || first.includes(':'))) {
    registry = first;
    repo = repo.slice(first.length + 1);
  } else if (!repo.includes('/')) repo = `library/${repo}`;
  try {
    let token;
    if (registry === 'registry-1.docker.io') {
      const { body } = await json(`https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`);
      token = body?.token;
    } else if (registry === 'ghcr.io') {
      const r = await request(`https://ghcr.io/token?scope=repository:${repo}:pull`);
      if (r.status === 401 || r.status === 403) return fail(`ghcr.io/${repo} refuses anonymous pulls`);
      token = (await r.json()).token;
    }
    const res = await request(`https://${registry}/v2/${repo}/manifests/${tag}`, {
      method: 'HEAD',
      headers: { Accept: MANIFEST_ACCEPT, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.ok) return PASS;
    if (res.status === 401 || res.status === 403) return fail(`${ref} refuses anonymous pulls`);
    if (res.status === 404) return fail(`${ref} not found`);
    return warn(`registry HTTP ${res.status}`);
  } catch (err) {
    return warn(err.cause?.code || err.message);
  }
}

// ── Run ─────────────────────────────────────────────────────────────────────
const touched = (it) => {
  const text = addedText.get(it.file) || '';
  if (it.kind === 'maven') return it.id.split(':').slice(1).some((t) => text.includes(t));
  if (it.kind === 'docker') return text.includes(it.id.split(':')[0]);
  return text.includes(it.id);
};
const items = files.flatMap(extract).filter((it) => !addedText || touched(it));
const unique = new Map();
for (const it of items) {
  const key = `${it.kind} ${it.id}${it.version ? '@' + it.version : ''}`;
  if (!unique.has(key)) unique.set(key, { ...it, files: new Set() });
  unique.get(key).files.add(it.file);
}

const check = (it) => {
  switch (it.kind) {
    case 'url': return checkUrl(it.id);
    case 'maven': return checkMaven(it.id);
    case 'npm': return checkNpm(it.id, it.version);
    case 'pypi': return checkPypi(it.id, it.version);
    case 'crate': return checkCrate(it.id, it.version);
    case 'docker': return checkDocker(it.id);
  }
};

const queue = [...unique.entries()];
const results = [];
const CONCURRENCY = 8;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const [key, it] = queue.shift();
      // Hard cap per item so one slow host cannot stall the run.
      const cap = new Promise((r) => setTimeout(() => r(warn('gave up after 90s')), 90_000).unref());
      results.push({ key, it, r: await Promise.race([check(it), cap]) });
    }
  }),
);

const counts = { url: 0, maven: 0, npm: 0, pypi: 0, crate: 0, docker: 0 };
for (const { it } of results) counts[it.kind]++;
const failures = results.filter((x) => x.r.status === 'fail');
const warnings = results.filter((x) => x.r.status === 'warn');
const where = (it) => [...it.files].join(', ');

for (const { key, it, r } of warnings.sort((a, b) => a.key.localeCompare(b.key))) console.log(`warn  ${key}  (${r.detail})  in ${where(it)}`);
for (const { key, it, r } of failures.sort((a, b) => a.key.localeCompare(b.key))) console.log(`FAIL  ${key}  (${r.detail})  in ${where(it)}`);

console.log(
  `\n${addedText ? 'Lines added in ' : 'Checked '}${files.length} files: ${counts.url} URLs, ${counts.maven} Maven, ${counts.npm} npm, ${counts.pypi} PyPI, ` +
    `${counts.crate} crates, ${counts.docker} Docker images. ${failures.length} failed, ${warnings.length} warnings.`,
);
if (failures.length) process.exit(1);
