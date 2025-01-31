import DatabaseFile from "./database-file.js";
import readDbHeader from "./read-db-header.js";
import readInt from "./read-int.js";
import readPageHeader from "./read-page-header.js";
import readRecord from "./read-record.js";
import readVarint from "./read-varint.js";

const databaseFilePath = process.argv[2];
const command = process.argv[3];

if (command === ".dbinfo") {
  const databaseFile = new DatabaseFile(databaseFilePath);

  await databaseFile.open();
  // await databaseFile.seek(100); // Skip database header

  const dbHeader = await readDbHeader(databaseFile)

  const pageHeader = await readPageHeader(databaseFile);

  // console.log({ dbHeader, pageHeader })

  const cellPointers = [];

  // const numberOfCellsInt = pageHeader.numberOfCells.readUInt16BE(0);
  const numberOfCellsInt = pageHeader.numberOfCells;

  
  // console.log({
  //   numberOfCellsInt
  // })

  for (let i = 0; i < numberOfCellsInt; i++) {
    // since the cell pointer each has offset of the cell content which is of 2 bytes
    cellPointers.push(await readInt(databaseFile, 2));
    // const cellContentOffsetBuffer = await databaseFile.read(2)
    // const cellContentOffset = cellContentOffsetBuffer.readUInt16BE(0)
    // cellPointers.push(cellContentOffset)
  }

  const sqliteSchemaRows = [];

  // console.log({ cellPointers})

  // Each of these cells represents a row in the sqlite_schema table.
  for (const cellPointer of cellPointers) {
    await databaseFile.seek(cellPointer);

    await readVarint(databaseFile); // Number of bytes in payload
    await readVarint(databaseFile); // Rowid

    const record = await readRecord(databaseFile, 5);

    // Table contains columns: type, name, tbl_name, rootpage, sql
    sqliteSchemaRows.push({
      type: record[0],
      name: record[1],
      tbl_name: record[2],
      rootpage: record[3],
      sql: record[4],
    });
  }

  // console.log({
  //   sqliteSchemaRows
  // })

  // You can use print statements as follows for debugging, they'll be visible when running tests.
  // console.log("Logs from your program will appear here!");
  // const pageSize = databaseFile.readUInt16BE(16); // page size is 2 bytes starting at offset 16
  console.log(`database page size: ${dbHeader.dbPageSize}`);

  // Uncomment this to pass the first stage
  console.log(`number of tables: ${sqliteSchemaRows.length}`);
} else {
  throw `Unknown command ${command}`;
}
