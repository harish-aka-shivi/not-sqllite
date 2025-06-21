import readInt from "./read-int.js";
import readVarint from "./read-varint.js";
import readDouble from "./read-double.js";
import logger from "./logger.js";

// Reads SQLite's "Record Format" as mentioned here: https://www.sqlite.org/fileformat.html#record_format
export default async function readRecord(databaseFile, numberOfValues) {
  const bytesInHeader = await readVarint(databaseFile); // number of bytes in header

  const serialTypes = [];

  for (let i = 0; i < numberOfValues; i++) {
    serialTypes.push(await readVarint(databaseFile));
  }

  const recordValues = [];
  // console.log({
  //   serialTypes,
  //   bytesInHeader
  // })

  for (const serialType of serialTypes) {
    recordValues.push(await readRecordValue(databaseFile, serialType));
  }

  // logger.info({recordValues, serialTypes, bytesInHeader, numberOfValues})


  
  return {
    recordHeader: {
      bytesInHeader,
      serialTypes
    },
    recordValues
  }
 

  // return recordValues;
}

async function readRecordValue(databaseFile, serialType) {
  if (serialType >= 13 && serialType % 2 === 1) {
    // Text encoding
    const numberOfBytes = (serialType - 13) / 2;
    return (await databaseFile.read(numberOfBytes)).toString("utf-8");
  } 
  else if (serialType >= 12 && serialType % 2 === 0) {
    const numberOfBytes = (serialType - 12) / 2
    return (await databaseFile.read(numberOfBytes)).toString('utf-8')
  } 
  else if (serialType === 0) {
    return null
  } else if (serialType === 1) {
    // 8-bit twos-complement integer
    return await readInt(databaseFile, 1);
  } else if (serialType === 2) {
    // 16-bit twos-complement integer
    return await readInt(databaseFile, 2);
  } else if (serialType === 3) {
    // 24-bit twos-complement integer
    return await readInt(databaseFile, 3);
  } else if (serialType === 4) {
    // 32-bit twos-complement integer
    return await readInt(databaseFile, 4);
  } else if (serialType === 5) {
    // 48-bit twos-complement integer
    return await readInt(databaseFile, 6);
  } else if (serialType === 6) {
    // 64-bit twos-complement integer
    return await readInt(databaseFile, 8);
  } else if (serialType === 7) {
    // 64-bit floating point number
    return await readDouble(databaseFile);
  } else if (serialType === 8) {
    // value is 0
    return 0
  } else if (serialType === 9) {
    // value is 1
    return 1
  } else {
    throw `Unhandled serialType: ${serialType}`;
  }
}
