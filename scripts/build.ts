import { join } from 'node:path';
import type { BunPlugin } from 'bun';

const root = join(import.meta.dir, '..');

// Resolve @resonance-addons/* workspace packages to their src/index.ts
const workspaceResolver: BunPlugin = {
  name: 'workspace-resolver',
  setup(build) {
    build.onResolve({ filter: /^@resonance-addons\// }, (args) => {
      const pkg = args.path.replace('@resonance-addons/', '');
      return { path: join(root, 'packages', pkg, 'src', 'index.ts') };
    });
  },
};

const addonArg = process.argv.find((arg) => arg.startsWith('--addon='));
const addon = addonArg ? addonArg.split('=')[1] : 'qobuz-tidal-addon';
const name = addon.replace(/-addon$/, '');
const entry = join(root, 'packages', addon, 'src', 'index.ts');

const distDir = join(root, 'dist');
await Bun.$`mkdir -p ${distDir}`;

console.log(`Building ${addon} from ${entry}...`);

const result = await Bun.build({
  entrypoints: [entry],
  format: 'iife',
  target: 'browser',
  minify: true,
  plugins: [workspaceResolver],
  banner: "var self = typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this);",
  define: {
    'process.env.NODE_ENV': '"production"',
  },
});

if (!result.success) {
  console.error(`Build failed for ${addon}:`);
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

const outPath = join(distDir, `${name}.js`);
await Bun.write(outPath, result.outputs[0]!);
console.log(`✓ Built ${addon} → dist/${name}.js`);
