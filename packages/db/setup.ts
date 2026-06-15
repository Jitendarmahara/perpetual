import { spawn } from "node:child_process";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(import.meta.dir, ".env") });

const databaseUrl = (process.argv[2] ?? process.env.DATABASE_URL)?.trim();
const schemaPath = path.resolve(import.meta.dir, "schema.sql");

if (!databaseUrl) {
  console.error("DATABASE_URL is missing. Add it to packages/db/.env or pass it as the first argument.");
  process.exit(1);
}

const setup = spawn("psql", [databaseUrl, "-f", schemaPath], {
  stdio: "inherit",
});

setup.on("error", (error) => {
  console.error("Failed to start psql. Make sure PostgreSQL client tools are installed.", error);
  process.exit(1);
});

setup.on("close", (code) => {
  if (code === 0) {
    console.log("Timescale candle schema setup completed.");
    return;
  }

  console.error(`Timescale candle schema setup failed with exit code ${code}.`);
  process.exit(code ?? 1);
});
