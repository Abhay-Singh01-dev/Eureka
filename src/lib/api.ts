/**
 * Centralised API base URL.
 *
 * In development the Vite proxy forwards `/api` to `http://localhost:8000`,
 * so the default empty string works.  For production builds served from a
 * different origin, set `VITE_API_BASE_URL` in the `.env` file:
 *
 *   VITE_API_BASE_URL=https://api.eureka.example.com
 *
 * Usage:
 *   import { API_BASE } from "@/lib/api";
 *   fetch(`${API_BASE}/api/dashboard/stream?...`);
 */

export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "";
