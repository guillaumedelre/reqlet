import type { HttpMethod } from "@/store/tabs"

// Swagger UI color palette — kept in sync with docs/development.md
export const HTTP_METHOD_COLORS: Record<HttpMethod, string> = {
  GET: "#61affe",
  POST: "#49cc90",
  PUT: "#fca130",
  PATCH: "#50e3c2",
  DELETE: "#f93e3e",
  HEAD: "#9012fe",
  OPTIONS: "#0d5aa7",
}
