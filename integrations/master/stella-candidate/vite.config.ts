import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { photoStorage } from './dev-server/photo-storage.ts'
import { resultStorage } from './dev-server/result-storage.ts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const candidateRoot = fileURLToPath(new URL('.', import.meta.url))
const target = process.env.STELLA_MASTER_TARGET ?? 'http://127.0.0.1:8842'
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(target)) throw Error('Isolated loopback backend required')
// Photos approved in the local scenario are written here by the dev server; the directory may be shared with another machine.
const photoDirectory = process.env.STELLA_PHOTO_STORAGE ?? root + '/PhotoStorage'
// The results of finished VK Видео tests are written here by the dev server, for the wall and the page behind the QR code.
const resultDirectory = process.env.STELLA_RESULT_STORAGE ?? root + '/ResultStorage'

export default defineConfig({
  root: candidateRoot,
  base: '/stella/',
  cacheDir: '.cache/vite',
  resolve: { tsconfigPaths: true, alias: { 'lumicells-project': root + '/artifacts/ribbon/vendor/lumicells/src', '../../../DESIGN': root + '/artifacts/DESIGN' } },
  build: { rollupOptions: { output: { entryFileNames: 'assets/app.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } } },
  plugins: [react(), photoStorage(photoDirectory), resultStorage(resultDirectory)],
  server: {
    host: '127.0.0.1',
    port: 5218,
    proxy: { '/master-api': { target, rewrite: path => path.replace(/^\/master-api/, '') } },
    strictPort: true,
    headers: { 'X-VK-Stella-Local': '1' },
    fs: {
      allow: [
        candidateRoot,
        root + '/artifacts/DESIGN/BRANDS/',
        root + '/artifacts/ribbon/',
        root + '/docs/Research/lumicells-20260930/upstream/lumicells-1007717d72cfd9d768d4b9a3f7fc80a126e49c51/src/',
      ],
    },
  },
})
