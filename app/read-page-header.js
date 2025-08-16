import { BTREE_PAGE_TYPES } from "./constants.js";
import readInt from "./read-int.js";

// Reads a page header as mentioned here: https://www.sqlite.org/fileformat2.html#b_tree_pages
export default async function readPageHeader(databaseFile) {
  const pageType = await readInt(databaseFile, 1);
  const firstFreeBlockStart = await readInt(databaseFile, 2);
  const numberOfCells = await readInt(databaseFile, 2);
  const startOfContentArea = await readInt(databaseFile, 2);
  const fragmentedFreeBytes = await readInt(databaseFile, 1);

  /* 
    If its table interior page,
    we are reading the right most pointer also
    Interior index b-tree page = 2
    Interior Tree page = 5
    Leaf B-tree page = 10
    Leaf Table page = 13
  */
  let rightMostPointer;
  if (pageType === BTREE_PAGE_TYPES.INTERIOR_TABLE_PAGE_TYPE) {
    rightMostPointer = await readInt(databaseFile, 4);
  }

  return {
    pageType,
    firstFreeBlockStart,
    numberOfCells,
    startOfContentArea,
    fragmentedFreeBytes,
    rightMostPointer,
  };
}
