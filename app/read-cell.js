import readRecord from "./read-record.js";
import readVarint from "./read-varint.js";
import logger from "./logger.js";
import { BTREE_PAGE_TYPES, getPageTypeFriendly, isPageTypeTable } from "./constants.js";
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
  // logger.info({ cellPointer, pointerOffset, "cellPointer + pointerOffset": cellPointer + pointerOffset }, `seeking to`);
  /*
    Go to cell pointer as they are stored at the end
  */
  await databaseFile.seek(pointerOffset + cellPointer);

  // logger.info("read cell called");
  // logger.info({
  //   cellPointer,
  //   pointerOffset,
  //   numberOfColumns,
  //   columns,
  //   pageType,
  // });

  if (isPageTypeTable(pageType)) {
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

        // logger.info({
        //   cell,
        //   pageType: getPageTypeFriendly(pageType)
        // });

        return cell;

      } else {
        /* 
          Number of bytes in payload
        */
        const numOfBytesInPayload = await readVarint(databaseFile);

        /* 
          If we have defined the ID alias, this is stored here instead of stored in payload(Gotcha)
        */
        const rowID = await readVarint(databaseFile); // Rowid

        const recordData = await readRecord(databaseFile);

        const { recordValues: record } = recordData;

        const sqlSchemaRowFriendly = columns.reduce((acc, columnName, index) => {
          /* 
            SQLite handle the column name created using INTEGER PRIMARY AUTOINCREMENT differently
            It does not store that in the payload but separately as row_id
            Handling this special case. Its little flaky because it will break if ID is different
          */
          if (columnName.toLowerCase() === "id") {
            acc[columnName] = rowID;
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

        // logger.info({ numOfBytesInPayload, rowID, recordData, cell, pageType: getPageTypeFriendly(pageType) });

        return cell;
      }
  } else {
    let leftChildPointer = null;
    if (pageType === BTREE_PAGE_TYPES.INTERIOR_INDEX_PAGE_TYPE) {
        leftChildPointer = await readInt(databaseFile, 4);
    }

    /* 
      Number of bytes in payload
    */
    const numOfBytesInPayload = await readVarint(databaseFile);

    const recordData = await readRecord(databaseFile);

    const { recordValues: record } = recordData;

    // logger.info({
    //   record,
    //   pageType: getPageTypeFriendly(pageType)
    // })

    // Index cell payload also contains the 
    // rowID along with the column being index
    // so if column index is = 'company'
    // the cell payload will have 2 values; second one being the rowID for that column
    const sqlSchemaRowFriendly = columns.reduce((acc, columnName, index) => {
      acc[columnName] = record[index];
      return acc;
    }, {});
    // Last value is rowID
    sqlSchemaRowFriendly['rowID'] = record[record.length - 1]

    const cell = {
      cellPointer,
      cellHeader: {
        leftChildPointer,
        numOfBytesInPayload,
      },
      cellPayload: {
        ...recordData,
        recordValuesFriendly: sqlSchemaRowFriendly,
      },
    };

    // logger.info({ numOfBytesInPayload, recordData, cell, pageType: getPageTypeFriendly(pageType) });

    return cell;
  }

  
}
