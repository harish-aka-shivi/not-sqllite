import DBimpl from "./db-impl.js";
import logger from "./logger.js";

const databaseFilePath = process.argv[2];
const command = process.argv[3];

if (command === ".dbinfo") {
  const dbImpl = DBimpl.getInstance(databaseFilePath);
  const dbFirstPage = await dbImpl.getDBFirstPage();

  console.log(`database page size: ${dbFirstPage.dbHeader.dbPageSize}`);

  console.log(`number of tables: ${dbFirstPage.cellPointers.length}`);
} else if (command === ".tables") {
  const dbImpl = DBimpl.getInstance(databaseFilePath);
  const dbFirstPage = await dbImpl.getDBFirstPage();

  logger.info(dbFirstPage);

  console.log(
    dbFirstPage.cells.reduce((acc, cell, index) => {
      const tableName = cell.cellPayload.recordValuesFriendly.name;
      if (index === 0) {
        return tableName;
      }
      return `${acc} ${tableName}`;
    }, ""),
  );
} else if (command.toLowerCase().includes("count(*)")) {
  const tokenizedArr = command.trim().split(" ");
  const tableName = tokenizedArr[tokenizedArr.length - 1];

  const dbImpl = DBimpl.getInstance(databaseFilePath);
  const page = await dbImpl.readTable(tableName);

  logger.info(page);

  console.log(page.pageHeader.numberOfCells);
} else if (command.toLowerCase().includes("select")) {
  // turn to lower case
  const lowerCaseCommand = command.toLowerCase().trim();

  // Tokenize on select
  const tokenizedArr = lowerCaseCommand.split("select");

  // get the string after select
  const selectionStr = tokenizedArr[1];

  // further split on 'from'
  const tokenizedOnFrom = selectionStr.split("from");

  // Get the values between Select and From
  // Should be columns generally
  const columnsStr = tokenizedOnFrom[0].trim();

  // Get the values after where
  const tokenizedOnWhere = tokenizedOnFrom[1].split("where");

  // Get the values between From and Where
  const table = tokenizedOnWhere[0].trim();

  let whereColumnName = "";
  let whereColumnValue = "";
  if (tokenizedOnWhere.length > 1) {
    const whereClauseStr = tokenizedOnWhere[1].trim();

    const tokenizedOnEqual = whereClauseStr.split("=");

    whereColumnName = tokenizedOnEqual?.[0]?.trim();
    whereColumnValue = tokenizedOnEqual?.[1]?.trim().replaceAll("'", "");
  }

  const columns = columnsStr.split(",").map((i) => i.trim());

  const dbImpl = DBimpl.getInstance(databaseFilePath);

  const indexInfo = await dbImpl.getIndexRootPage(table, whereColumnName)


  if(indexInfo) {
    // read data using index
    const { indexedColumnName, rootPage } = indexInfo

    logger.info({
      indexInfo
    })
    
    const data = await dbImpl.readDataUsingIndex({rootPageNumber: rootPage, whereColumnName: indexedColumnName, 
      whereColumnValue})
    
    
    return;
  }

  /* 
    Get the page based on table name
    This will go to the schema table which stores the
    the root pages of all the tables in the DB.
    This fetches all the pages and read the db
  */
  const tableDataCells = await dbImpl.readTable(table);

  logger.info({
    table,
    columns,
    whereColumnName,
    whereColumnValue,
    tokenizedArr,
    tokenizedOnFrom,
    tokenizedOnWhere,
    columnsStr,
    command,
    tableDataCells,
  });

  // Get all the table rows
  const tableRows = tableDataCells.map((cellData) => cellData.cellPayload.recordValuesFriendly);

  let filteredRows = tableRows;

  /* 
    If there is a where clause
    filter that data based on these values
  */
  if (whereColumnName && whereColumnValue) {
    filteredRows = tableRows.filter((row) => {
      const rowValue = row[whereColumnName.trim()];
      if (rowValue) {
        if (rowValue.trim().toLowerCase() === whereColumnValue.trim().toLowerCase()) {
          return true;
        }
      }
      return false;
    });
  }

  /* 
    Select the columns that are requested
    If the user has passed '*', that means return all the columns values

    return [[row1_column1_value, row1_column2_value], [row2_column1_value, row2_column2_value]]

  */
  const filteredRowsWithRequiredColumnsValues = filteredRows.reduce((acc, row) => {
    const requiredColumnsValues = [];

    columns.forEach((col) => {
      if (col.trim() === "*") {
        requiredColumnsValues.push(...Object.values(row));
      } else {
        requiredColumnsValues.push(row[col]);
      }
    });
    acc.push(requiredColumnsValues);
    return acc;
  }, []);

  /* 
    Concats the values like below

    row1_column1_value | row1_column2_value
    row2_column1_value | row2_column2_value
  */
  const output = filteredRowsWithRequiredColumnsValues.reduce((acc, columnsArr, index) => {
    const rowStr = columnsArr.reduce((accInternal, itemInternal, indexInternal) => {
      accInternal = `${accInternal}${itemInternal}`;

      if (indexInternal < columnsArr.length - 1) {
        accInternal = `${accInternal}|`;
      }

      return accInternal;
    }, "");

    acc = `${acc}${rowStr}`;
    if (index < filteredRowsWithRequiredColumnsValues.length - 1) {
      acc = `${acc}\n`;
    }
    return acc;
  }, "");

  logger.info({ output });
  console.log(output);
} else {
  throw `Unknown command ${command}`;
}
