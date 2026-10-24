import { mkdir, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { build } from 'esbuild';
await rm('www', { recursive: true, force: true });
await mkdir('www', { recursive: true });
for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'assets', 'vendor']) {
  await cp(file, `www/${file}`, { recursive: true });
}
await build({entryPoints: ['scripts/native.mjs'], bundle: true, outfile: 'www/native.js', format: 'iife', target: 'es2020'});
let html = await readFile('www/index.html', 'utf8');
html = html.replace('</head>', '<script src="native.js"></script></head>');
await writeFile('www/index.html', html);
console.log('PRINT ME : application préparée dans www/');
