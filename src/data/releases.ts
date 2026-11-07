// Current release versions, shown on the homepage ship log and on /ship-log.
//
// Each version is read from its registry when the site is built, so a release
// shows up on the next deploy without editing this file. If a registry cannot
// be reached, the build logs a warning and uses `fallback`. Keep the fallbacks
// current when you cut a release; they are the only hand-maintained copy.

export type Release = {
  label: string;
  pkg: string;
  registry: 'crates.io' | 'PyPI' | 'npm' | 'Maven Central';
  href: string;
  fallback: string;
};

export const RELEASES: Release[] = [
  { label: 'Runtime', pkg: 'jamjet-core', registry: 'crates.io', href: 'https://crates.io/crates/jamjet-core', fallback: '0.5.0' },
  { label: 'Python SDK', pkg: 'jamjet', registry: 'PyPI', href: 'https://pypi.org/project/jamjet/', fallback: '0.12.0' },
  { label: 'JVM runtime', pkg: 'dev.jamjet:jamjet-runtime-core', registry: 'Maven Central', href: 'https://central.sonatype.com/artifact/dev.jamjet/jamjet-runtime-core', fallback: '0.4.0' },
  { label: 'MCP shim', pkg: '@jamjet/mcp-shim', registry: 'npm', href: 'https://www.npmjs.com/package/@jamjet/mcp-shim', fallback: '0.2.1' },
];

const TIMEOUT_MS = 8000;
const UA = 'jamjet.dev-build (+https://jamjet.dev)';
const SEMVER = /^\d+\.\d+\.\d+$/;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
}

async function latest(r: Release): Promise<string> {
  switch (r.registry) {
    case 'crates.io': {
      const d = JSON.parse(await fetchText(`https://crates.io/api/v1/crates/${r.pkg}`));
      return d.crate.max_stable_version;
    }
    case 'PyPI': {
      const d = JSON.parse(await fetchText(`https://pypi.org/pypi/${r.pkg}/json`));
      return d.info.version;
    }
    case 'npm': {
      const d = JSON.parse(await fetchText(`https://registry.npmjs.org/${r.pkg}`));
      return d['dist-tags'].latest;
    }
    case 'Maven Central': {
      const [group, artifact] = r.pkg.split(':');
      const xml = await fetchText(`https://repo1.maven.org/maven2/${group.replace(/\./g, '/')}/${artifact}/maven-metadata.xml`);
      const m = xml.match(/<release>([^<]+)<\/release>/);
      if (!m) throw new Error(`no <release> in maven-metadata.xml for ${r.pkg}`);
      return m[1];
    }
  }
}

export type ResolvedRelease = Release & { version: string; fromRegistry: boolean };

let cache: Promise<ResolvedRelease[]> | undefined;

/** Versions for every entry in RELEASES, read once per build. */
export function currentReleases(): Promise<ResolvedRelease[]> {
  cache ??= Promise.all(
    RELEASES.map(async (r) => {
      try {
        const v = await latest(r);
        if (typeof v !== 'string' || !SEMVER.test(v)) throw new Error(`unexpected version ${JSON.stringify(v)}`);
        return { ...r, version: v, fromRegistry: true };
      } catch (err) {
        console.warn(`[releases] ${r.registry} ${r.pkg}: ${(err as Error).message}; using fallback ${r.fallback}`);
        return { ...r, version: r.fallback, fromRegistry: false };
      }
    }),
  );
  return cache;
}
