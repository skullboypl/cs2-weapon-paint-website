import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../dist')  // ⬅️ ⬅️ ⬅️ to przenosi build do katalogu nadrzędnego
  }
})
