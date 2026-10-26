import { defineConfig, loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

export default defineConfig(({ mode, command }) => {
  // 同一次建置的網頁與版本檔使用相同識別碼，重建相同版號也能辨識。
  const release = {
    version: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version,
    buildId: randomUUID().replaceAll('-', ''),
    builtAt: new Date().toISOString()
  };
  const env = loadEnv(mode, process.cwd(), '');
  const url = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (key.startsWith('sb_secret_')) throw new Error('前端只能使用公開 key');
  if (key.split('.').length === 3) {
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    if (payload.role !== 'anon') throw new Error('前端 JWT key 必須是 anon 角色');
  }
  return {
    plugins: [{
      name: 'nrop-release',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(release) + '\n' });
      }
    }],
    define: {
      __NROP_RELEASE__: JSON.stringify({ ...release, development: command === 'serve' }),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(key)
    },
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true }
  };
});
