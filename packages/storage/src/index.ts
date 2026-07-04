export { closeDb, type Database, getDb } from "./db";
export { runMigrations } from "./migrations/001_initial";
export {
  createInteraction,
  getRecentInteractions,
  searchInteractions,
} from "./repositories/interactions";
