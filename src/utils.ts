import got from "got";
import { createWriteStream, existsSync, mkdir } from "fs";
import { pipeline } from "stream";
import { promisify } from "util";
import { parseIntNull, uuid } from "schel-d-utils";
import { readdir, rm, cp } from "fs/promises";
import { join, resolve } from "path";
import AdmZip from "adm-zip";
import extract from "extract-zip";

const createDir = promisify(mkdir);
const pipelineAsync = promisify(pipeline);

/**
 * Downloads a zip file from the given url. Throws an error if the path is not a
 * zip file.
 * @param path The URL for the zip file on the server.
 * @param destination The path for the downloaded zip file to take.
 */
export async function downloadZip(path: string, destination: string) {
  if ((await got.get(path)).headers["content-type"] == "application/zip") {
    const stream = got.stream(path);

    // Track download progress.
    let total = 0;
    let length: number | null = null;
    stream.on("response", response => {
      length = parseIntNull(response.headers['content-length']);
    });
    stream.on("data", chunk => {
      const isFirst = total == 0;
      total += chunk.length;
      if (length == null) { return; }
      const perc = total / length * 100;

      // Clear the previous line (replace with new progress value).
      if (!isFirst) {
        process.stdout.moveCursor(0, -1);
        process.stdout.clearLine(1);
      }
      console.log(`Download ${perc.toFixed(2)}% complete...`);
    });

    await pipelineAsync(stream, createWriteStream(destination));
  }
  else {
    throw new Error(`File at "${path}" was not a zip file.`);
  }
}

/**
 * Ensure there is an empty folder at the given path, overwriting any existing
 * folder that was there.
 * @param path The folder path.
 * @param cleanupOld True if all other ".data-" folders should be erased.
 * @param logger The object to logger warnings to.
*/
export async function prepareEmptyFolder(cleanupOld: boolean): Promise<string> {

  if (cleanupOld) {
    try {
      // Delete any directories starting with ".data-".
      const oldDataDirs = (await readdir(".")).filter(d => d.startsWith(".data-"));
      for (const oldDir of oldDataDirs) {
        await rm(oldDir, { recursive: true, retryDelay: 200, maxRetries: 5 });
      }
    }
    catch {
      console.warn("Failed to cleanup old data.");
    }
  }

  // Create a new folder, e.g. `./.data-{some uuid}`.
  const folderName = generateTempFolderName();
  await createDir(folderName, { recursive: true });
  return folderName;
}

/** Generates a temporary data folder name, i.e. `./.data-{some uuid}`. */
function generateTempFolderName(): string {
  return "./.data-" + uuid();
}

/**
 * Runs a function without warnings being printed to the console. I know this is
 * a bad idea, but `extract-zip` always spits out a warning, and there's nothing
 * I can really do about it.
 * @param func The function to run with warnings disabled.
 */
export async function runWithoutWarnings<T>(func: () => Promise<T>): Promise<T> {
  // Remove all warning listeners.
  const warningListeners = process.listeners("warning");
  process.removeAllListeners("warning");

  const result = await func();

  // Put them back.
  warningListeners.forEach(l => process.addListener("warning", l));

  return result;
}

/**
 * Extracts a zip at the given path to the given destination.
 * @param zipPath The zip path.
 * @param destination The destination.
 */
export async function extractZip(zipPath: string, destination: string) {
  try {
    await runWithoutWarnings(async () => {
      await extract(zipPath, { dir: resolve(destination) });
    });
  }
  catch {
    throw new Error("Failed to extract zip archive.");
  }
}

/**
 * Copies a file from one path to another.
 * @param from The source file.
 * @param to The destination of the copy.
 */
export async function copyFile(from: string, to: string) {
  try {
    await cp(from, to);
  }
  catch {
    throw new Error(`Failed to copy "${from}" to "${to}".`);
  }
}

/**
 * Add the contents of the given folder to a zip archive, saved at the given
 * zip path.
 * @param folder The folder with the desired contents of the zip.
 * @param zipPath Where to save the zip.
 */
export async function zipFolder(folder: string, zipPath: string) {
  try {
    const files = await readdir(folder);

    const zip = new AdmZip();
    for (const file of files) {
      zip.addLocalFile(join(folder, file));
    }

    zip.writeZip(zipPath);
  }
  catch {
    throw new Error(`Failed to create zip.`);
  }

}

/**
 * Creates a folder at the given path (unless it already exists).
 * @param path The path.
 */
export async function createFolder(path: string) {
  if (existsSync(path)) { return; }

  try {
    await createDir(path, { recursive: true });
  }
  catch {
    throw new Error(`Couldn't create folder "${path}".`);
  }
}

/**
 * Deletes the file/folder if it exists.
 * @param path The file/folder path.
 */
export async function deleteIfExists(path: string) {
  if (!existsSync(path)) { return; }

  try {
    await rm(path, { recursive: true, retryDelay: 200, maxRetries: 5 });
  }
  catch {
    throw new Error(`Couldn't delete "${path}".`);
  }
}
