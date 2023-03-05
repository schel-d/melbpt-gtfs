import * as dotenv from 'dotenv';
import express from "express";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { parseIntThrow } from 'schel-d-utils';

// Entry point.
main();

/** The main entry point of the project. */
async function main() {
  console.log("Starting...");
  dotenv.config();

  const port = parseIntThrow(process.env.PORT ?? "3003");

  const app = express();

  // Allows up to 100 requests each 5-minute chunk from the same IP address.
  const limiter = rateLimit({
    windowMs: 60 * 1000 * 5,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use(cors());
  app.use(compression());
  app.use(limiter);
  app.use(express.static("other"));

  app.get("/", async (req, res) => {
    res.status(200).send("Hello world!");
  });

  app.listen(port, () => {
    console.log(`Express server listening on port ${port}.`);
  });
}
