// Runtime-writable directory — kept outside the build output (unlike
// public/) so uploads written after `nuxt build` still resolve correctly in
// production.
export const uploadsDir = process.env.UPLOADS_DIR ?? './data/uploads'
