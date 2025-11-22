export const BTREE_PAGE_TYPES = {
  INTERIOR_TABLE_PAGE_TYPE: 5,
  LEAF_TABLE_PAGE_TYPE: 13,
  INTERIOR_INDEX_PAGE_TYPE: 2,
  LEAF_INDEX_PAGE_TYPE: 10,
};

export const SCHEMA_TYPE = {
  TABLE: "table",
  INDEX: "index",
  VIEW: "view",
  TRIGGER: "trigger",
};

export const getPageTypeFriendly = (pageType) => {
  if (pageType === BTREE_PAGE_TYPES.INTERIOR_INDEX_PAGE_TYPE) {
    return 'Interior Index Page Type'
  } else if (pageType === BTREE_PAGE_TYPES.LEAF_INDEX_PAGE_TYPE) {
    return 'Leaf Index Page Type'
  } else if (pageType === BTREE_PAGE_TYPES.INTERIOR_TABLE_PAGE_TYPE) {
    return 'Interior Table Page Type'
  } else if (pageType === BTREE_PAGE_TYPES.LEAF_TABLE_PAGE_TYPE) {
    return 'Leaf Table Page Type'
  }
}

export const SCHEMA_TABLE_COLUMNS = ["type", "name", "tbl_name", "rootpage", "sql"];

export const isPageTypeTable = (pageType) => {
  return pageType === BTREE_PAGE_TYPES.LEAF_TABLE_PAGE_TYPE 
  || pageType === BTREE_PAGE_TYPES.INTERIOR_TABLE_PAGE_TYPE
}

export const isPageTypeIndex = () => {
  return pageType === BTREE_PAGE_TYPES.LEAF_INDEX_PAGE_TYPE 
  || pageType === BTREE_PAGE_TYPES.INTERIOR_INDEX_PAGE_TYPE
}