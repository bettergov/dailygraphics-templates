// Global vars
var pym = require("./lib/pym");
var ANALYTICS = require("./lib/analytics");
require("./lib/webfonts");

var pymChild;

const {
  classify,
  lookupColor,
  parseNumber,
  processProps
} = require("./lib/helpers");

var d3 = Object.assign(
  {},
  require("d3-format"),
  require("d3-selection"),
  require("d3-jetpack")
);

// Initialize the graphic.
var onWindowLoaded = function() {
  render();

  window.addEventListener("resize", render);

  pym.then(child => {
    pymChild = child;
    child.sendHeight();

    pymChild.onMessage("on-screen", function(bucket) {
      ANALYTICS.trackEvent("on-screen", bucket);
    });
    pymChild.onMessage("scroll-depth", function(data) {
      data = JSON.parse(data);
      ANALYTICS.trackEvent("scroll-depth", data.percent, data.seconds);
    });
  });
};

// Render the graphic(s). Called by pym with the container width.
var render = function() {
  // Render the chart!
  var container = "#bar-chart";
  var element = document.querySelector(container);
  var width = element.offsetWidth;

  var props = processProps(PROPS);

  // Parse data.
  var data = DATA.map(d => {
    d[props.columns.value] = parseNumber(d[props.columns.value]);
    return d;
  }).map(d => {
    Object.entries(props.columns).forEach(([key, val]) => {
      d[key] = d[val];
    });

    return d;
  });

  renderBarChart({
    container,
    width,
    data,
    props
  });

  // Update iframe
  if (pymChild) {
    pymChild.sendHeight();
  }
};

// Render a bar chart.
var renderBarChart = function(config) {
  // Setup
  var { bar, labels, margin, show, values, x, xAxis } = config.props;

  // Calculate actual chart dimensions
  var chartWidth = config.width - margin.left - margin.right;
  var chartHeight = bar.gap + (bar.height + bar.gap) * config.data.length;

  // Clear existing graphic (for redraw)
  var containerElement = d3.select(config.container);
  containerElement.html("");

  // Create the root SVG element.
  var chartWrapper = containerElement.append("div.graphic-wrapper");

  // Create svg using d3-jetpack/conventions
  // https://github.com/gka/d3-jetpack
  const c = d3.conventions({
    sel: chartWrapper,
    width: chartWidth,
    height: chartHeight,
    margin,
    yAxis: () => null
  });

  const { svg } = c;
  c.x.domain(x.domain);

  // Render axes to chart.
  if (xAxis.show) {
    c.xAxis.ticks(xAxis.ticks).tickFormat(d => d3.format(values.format)(d));
    d3.drawAxis(c);
  }

  if (xAxis.showGrid) {
    // Render grid to chart.
    var xAxisGrid = c.xAxis.tickSize(-c.height, 0, 0).tickFormat("");

    svg
      .append("g.x.grid")
      .translate([0, c.height])
      .call(xAxisGrid);
  }

  //Render bars to chart.
  svg
    .append("g.bars")
    .appendMany("rect", config.data)
    .at({
      x: d => (d.value >= 0 ? c.x(0) : c.x(d.value)),
      y: (d, i) => bar.gap + i * (bar.height + bar.gap),
      height: bar.height,
      width: d => Math.abs(c.x(0) - c.x(d.value))
    })
    .st({
      fill: d => lookupColor(d.fill)
    })
    .attr("class", (d, i) => `bar-${i} ${classify(d.label)}`);

  // Render 0-line.
  if (c.x.domain()[0] <= 0) {
    svg.append("line.zero-line").at({
      x1: c.x(0),
      x2: c.x(0),
      y1: 0,
      y2: c.height
    });
  }

  // Render bar labels.
  chartWrapper
    .append("ul.labels")
    .st({ width: labels.width, top: margin.top, left: 0 })
    .appendMany("li", config.data)
    .st({
      width: labels.width,
      height: bar.height,
      left: 0,
      top: (d, i) => bar.gap + i * (bar.height + bar.gap)
    })
    .attr("class", d => classify(d.label))
    .append("span")
    .text(d => d.label);

  // Render bar values.
  if (values.show) {
    svg
      .append("g.value")
      .appendMany("text", config.data)
      .text(d => {
        var text = d3.format(values.format)(d.value);
        if ("valuePrefix" in d) {
          text = d.valuePrefix + text;
        }
        if ("valueSuffix" in d) {
          text += d.valueSuffix;
        }
        return text;
      })
      .at({
        x: d => c.x(d.value),
        y: (d, i) => bar.gap + i * (bar.height + bar.gap),
        dy: bar.height / 2 + 3
      })
      .attr("dx", function(d) {
        var xStart = c.x(d.value);
        var textWidth = this.getComputedTextLength();

        // Negative case
        if (d.value < 0) {
          var outsideOffset = -(values.gap + textWidth);

          if (xStart + outsideOffset < 0) {
            d3.select(this).classed("in", true);
            return values.gap;
          } else {
            d3.select(this).classed("out", true);
            return outsideOffset;
          }
          // Positive case
        } else {
          if (xStart + values.gap + textWidth > chartWidth) {
            d3.select(this).classed("in", true);
            return -(values.gap + textWidth);
          } else {
            d3.select(this).classed("out", true);
            return values.gap;
          }
        }
      });
  }
};

// Initially load the graphic
window.onload = onWindowLoaded;
