import DatabaseFile from "./database-file.js";
import logger from "./logger.js";
import readDbHeader from "./read-db-header.js";
import readInt from "./read-int.js";
import readPageHeader from "./read-page-header.js";
import readRecord from "./read-record.js";
import readVarint from "./read-varint.js";

const databaseFilePath = process.argv[2];
const command = process.argv[3];

  
const readDBFirstPage = async () => {
  const dbFirstPage = {
    dbHeader: {},
    pageHeader: {},
    cellPointers: [],
    cells: [
      
    ]
  }
  
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
    const numOfBytesInPayload = await readVarint(databaseFile); // Number of bytes in payload
    const rowID = await readVarint(databaseFile); // Rowid


    const recordData = await readRecord(databaseFile, 5);

    // console.log(recordData)

    const {recordValues: record} = recordData
    // Table contains columns: type, name, tbl_name, rootpage, sql
    const sqlSchemaRowFriendly = {
      type: record[0],
      name: record[1],
      tbl_name: record[2],
      rootpage: record[3],
      sql: record[4],
    }
    sqliteSchemaRows.push(sqlSchemaRowFriendly);

    const cell = {
      cellPointer,
      cellHeader: {
        numOfBytesInPayload,
        rowID,
      },
      cellPayload: {
        ...recordData,
        recordValuesFriendly: sqlSchemaRowFriendly
      }
      
    }

    dbFirstPage.cells.push(cell)
  }

  dbFirstPage.pageHeader = pageHeader
  dbFirstPage.dbHeader = dbHeader
  dbFirstPage.cellPointers = cellPointers
  return dbFirstPage;
}

if (command === ".dbinfo") {
  const dbFirstPage = await readDBFirstPage()
  // logger.info(dbFirstPage)
  // You can use print statements as follows for debugging, they'll be visible when running tests.
  // console.log("Logs from your program will appear here!");
  // const pageSize = databaseFile.readUInt16BE(16); // page size is 2 bytes starting at offset 16
  console.log(`database page size: ${dbFirstPage.dbHeader.dbPageSize}`);

  // Uncomment this to pass the first stage
  console.log(`number of tables: ${dbFirstPage.cellPointers.length}`);

} else if (command === '.tables') {
  const dbFirstPage = await readDBFirstPage()
  // logger.info(dbFirstPage)
  console.log(dbFirstPage.cells.reduce((acc, cell, index) => {
    const tbl_name = cell.cellPayload.recordValuesFriendly.tbl_name
    if (index === 0) {
      return tbl_name
    }
    return `${acc} ${tbl_name}`
  }, ''))
}

else {
  throw `Unknown command ${command}`;
}

