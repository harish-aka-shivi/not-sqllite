import readRecord from "./read-record.js";
import readVarint from "./read-varint.js";
import logger from "./logger.js";
import { BTREE_PAGE_TYPES } from "./constants.js";
import readInt from "./read-int.js";

/* 
  Function to read the cell in. Probably we can reduce the number of args, especially numberOfColumns and columns
  A cell mean a table row
*/
export default async function readCell({
  databaseFile,
  cellPointer,
  pointerOffset,
  numberOfColumns,
  columns,
  pageType,
}) {
  logger.info({ cellPointer, pointerOffset, "cellPointer + pointerOffset": cellPointer + pointerOffset }, `seeking to`);
  /*
    Go to cell pointer as they are stored at the end
  */
  await databaseFile.seek(pointerOffset + cellPointer);

  logger.info("read cell called");
  logger.info({
    cellPointer,
    pointerOffset,
    numberOfColumns,
    columns,
    pageType,
  });

  if (pageType === BTREE_PAGE_TYPES.INTERIOR_TABLE_PAGE_TYPE) {
    const leftChildPointer = await readInt(databaseFile, 4);
    const rowID = await readVarint(databaseFile);
    /* 
      On case page is interior table page
      It only contains cell pointers to next level page,
      so we return
    */
    const cell = {
      leftChildPointer,
      rowID,
    };

    logger.info({
      cell
    })

    return cell;
  } else {
    /* 
      Number of bytes in payload
    */
    const numOfBytesInPayload = await readVarint(databaseFile);
    /* 
      This is auto generated 
      If we have defined the ID alias, this is stored here instead of RowID
    */
    const rowID = await readVarint(databaseFile); // Rowid

    const recordData = await readRecord(databaseFile, numberOfColumns);

    logger.info({ numOfBytesInPayload, rowID, recordData });

    const { recordValues: record } = recordData;

    const sqlSchemaRowFriendly = columns.reduce((acc, columnName, index) => {
      /* 
        SQLite handle the column name created using INTEGER PRIMARY AUTOINCREMENT differently
        It does not store that in the payload but separately as row_id
        Handling this special case. Its little flaky because it will break if 
      */
      if (columnName.toLowerCase() === 'id') {
        acc[columnName] = rowID
      } else {
        acc[columnName] = record[index];
      }
      return acc;
    }, {});

    const cell = {
      cellPointer,
      cellHeader: {
        numOfBytesInPayload,
        rowID,
      },
      cellPayload: {
        ...recordData,
        recordValuesFriendly: sqlSchemaRowFriendly,
      },
    };

    return cell;
  }
}
