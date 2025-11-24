import { BTREE_PAGE_TYPES, getPageTypeFriendly, SCHEMA_TABLE_COLUMNS, SCHEMA_TYPE } from "./constants.js";
import DatabaseFile from "./database-file.js";
import getColumnNames from "./get-column-names.js";
import getColumnNameFromIndex from "./get-indexed-column-name.js";
import logger from "./logger.js";
import readCell from "./read-cell.js";
import readDbHeader from "./read-db-header.js";
import readInt from "./read-int.js";
import readPageHeader from "./read-page-header.js";

/**
 * TYPES

  cell type = {
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


  #dbFirstPage = {
      dbHeader: {},
      pageHeader: {},
      cellPointers: [],
      cells: [
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
      ]
    }
 * 
 * 
 */

export default class DBimpl {
  #databaseFile = null;

  #dbFirstPage = null;

  static #dbImplInstance = null;

  #databaseFilePath = null;

  static #isInternalConstructing = false;

  static getInstance(dbFilePath) {
    if (!dbFilePath) {
      throw new Error("must provide a valid database path");
    }

    if (!DBimpl.#dbImplInstance) {
      DBimpl.#isInternalConstructing = true;
      const dbImpl = new DBimpl(dbFilePath);
      DBimpl.#dbImplInstance = dbImpl;
    }
    return DBimpl.#dbImplInstance;
  }

  constructor(dbFilePath) {
    if (!DBimpl.#isInternalConstructing) {
      throw new TypeError("DbImpl is not constructable from outside");
    }
    DBimpl.#isInternalConstructing = false;

    if (!dbFilePath) {
      throw new Error("must provide a valid database path");
    }

    this.#databaseFilePath = dbFilePath;
  }

