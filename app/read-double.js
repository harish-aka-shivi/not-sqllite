export default async function readDouble(databaseFile) {
  const buffer = await databaseFile.read(8);
  return buffer.writeDoubleBE(0);
}
