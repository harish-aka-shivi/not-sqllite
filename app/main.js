import DBimpl from "./db-impl.js";
import logger from "./logger.js";

const databaseFilePath = process.argv[2];
const command = process.argv[3];

if (command === ".dbinfo") {
  const dbImpl = DBimpl.getInstance(databaseFilePath)
  const dbFirstPage = await dbImpl.getDBFirstPage()
  // You can use print statements as follows for debugging, they'll be visible when running tests.
  // console.log("Logs from your program will appear here!");
  // const pageSize = databaseFile.readUInt16BE(16); // page size is 2 bytes starting at offset 16
  console.log(`database page size: ${dbFirstPage.dbHeader.dbPageSize}`);

  // Uncomment this to pass the first stage
  console.log(`number of tables: ${dbFirstPage.cellPointers.length}`);

} else if (command === '.tables') {
  const dbImpl = DBimpl.getInstance(databaseFilePath)
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

  const dbImpl = DBimpl.getInstance(databaseFilePath)
  const page = await dbImpl.getPage(tableName)

  logger.info(page)

  console.log(page.pageHeader.numberOfCells)

  // Seek to this position
  // await data


} else if (command.toLowerCase().includes('select')) {
  // turn to lower case
  const lowerCaseCommand = command.toLowerCase().trim()

  // Tokenize on select
  const tokenizedArr = lowerCaseCommand.split('select')

  // get the string after select
  const selectionStr = tokenizedArr[1];

  // further split on 'from'
  const tokenizedOnFrom = selectionStr.split('from')
  
  // Get the values between Select and From
  // Should be columns generally
  const columnsStr = tokenizedOnFrom[0].trim();
  
  // Get the values after where
  const tokenizedOnWhere = tokenizedOnFrom[1].split('where')
  
  // Get the values between From and Where
  const table = tokenizedOnWhere[0].trim();

  let whereColumnName = '';
  let whereColumnValue = '';
  if (tokenizedOnWhere.length > 1) {
    const whereClauseStr = tokenizedOnWhere[1].trim();

    const tokenizedOnEqual = whereClauseStr.split('=')

    whereColumnName = tokenizedOnEqual?.[0]?.trim();
    whereColumnValue = tokenizedOnEqual?.[1]?.trim().replaceAll('\'', '')
  }

  const columns = columnsStr.split(',').map(i => i.trim())

  // const columnName = columns[0];

  const dbImpl = DBimpl.getInstance(databaseFilePath)

  // get the page based on table name
  // This will go to the schema table which stores the 
 // the root pages of all the tables in the DB
  
 
  // const page = await dbImpl.getPage(table)
  // logger.info(page)

  const tableDataCells = await dbImpl.readTable(table)

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
    tableDataCells
  })



  const columnNames = tableDataCells.reduce((acc,cell) => {  
    const values = columns.reduce((acc, col) => {
      const value = cell.cellPayload.recordValuesFriendly[col]
      const obj = {
        key: col,
        value,
      }
      acc.push(obj)
      return acc
    }, [])

    let toAdd = false;
    for (const obj of values) {
      if (!whereColumnName || !whereColumnValue) {
        toAdd = true
      }

      if (obj.key.trim().toLowerCase() === whereColumnName.trim().toLowerCase() 
        && obj.value.trim().toLowerCase() === whereColumnValue.trim().toLowerCase()) {
        toAdd = true
      }
    }
    
    if (toAdd) {
      acc.push(values.map(o => o.value))
    }
    return acc
  }, [])

 

  const output = columnNames.reduce((acc, columnsArr, index) => {
    const rowStr = columnsArr.reduce((accInternal, itemInternal, indexInternal) => {
      accInternal = `${accInternal}${itemInternal}`

      if (indexInternal < columnsArr.length - 1) {
        accInternal = `${accInternal}|`
      }

      return accInternal
    },'')

    acc = `${acc}${rowStr}`
    if (index < columnNames.length - 1) {
      acc = `${acc}\n`
    }
    return acc
  }, '')
  
  logger.info({output})
  console.log(output)
}

else {
  throw `Unknown command ${command}`;
}

