const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
});

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

const connectionString =
  process.env.DATABASE_URL_TEST || process.env.DATABASE_URL;

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

module.exports = prisma;
