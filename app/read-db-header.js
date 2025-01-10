import readInt from "./read-int.js";


export default async function readDbHeader(databaseFile) {
//   const sqlFormat = await readInt(databaseFile, 16);
//   const dbPageSize = await readInt(databaseFile, 2);
  const sqlFormat = await databaseFile.read(16)
  const dbPageSize = await databaseFile.read(2)
  return {
    sqlFormat,
    dbPageSize,
  };
}
