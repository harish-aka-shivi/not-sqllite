import DatabaseFile from "./database-file.js";
import logger from "./logger.js";
import readDbHeader from "./read-db-header.js";
import readInt from "./read-int.js";
import readPageHeader from "./read-page-header.js";
import readRecord from "./read-record.js";
import readVarint from "./read-varint.js";

const databaseFilePath = process.argv[2];
const command = process.argv[3];

  // #dbFirstPage = {
  //     dbHeader: {},
  //     pageHeader: {},
  //     cellPointers: [],
  //     cells: [
  //       {
  //         cellPointer: null,
  //         cellHeader: {
  //           numOfBytesInPayload: null,
  //           rowID: null
  //         },
  //         cellPayload: {
  //           recordHeader: {
  //             bytesInHeader: null,
  //             serialType: []
  //           },
  //           recordValues: [],
  //           recordValuesFriendly: {}
  //         }
  //       }
  //     ]
  //   }

class DBimpl {

  #databaseFile = null

  #dbFirstPage = null

  static #dbImplInstance = null

  static getInstance() {
    if (!DBimpl.#dbImplInstance) {
      const dbImpl = new DBimpl()
      DBimpl.#dbImplInstance = dbImpl

    }
    return DBimpl.#dbImplInstance;
  }

  async #initializeDbFile() {
    if(!this.#databaseFile) {
      this.#databaseFile = new DatabaseFile(databaseFilePath);
      await this.#databaseFile.open();
    }
    return this.#databaseFile
  }

  /* 
  
  cell type

  {
          cellPointer: null,
          cellHeader: {
            numOfBytesInPayload: null,
            rowID: null
          },
          cellPayload: {
            recordHeader: {
              bytesInHeader: null,
              serialType: []
            },
            recordValues: [],
            recordValuesFriendly: {}
          }
        }

  */

  async #parsePage(numberOfColumns, pointerOffset) {
    await this.#initializeDbFile();

    const databaseFile = this.#databaseFile

    const pageFormat = {
      pageHeader: {},
      cellPointers: [],
      cells: []
    }


    const pageHeader = await readPageHeader(databaseFile);

    logger.info({pageHeader, numberOfColumns, pointerOffset})

    const cellPointers = [];

    // const numberOfCellsInt = pageHeader.numberOfCells.readUInt16BE(0);
    const numberOfCellsInt = pageHeader.numberOfCells;
    
    // logger.info({
    //   numberOfCellsInt
    // })

    for (let i = 0; i < numberOfCellsInt; i++) {
      // since the cell pointer each has offset of the cell content which is of 2 bytes
      cellPointers.push(await readInt(databaseFile, 2));
      // const cellContentOffsetBuffer = await databaseFile.read(2)
      // const cellContentOffset = cellContentOffsetBuffer.readUInt16BE(0)
      // cellPointers.push(cellContentOffset)
    }

    logger.info({cellPointers})

    const sqliteSchemaRows = [];

    // console.log({ cellPointers})


    // Each of these cells represents a row in the sqlite_schema table.
    for (const cellPointer of cellPointers) {
      logger.info({cellPointer, pointerOffset, 'cellPointer + pointerOffset': cellPointer + pointerOffset},`seeking to` )
      await databaseFile.seek(pointerOffset + cellPointer);
      const numOfBytesInPayload = await readVarint(databaseFile); // Number of bytes in payload
      // logger.info('here')

      const rowID = await readVarint(databaseFile); // Rowid

      logger.info({rowID, numOfBytesInPayload})

      // logger.info({rowID})

      // console.log({numOfBytesInPayload, rowID})

      const recordData = await readRecord(databaseFile, numberOfColumns);

      logger.info({recordData})

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

      pageFormat.cells.push(cell)
    }

    pageFormat.pageHeader = pageHeader
    pageFormat.cellPointers = cellPointers
    return pageFormat;
  }

  async getDBFirstPage() {
    if(this.#dbFirstPage) {
      return this.#dbFirstPage
    }

    await this.#initializeDbFile()

    const databaseFile = this.#databaseFile

    // Read first 100 bytes
    const dbHeader = await readDbHeader(databaseFile)
    const pageSize = dbHeader.dbPageSize

    const page = await this.#parsePage(5, 0)

    const dbFirstPage = {
      dbHeader: dbHeader,
      ...page,
    }
    // dbFirstPage.dbHeader = dbHeader

    this.#dbFirstPage = dbFirstPage
    return dbFirstPage;
  }

  async getPage(tableName) {
    await this.#initializeDbFile();
    const firstPage = await this.getDBFirstPage()
    logger.info({firstPage, tableName})

    const tableInfoRow = firstPage.cells.find(cell => cell.cellPayload.recordValuesFriendly.tbl_name === tableName)
    logger.info({tableInfoRow})

    // if no table is found
    if (!tableInfoRow) {
      return new Error("No table found")
    }

    const tableRootPage = tableInfoRow.cellPayload.recordValuesFriendly.rootpage;


    const sql = tableInfoRow.cellPayload.recordValuesFriendly.sql

    // Flaky logic to calculate number of 
    const splittedStr = sql.split(',');
    const numberOfColumns = splittedStr.length

    const pageSize = firstPage.dbHeader.dbPageSize;

    const offset = pageSize * (tableRootPage - 1)

    const pageRootPointer = pageSize * tableRootPage;

    // logger.info({
    //   offset,
    //   pageRootPointer
    // })

    logger.info({
      tableRootPage,
      pageSize,
      sql,
      pageRootPointer,
      tableName,
      numberOfColumns
    })

    await this.#databaseFile.seek(offset)

    const page = await this.#parsePage(numberOfColumns, offset)

    logger.info({
      page
    })
    return page
  }
}
  
 

if (command === ".dbinfo") {
  const dbImpl = DBimpl.getInstance()
  const dbFirstPage = await dbImpl.getDBFirstPage()
  // You can use print statements as follows for debugging, they'll be visible when running tests.
  // console.log("Logs from your program will appear here!");
  // const pageSize = databaseFile.readUInt16BE(16); // page size is 2 bytes starting at offset 16
  console.log(`database page size: ${dbFirstPage.dbHeader.dbPageSize}`);

  // Uncomment this to pass the first stage
  console.log(`number of tables: ${dbFirstPage.cellPointers.length}`);

} else if (command === '.tables') {
  const dbImpl = DBimpl.getInstance()
  const dbFirstPage = await dbImpl.getDBFirstPage()

  logger.info(dbFirstPage)

  console.log(dbFirstPage.cells.reduce((acc, cell, index) => {
    const tbl_name = cell.cellPayload.recordValuesFriendly.tbl_name
    if (index === 0) {
      return tbl_name
    }
    return `${acc} ${tbl_name}`
  }, ''))
} else if (command.toLowerCase().includes("select count(*) from")) {
  
  const tokenizedArr = command.trim().split(' ');
  const tableName = tokenizedArr[tokenizedArr.length - 1];

  // console.log({
  //   tokenizedArr,
  //   tableName
  // })

  const dbImpl = DBimpl.getInstance()
  const page = await dbImpl.getPage(tableName)

  logger.info(page)

  // console.log(page.pageHeader.numberOfCells)

  // Seek to this position
  // await data


} else {
  throw `Unknown command ${command}`;
}

