import DatabaseFile from "./app/database-file.js";

const file = new DatabaseFile('test.txt')
await file.open()
await file.seek(5)
console.log((await file.read(5)).toLocaleString())