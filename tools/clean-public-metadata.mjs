// Finder metadata is never a web asset. Git ignores it; remove it before Vite
// copies public/ so local previews have the same clean boundary as CI checkouts.
import fs from 'node:fs/promises';
import path from 'node:path';
async function clean(dir){for(const entry of await fs.readdir(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())await clean(file);else if(entry.name==='.DS_Store')await fs.unlink(file);}}
await clean('public');
