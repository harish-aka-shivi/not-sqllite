const readBigInt128BE = (buffer, offset = 0) => {
  const high = buffer.readBigUInt64BE(offset); // Read first 8 bytes (high part)
  const low = buffer.readBigUInt64BE(offset + 8); // Read next 8 bytes (low part)

  return (high << BigInt(64)) + BigInt(low); // Combine into a single BigInt (128-bit)
};

const readBigInt160BE = (buffer, offset = 0) => {
  const high = readBigInt128BE(buffer, offset); // Read first 16 bytes (high part)
  const low = buffer.readIntBE(16, 4); // Read next 4 bytes

  return (high << BigInt(32)) + BigInt(low); // Combine into a single BigInt (160-bit)
};

export default async function readInt(databaseFile, sizeInBytes) {
  const buffer = await databaseFile.read(sizeInBytes);

  if (sizeInBytes === 1) {
    return buffer.readUInt8(0);
  } else if (sizeInBytes === 2) {
    return buffer.readUInt16BE(0);
  } else if (sizeInBytes <= 6) {
    return buffer.readIntBE(0, sizeInBytes);
  } else if (sizeInBytes === 8) {
    return buffer.readBigUInt64BE(0);
  } else if (sizeInBytes === 16) {
    return readBigInt128BE(buffer, 0);
  } else if (sizeInBytes === 20) {
    return readBigInt160BE(buffer, 0);
  } else {
    throw `Unhandled sizeInBytes: ${sizeInBytes}`;
  }
}
