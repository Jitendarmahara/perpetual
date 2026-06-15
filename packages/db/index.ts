import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(import.meta.dir, ".env") });

import { PrismaClient } from "./generated/prisma/client";

import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
export const client = new PrismaClient({
  adapter,
});
