/* global process -- este archivo lo ejecuta Node al compilar, no el navegador */
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dónde vive la app:
  //  - Escritorio (VITE_DESKTOP=1): se abre desde una carpeta del disco, así que las rutas
  //    tienen que ser relativas ("./assets/...").
  //  - Web publicada en GitHub Pages (VITE_BASE=/GameHub/): en una subcarpeta del dominio.
  //  - Si no, en la raíz ("/assets/..."), como en desarrollo.
  base: process.env.VITE_DESKTOP ? './' : (process.env.VITE_BASE || '/'),
})
