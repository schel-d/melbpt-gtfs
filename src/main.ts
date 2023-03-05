import * as dotenv from 'dotenv';
import express from "express";
import compression from "compression";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { parseIntThrow } from 'schel-d-utils';
import { downloadGTFS } from './download-zip';
import { DateTime } from 'luxon';

/** GTFS data is considered stale if it's a day old. */
const staleIntervalSeconds = 60 * 60 * 24;

/** Check if the data is stale every 10 minutes. */
const staleCheckIntervalMillis = 60 * 10 * 1000;

// Entry point.
main();

/** The main entry point of the project. */
async function main() {
  console.log("Starting...");
  dotenv.config();

  const gtfsUrl = process.env.GTFS_URL;
  if (gtfsUrl == null) {
    throw new Error("GTFS_URL not set.");
  }

  let lastDownloadAttempt = DateTime.utc();
  await downloadGTFS(gtfsUrl);

  console.log("Data ready. Starting server...");
  startServer();

  // Periodically check and refresh data if it's too old.
  setInterval(() => {
    const now = DateTime.utc();
    if (now.diff(lastDownloadAttempt).as("seconds") > staleIntervalSeconds) {
      console.log("Data is stale. Refreshing...");

      lastDownloadAttempt = DateTime.utc();

      // Start download (no need to await).
      downloadGTFS(gtfsUrl).catch(err => {
        console.warn(
          "Failed to refresh GTFS data (continuing with old data).", err
        );
      });
    }
  }, staleCheckIntervalMillis)
}

function startServer() {
  const port = parseIntThrow(process.env.PORT ?? "3003");

  const app = express();

  // Allows up to 50 requests each 5-minute chunk from the same IP address.
  const limiter = rateLimit({
    windowMs: 60 * 1000 * 5,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false
  });

  app.use(cors());
  app.use(compression());
  app.use(limiter);
  app.use(express.static(".out/public"));
  app.use(express.static("other"));

  app.get("/", async (req, res) => {
    res.status(200).send("TrainQuery GTFS server.");
  });

  app.listen(port, () => {
    console.log(`Express server listening on port ${port}.`);
  });
}
