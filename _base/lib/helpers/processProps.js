var { isMobile } = require("../breakpoints");
var { flow, mapValues, omitBy } = require("lodash/fp");
var parseNumber = require("./parseNumber");

const nestStringProperties = obj => {
  if (!obj) {
    return {};
  }

  const isPlainObject = obj => !!obj && obj.constructor === {}.constructor;

  const getNestedObject = obj =>
    Object.entries(obj).reduce((result, [prop, val]) => {
      prop.split(".").reduce((nestedResult, prop, propIndex, propArray) => {
        const lastProp = propIndex === propArray.length - 1;
        if (lastProp) {
          nestedResult[prop] = isPlainObject(val) ? getNestedObject(val) : val;
        } else {
          nestedResult[prop] = nestedResult[prop] || {};
        }
        return nestedResult[prop];
      }, result);
      return result;
    }, {});

  return getNestedObject(obj);
};

const parseValue = d => {
  switch (d.type) {
    case "number":
      return parseNumber(d.use_value);
    default:
      return d.use_value;
  }
};

const loadMobile = d => {
  if (d.value_mobile && isMobile.matches) {
    d.use_value = d.value_mobile;
  } else {
    d.use_value = d.value;
  }

  return d;
};

module.exports = props =>
  flow(
    mapValues(loadMobile),
    mapValues(parseValue),
    omitBy(d => d == null),
    nestStringProperties
  )(props);
