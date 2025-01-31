import readInt from "./read-int.js";


export default async function readDbHeader(databaseFile) {
//   const sqlFormat = await readInt(databaseFile, 16);
//   const dbPageSize = await readInt(databaseFile, 2);

  // const sqlFormat = await databaseFile.read(16)
  // const dbPageSize = await databaseFile.read(2)
  // const fileFormatWriteVersion = await databaseFile.read(1)
  // const fileFormatReadVersion = await databaseFile.read(1)
  // const reservedSpacePerPage = await databaseFile.read(1)
  // const maxEmbedPayloadFraction = await databaseFile.read(1)
  // const minEmbedPayloadFraction = await databaseFile.read(1)
  // const leafPayloadFraction = await databaseFile.read(1)
  // const fileChangeCounter = await databaseFile.read(4)
  // const sizeOfDbInPages = await databaseFile.read(4)
  // const pageNumberFirstFreeListTrunkPage = await databaseFile.read(4)
  // const totalFreeListPages = await databaseFile.read(4)
  // const schemaCookie = await databaseFile.read(4)
  // const schemaFormatNumber = await databaseFile.read(4)
  // const defaultPageCacheSize = await databaseFile.read(4)
  // const pageNumberLargestBTreePage = await databaseFile.read(4)
  // const dbTextEncoding = await databaseFile.read(4)
  // const userVersion = await databaseFile.read(4)
  // const incrementalVacuumMode = await databaseFile.read(4)
  // const applicationId = await databaseFile.read(4)
  // const reservedForExpansion = await databaseFile.read(20)
  // const versionValidForNumber = await databaseFile.read(4)
  // const sqlLiteVersionNumber = await databaseFile.read(4)

const sqlFormat = await readInt(databaseFile, 16)
const dbPageSize = await readInt(databaseFile, 2)
const fileFormatWriteVersion = await readInt(databaseFile, 1)
const fileFormatReadVersion = await readInt(databaseFile, 1)
const reservedSpacePerPage = await readInt(databaseFile, 1)
const maxEmbedPayloadFraction = await readInt(databaseFile, 1)
const minEmbedPayloadFraction = await readInt(databaseFile, 1)
const leafPayloadFraction = await readInt(databaseFile, 1)
const fileChangeCounter = await readInt(databaseFile, 4)
const sizeOfDbInPages = await readInt(databaseFile, 4)
const pageNumberFirstFreeListTrunkPage = await readInt(databaseFile, 4)
const totalFreeListPages = await readInt(databaseFile, 4)
const schemaCookie = await readInt(databaseFile, 4)
const schemaFormatNumber = await readInt(databaseFile, 4)
const defaultPageCacheSize = await readInt(databaseFile, 4)
const pageNumberLargestBTreePage = await readInt(databaseFile, 4)
const dbTextEncoding = await readInt(databaseFile, 4)
const userVersion = await readInt(databaseFile, 4)
const incrementalVacuumMode = await readInt(databaseFile, 4)
const applicationId = await readInt(databaseFile, 4)
const reservedForExpansion = await readInt(databaseFile, 20)
const versionValidForNumber = await readInt(databaseFile, 4)
const sqlLiteVersionNumber = await readInt(databaseFile, 4)

  return {
    sqlFormat,
    dbPageSize,
    fileFormatWriteVersion,
    fileFormatReadVersion,
    reservedSpacePerPage,
    maxEmbedPayloadFraction,
    minEmbedPayloadFraction,
    leafPayloadFraction,
    fileChangeCounter,
    sizeOfDbInPages,
    pageNumberFirstFreeListTrunkPage,
    totalFreeListPages,
    schemaCookie,
    schemaFormatNumber,
    defaultPageCacheSize,
    pageNumberLargestBTreePage,
    dbTextEncoding,
    userVersion,
    incrementalVacuumMode,
    applicationId,
    reservedForExpansion,
    versionValidForNumber,
    sqlLiteVersionNumber
  };
}
