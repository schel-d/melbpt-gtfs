import {
  copyFile, createFolder, deleteIfExists, downloadZip, extractZip,
  prepareEmptyFolder, zipFolder
} from "./utils";

const filesOfInterest = [
  "calendar.txt",
  "calendar_dates.txt",
  "routes.txt",
  "stops.txt",
  "stop_times.txt",
  "trips.txt",
];

const modes = [
  { folderIndex: "1", name: "regional" },
  { folderIndex: "2", name: "suburban" }
]

export async function downloadGTFS(url: string) {
  const folderPath = await prepareEmptyFolder(true);

  const gtfsZipPath = `${folderPath}/gtfs.zip`;
  console.log(`Downloading "${url}" to "${gtfsZipPath}"...`);
  await downloadZip(url, gtfsZipPath);
  console.log(`Extracting "${gtfsZipPath}" to "${folderPath}"...`);
  await extractZip(gtfsZipPath, folderPath);

  const outPath = `${folderPath}/out`;
  await createFolder(outPath);

  for (const mode of modes) {
    const modeZipPath = `${folderPath}/${mode.folderIndex}/google_transit.zip`;
    const modeFolderPath = `${folderPath}/${mode.name}`;
    await createFolder(modeFolderPath);
    console.log(`Extracting "${modeZipPath}" to "${modeFolderPath}"...`);
    await extractZip(modeZipPath, modeFolderPath);

    for (const file of filesOfInterest) {
      const filePath = `${modeFolderPath}/${file}`;
      const destination = `${outPath}/${mode.name}-${file.replace("_", "-")}`;
      console.log(`Copying "${filePath}" to "${destination}"...`);
      await copyFile(filePath, destination);
    }
  }

  const publicFolder = ".out/public";
  const gtfsPublic = `${publicFolder}/gtfs.zip`;
  await createFolder(publicFolder);
  await deleteIfExists(gtfsPublic);
  console.log(`Zipping "${outPath}" to "${gtfsPublic}"...`);
  zipFolder(outPath, gtfsPublic);

  deleteIfExists(folderPath);
}
