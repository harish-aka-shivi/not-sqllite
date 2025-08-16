//"CREATE TABLE apples\n(\n\tid integer primary key autoincrement,\n\tname text,\n\tcolor text\n)"
// Flaky logic to calculate number of columns in a table
const getColumnNames = (createTableSqlStatement) => {
  const sql = createTableSqlStatement.trim();

  const tokenizedArr = sql.split("(").map((i) => i.trim());
  const columnStrings = tokenizedArr[1].split(",");

  const columns = columnStrings.reduce((acc, item) => {
    const formattedColString = item.replace("\n", "");
    const columnName = formattedColString.trim().split(" ")[0];
    acc.push(columnName);
    return acc;
  }, []);

  return columns;
};

export default getColumnNames;
