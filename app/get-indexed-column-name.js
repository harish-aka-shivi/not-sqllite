/* 
  Flaky logic to get the column name
  suppose the sql is 
  CREATE INDEX idx_users_name ON users(name)
  or 
  CREATE INDEX idx_macro_story_line on macro_story(line)


  Assuming that the index is simple and not composite without collations and other functions
*/
const getColumnNameFromIndex = (createIndexSqlStatement) => {
  const sql = createIndexSqlStatement.trim();

  const secondStr = sql.split('(');
  const columnName =secondStr[1].split(')')[0]

  return columnName;
};

export default getColumnNameFromIndex;
