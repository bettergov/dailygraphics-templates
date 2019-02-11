module.exports = inputVal => {
  var value;
  if (Number.isFinite(+inputVal)) {
    value = +inputVal;
  } else if (typeof inputVal === "string" && inputVal.includes("%")) {
    value = parseFloat(d[valueColumn]) / 100;
  } else if (typeof inputVal === "string" && inputVal.includes("$")) {
    value = parseFloat(inputVal.replace(/[$,]+/g, ""));
  }
  return value;
};
