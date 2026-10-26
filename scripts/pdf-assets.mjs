import {cp,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=dirname(require.resolve('pdfjs-dist/package.json'));
// Runtime PDF resources are built from the locked local package; never fetched from a CDN.
await mkdir('public/pdfjs',{recursive:true});
for(const folder of ['cmaps','standard_fonts','wasm','iccs']){
  await cp(resolve(root,folder),resolve('public/pdfjs',folder),{recursive:true});
}
await cp(resolve(root,'LICENSE'),resolve('public/pdfjs/LICENSE'));
