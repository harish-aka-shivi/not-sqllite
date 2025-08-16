import readRecord from "./read-record.js";
import readVarint from "./read-varint.js";
import logger from "./logger.js";
import { BTREE_PAGE_TYPES } from "./constants.js";
import readInt from "./read-int.js";

// Function to read the cell in. Probably we can reduce the number of args, especially numberOfColumns and columns
export default async function readCell({
  databaseFile,
  cellPointer,
  pointerOffset,
  numberOfColumns,
  columns,
  pageType,
}) {
  logger.info({ cellPointer, pointerOffset, "cellPointer + pointerOffset": cellPointer + pointerOffset }, `seeking to`);
  // Go to cell pointer as they are stored at the end
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

    logger.info({
      leftChildPointer,
      rowID,
    });

    // in case page is interior table page
    // It only contains cell pointers to next level page
    const cell = {
      leftChildPointer,
      rowID,
    };

    return cell;
  } else {
    // Number of bytes in payload
    const numOfBytesInPayload = await readVarint(databaseFile);
    const rowID = await readVarint(databaseFile); // Rowid

    logger.info({ rowID, numOfBytesInPayload });

    const recordData = await readRecord(databaseFile, numberOfColumns);

    logger.info({ recordData });

    const { recordValues: record } = recordData;

    const sqlSchemaRowFriendly = columns.reduce((acc, item, index) => {
      acc[item] = record[index];
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
