/*
 * Basic Javascript helpers used in analytics.js and graphics code.
 */

module.exports = {
  classify: require("./classify"),
  COLORS: require("./colors"),
  formatStyle: require("./formatStyle"),
  fmtComma: require("./fmtComma"),
  getAPMonth: require("./getAPMonth"),
  getLocation: require("./getLocation"),
  getParameterByName: require("./getParameterByName"),
  isProduction: require("./isProduction"),
  lookupColor: require("./lookupColor"),
  makeTranslate: require("./makeTranslate"),
  nestStringProperties: require("./nestStringProperties"),
  parseNumber: require("./parseNumber"),
  urlToLocation: require("./urlToLocation"),
  wrapText: require("./wrapText")
};
