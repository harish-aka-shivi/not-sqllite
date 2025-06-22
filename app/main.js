import DatabaseFile from "./database-file.js";
import getColumnNames from "./get-column-names.js";
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

  async #parsePage(columns, pointerOffset) {
    await this.#initializeDbFile();
    const numberOfColumns = columns.length;
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

      const sqlSchemaRowFriendly = columns.reduce((acc, item, index) => {
        acc[item] = record[index];
        return acc
      }, {}) ;

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

    const schemaTableColumns = ['type', 'name', 'tbl_name', 'rootpage', 'sql']
    // parse the rest of the page
    const page = await this.#parsePage(schemaTableColumns, 0)

    const dbFirstPage = {
      dbHeader: dbHeader,
      ...page,
    }

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

    // Flaky logic to calculate number of columns in a table
    // const splittedStr = sql.split(',');
    // const numberOfColumns = splittedStr.length
    const columns = getColumnNames(sql)
    const numberOfColumns = columns.length;
    logger.info({columns, numberOfColumns, sql})

    const pageSize = firstPage.dbHeader.dbPageSize;

    const offset = pageSize * (tableRootPage - 1)

    logger.info({
      tableRootPage,
      pageSize,
      sql,
      tableName,
      numberOfColumns,
      columns,
    })

    await this.#databaseFile.seek(offset)

    const page = await this.#parsePage(columns, offset)

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
} else if (command.toLowerCase().includes("count(*)")) {
  
  const tokenizedArr = command.trim().split(' ');
  const tableName = tokenizedArr[tokenizedArr.length - 1];

  // console.log({
  //   tokenizedArr,
  //   tableName
  // })

  const dbImpl = DBimpl.getInstance()
  const page = await dbImpl.getPage(tableName)

  logger.info(page)

  console.log(page.pageHeader.numberOfCells)

  // Seek to this position
  // await data


} else if (command.toLowerCase().includes('select')) {
  const lowerCaseCommand = command.toLowerCase().trim()

  const tokenizedArr = lowerCaseCommand.split('select')
  const selectionStr = tokenizedArr[1];

  const tokenizedOnFrom = selectionStr.split('from')
  const columnsStr = tokenizedOnFrom[0].trim();
  const table = tokenizedOnFrom[1].trim();

  const columns = columnsStr.split(',').map(i => i.trim())

  const columnName = columns[0];

  const dbImpl = DBimpl.getInstance()

  const page = await dbImpl.getPage(table)

  logger.info(page)
  const columnNames = page.cells.map(cell => {
    return cell.cellPayload.recordValuesFriendly[columnName]
  })

  logger.info({
    table,
    columns,
    columnNames
  })
  console.log(columnNames.reduce((acc, item, index) => {
    acc = `${acc}${item}`
    if (index < columnNames.length - 1) {
      acc = `${acc}\n`
    }
    return acc
  }, ''))

}

else {
  throw `Unknown command ${command}`;
}