  async #initializeDbFile() {
    if (!this.#databaseFile) {
      this.#databaseFile = new DatabaseFile(this.#databaseFilePath);
      await this.#databaseFile.open();
    }
    return this.#databaseFile;
  }

  async #parsePage(columns, pointerOffset) {
    // logger.info({
    //   key: 'Parsing page',
    //   columns,
    //   pointerOffset
    // })
    await this.#initializeDbFile();
    const numberOfColumns = columns.length;
    const databaseFile = this.#databaseFile;

    const pageFormat = {
      pageHeader: {},
      cellPointers: [],
      cells: [],
    };

    // Page header
    const pageHeader = await readPageHeader(databaseFile);

    // logger.info({ pageHeader, numberOfColumns, pointerOffset });

    const cellPointers = [];

    const numberOfCellsInt = pageHeader.numberOfCells;
    const pageType = pageHeader.pageType;

    for (let i = 0; i < numberOfCellsInt; i++) {
      cellPointers.push(await readInt(databaseFile, 2));
    }

    // logger.info({ cellPointers });

    /* 
      After page headers, comes the list of cell pointers
      We need to add the page pointer to this pointer to go to the actual pointer
      Each of these cells represents a row in the sqlite_schema table.
    */
    for (const cellPointer of cellPointers) {
      const cell = await readCell({
        databaseFile,
        pointerOffset,
        cellPointer,
        numberOfColumns,
        columns,
        pageType,
      });

      pageFormat.cells.push(cell);
    }

    pageFormat.pageHeader = pageHeader;
    pageFormat.cellPointers = cellPointers;
    return pageFormat;
  }

  async getDBFirstPage() {
    if (this.#dbFirstPage) {
      return this.#dbFirstPage;
    }

    await this.#initializeDbFile();

    const databaseFile = this.#databaseFile;

    /* 
      Read first 100 bytes
    */
    const dbHeader = await readDbHeader(databaseFile);

    // parse the rest of the page
    const page = await this.#parsePage(SCHEMA_TABLE_COLUMNS, 0);

    const dbFirstPage = {
      dbHeader: dbHeader,
      ...page,
    };

    this.#dbFirstPage = dbFirstPage;
    return dbFirstPage;
  }

  /* 
    This method will find the root table pointer from the schema table
    It will further read the full table by querying data even in multiple pages

    NOTE: It assumes schema table will be in 1 page. If the schema table is more that 1 page,
    this might break
  */
  async readTable(tableName) {
    await this.#initializeDbFile();
    const firstPage = await this.getDBFirstPage();
    // logger.info({ firstPage, tableName });

    const tableInfoRow = firstPage.cells.find((cell) => cell.cellPayload.recordValuesFriendly.name === tableName);
    // logger.info({ tableInfoRow });

    // if no table is found
    if (!tableInfoRow) {
      return new Error("No table found");
    }

    const tableRootPage = tableInfoRow.cellPayload.recordValuesFriendly.rootpage;
    const sql = tableInfoRow.cellPayload.recordValuesFriendly.sql;

    /* 
      Flaky logic to calculate number of columns in a table
      const splittedStr = sql.split(',');
      const numberOfColumns = splittedStr.length
    */
    const columns = getColumnNames(sql);
    const numberOfColumns = columns.length;
    // logger.info({ columns, numberOfColumns, sql });

    const pageSize = firstPage.dbHeader.dbPageSize;

    // logger.info({
    //   tableRootPage,
    //   pageSize,
    //   sql,
    //   tableName,
    //   numberOfColumns,
    //   columns,
    // });

    // check if index is present, we don't need to read from the multiple pages
    // we can bypass all the force of all the pages that we implemented earlier
    // instead we can use the index to find the relevant value

    const dataCells = await this.readDataFromMultiplePages(tableRootPage, columns, pageSize);
    // logger.info({
    //   dataCells,
    // });
    return dataCells;
  }

  async getIndexRootPage(tableName, whereColumnName) {
    if (!whereColumnName) {
      return null
    }

    if (!tableName) {
      return null
    }

    await this.#initializeDbFile();
    const firstPage = await this.getDBFirstPage();
    // logger.info({ firstPage, tableName });

    const indexInfoRow = firstPage.cells.find((cell) => {
      const schemaTableName = cell.cellPayload.recordValuesFriendly.tbl_name;
      const schemaType = cell.cellPayload.recordValuesFriendly.type;
      return schemaTableName === tableName && schemaType === SCHEMA_TYPE.INDEX;
    });

    // logger.info({
    //   indexInfoRow,
    // })

    if (indexInfoRow) {
      // if the index exist for this table
      // get the column name
      const sql = indexInfoRow.cellPayload.recordValuesFriendly.sql
      const indexedColumnName = getColumnNameFromIndex(sql);
      const rootPage = indexInfoRow.cellPayload.recordValuesFriendly.rootpage

      if (whereColumnName.trim().toLowerCase() != indexedColumnName.trim().toLowerCase()) {
        return null
      }

      // logger.info({
      //   indexedColumnName,
      //   rootPage
      // })
      return {
        indexedColumnName,
        rootPage
      }
    }

    return null
  }

  async readDataUsingIndex({rootPageNumber, whereColumnName, whereColumnValue}) {
    // logger.info({
    //   rootPageNumber,
    //   whereColumnName,
    //   whereColumnValue
    // })
    await this.#initializeDbFile();
    const firstPage = await this.getDBFirstPage();
    
    const pageSize = firstPage.dbHeader.dbPageSize;

    const columns = [whereColumnName]


    // logger.info({
    //   key: 'index page read successfull',
    //   rootPage
    // })

    // let rowIdInDataTable = null
    let rowIdsInDataTable = [];
    // let pageToOperateNumber = rootPageNumber
    // let isLeafPageReached = false;
    const pagesToTraverse = []
    pagesToTraverse.push(rootPageNumber);
    while (pagesToTraverse.length > 0) {
      const topPage = pagesToTraverse.pop();
      const pageOffset = pageSize * (topPage - 1);
      // Get the page number from the index
      await this.#databaseFile.seek(pageOffset);
      let pageToOperate = await this.#parsePage(columns, pageOffset)
      // logger.info({
      //   key: 'In the while loop',
      //   pageToOperateNumber,
      //   rowIdsInDataTable,
      //   pageToOperate,
      //   whereColumnValue,
      //   pagesToTraverse,
      //   pageType: getPageTypeFriendly(pageToOperate.pageHeader.pageType)
      // })
      const pageType = pageToOperate.pageHeader.pageType;
      
      // If page is interior page
      if (pageType === BTREE_PAGE_TYPES.INTERIOR_INDEX_PAGE_TYPE) {
        // get the cells
        const cells = pageToOperate.cells;
        
        let i = 0
        while (i < cells.length) {
          const cell = cells[i]
          const cellValue = cell.cellPayload.recordValuesFriendly[whereColumnName]
          // logger.info({key: 'interior page', cellValue, i, length: cells.length})
          if (whereColumnValue === cellValue) {
            // assign this page number
            const id = cell.cellPayload.recordValuesFriendly['rowID']
            const leftChild = cell.cellHeader.leftChildPointer;
            pagesToTraverse.push(leftChild)
            rowIdsInDataTable.push(id)
            // break
          } else if (whereColumnValue < cellValue) {
            // save the next page number
            // pageToOperateNumber = cell.cellHeader.leftChildPointer;
            const leftChild = cell.cellHeader.leftChildPointer;
            pagesToTraverse.push(leftChild)
            break; 
          }
          i++
        }
        
        if (i === cells.length) {
          // get the right most page
          const nextPage = pageToOperate.pageHeader.rightMostPointer;
          pagesToTraverse.push(nextPage)
        } 
      } else {
        const cells = pageToOperate.cells;
        const cellLength = cells.length;
        cells.forEach((cell, index) => {
          const cellValue = cell.cellPayload.recordValuesFriendly[whereColumnName]
          // logger.info({key: 'leaf page', cellValue, index, cellLength})
          if (cellValue === whereColumnValue) {
            const id = cell.cellPayload.recordValuesFriendly['rowID']
            rowIdsInDataTable.push(id)
          }
        })
        // isLeafPageReached = true;
      }
    }

    // logger.info("Reading from the index finished")
    // logger.info({
    //   pageToOperateNumber,
    //   rowIdsInDataTable,
    //   columns,
    //   whereColumnName,
    //   whereColumnValue,
    //   pagesToTraverse
    // })

    // Go to that page number and read that page

   return rowIdsInDataTable;
    // Get the date from that page
  }

  async readFromTableBasedUsingPointers({ tableName, rowIds }) {
    await this.#initializeDbFile();
    const firstPage = await this.getDBFirstPage();
    const pageSize = firstPage.dbHeader.dbPageSize;
    const tableInfoRow = firstPage.cells.find((cell) => cell.cellPayload.recordValuesFriendly.name === tableName);

    // if no table is found
    if (!tableInfoRow) {
      return new Error("No table found");
    }

    const sql = tableInfoRow.cellPayload.recordValuesFriendly.sql;
    const columns = getColumnNames(sql);

    const data = []

    for (let k = 0; k < rowIds.length; k++) {
      const rowId = rowIds[k]

      const tableRootPage = tableInfoRow.cellPayload.recordValuesFriendly.rootpage;

      let pagesToTraverse = [tableRootPage]
      
      while (pagesToTraverse.length > 0) {
        const nextPage = pagesToTraverse.pop()
        const pageOffset = pageSize * (nextPage - 1);
        // Get the page number from the index

        await this.#databaseFile.seek(pageOffset);
        const pageToOperate = await this.#parsePage(columns, pageOffset) 
        const pageType = pageToOperate.pageHeader.pageType;

        // logger.info({
        //   key: 'in the while loop',
        //   pageType, pageType,
        //   nextPage,
        // })
        
        if (pageType === BTREE_PAGE_TYPES.INTERIOR_TABLE_PAGE_TYPE) {
          const cells = pageToOperate.cells;
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i]
            // logger.info({
            //   key: 'readFromTable interior',
            //   rowId,
            //   cell,
            //   pageOffset,
            // })
            if (rowId <= cell.rowID) {
              pagesToTraverse.push(cell.leftChildPointer)
              break;
            }

            if (i === cells.length - 1) {
              const nextPage = pageToOperate.pageHeader.rightMostPointer;
              pagesToTraverse.push(nextPage)
            }
          }          
        } else if (pageType === BTREE_PAGE_TYPES.LEAF_TABLE_PAGE_TYPE) {
          const cells = pageToOperate.cells;
          
          for (let i = 0; i < cells.length; i++) {
            const cell = cells[i]
            // logger.info({
            //   key: 'readFromTable leaf',
            //   rowId,
            //   cell,
            //   pageOffset
            // })
            if (rowId === cell.cellHeader.rowID) {
              data.push(cell)
              break;
            }
          }
        }
      }
    }

    return data
  }

  /* 
    Starting from the root of a page
    Go through each page and return the list of data cell from all the leaf pages
  */
  async readDataFromMultiplePages(rootPageNumber, columns, pageSize) {
    const pagesToTraverse = [];
    const dataCells = [];

    /* 
      push the root page number in the tree
      We will keep on pushing the pages that are to be read in the btree
    */
    pagesToTraverse.push(rootPageNumber);

    while (pagesToTraverse.length !== 0) {
      // logger.info(`pages to traverse before starting while loop execution ${pagesToTraverse}`);

      /* 
        get the first element from the pages to read
      */
      const pageNumber = pagesToTraverse[0];
      const pageOffset = pageSize * (pageNumber - 1);

      await this.#databaseFile.seek(pageOffset);
      const page = await this.#parsePage(columns, pageOffset);

      // logger.info({
      //   readDataFromMultiplePage: page,
      // });

      /* 
        IF page type is interior, we will all the children pages pointers and
        add them to the array
        If the page type is leaf, we will read all the cells and put data in a array
      */
      if (page.pageHeader.pageType === BTREE_PAGE_TYPES.INTERIOR_TABLE_PAGE_TYPE) {
        const pagesToRead = page.cells.map((cell) => cell.leftChildPointer);
        pagesToTraverse.push(...pagesToRead);
      } else if (page.pageHeader.pageType === BTREE_PAGE_TYPES.LEAF_TABLE_PAGE_TYPE) {
        const dataCellsToRead = page.cells;
        dataCells.push(...dataCellsToRead);
      }

      // remove the page that have been read
      pagesToTraverse.shift();
    }

    return dataCells;
  }

  // /* TODO: delete  */
  // async getPage(tableName) {
  //   await this.#initializeDbFile();
  //   const firstPage = await this.getDBFirstPage();
  //   logger.info({ firstPage, tableName });

  //   const tableInfoRow = firstPage.cells.find((cell) => {
  //     const schemaTableName = cell.cellPayload.recordValuesFriendly.name;
  //     const schemaType = cell.cellPayload.recordValuesFriendly.type;
  //     return schemaTableName === tableName && schemaType === SCHEMA_TYPE.TABLE;
  //   });
  //   logger.info({ tableInfoRow });

  //   // if no table is found
  //   if (!tableInfoRow) {
  //     return new Error("No table found");
  //   }

  //   const tableRootPage = tableInfoRow.cellPayload.recordValuesFriendly.rootpage;
  //   const sql = tableInfoRow.cellPayload.recordValuesFriendly.sql;

  //   // Flaky logic to calculate number of columns in a table
  //   // const splittedStr = sql.split(',');
  //   // const numberOfColumns = splittedStr.length
  //   const columns = getColumnNames(sql);
  //   const numberOfColumns = columns.length;
  //   logger.info({ columns, numberOfColumns, sql });

  //   const pageSize = firstPage.dbHeader.dbPageSize;

  //   const offset = pageSize * (tableRootPage - 1);

  //   logger.info({
  //     tableRootPage,
  //     pageSize,
  //     sql,
  //     tableName,
  //     numberOfColumns,
  //     columns,
  //   });

  //   await this.#databaseFile.seek(offset);

  //   const page = await this.#parsePage(columns, offset);

  //   logger.info({
  //     page,
  //   });
  //   return page;
  // }
}
