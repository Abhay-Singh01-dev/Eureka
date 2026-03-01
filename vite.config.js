import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // Forward TTS API calls and cached audio to the FastAPI backend.
      // Start the backend first: cd backend && uvicorn main:app --reload --port 8000
      "/api": "http://localhost:8000",
      "/static": "http://localhost:8000",
    },
  },
});
