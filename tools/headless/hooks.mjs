// hooks.mjs — Node module hook: трактует js/**.js как ESM.
// Корневой package.json проекта имеет "type":"commonjs", из-за чего Node
// считает .js в js/**  CommonJS и падает на import/export. Этот hook
// переопределяет format на 'module' для файлов внутри <project>/js/.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
  .replace(/\\/g, '/')
  .replace(/\/+$/, '');
const JS_DIR = ROOT + '/js/';

export async function load(url, context, nextLoad) {
  if (!url.startsWith('file:')) return nextLoad(url, context);
  const clean = url.split('?')[0].split('#')[0];
  let p;
  try { p = fileURLToPath(clean); } catch (e) { return nextLoad(url, context); }
  p = p.replace(/\\/g, '/');
  if (p.startsWith(JS_DIR) && p.endsWith('.js')) {
    const source = await readFile(p, 'utf8');
    return { format: 'module', source, shortCircuit: true };
  }
  return nextLoad(url, context);
}
