module.exports = obj => {
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
