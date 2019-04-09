var pym = require("./lib/pym");
var ANALYTICS = require("./lib/analytics");
require("./lib/webfonts");

// Global vars
var pymChild = null;
var skipLabels = ["label", "values", "offset"];

var d3 = Object.assign(
  {},
  require("d3-format"),
  require("d3-scale"),
  require("d3-selection"),
  require("d3-jetpack")
);

var ƒ = d3.f;

var { COLORS, classify, processProps } = require("./lib/helpers");

// Initialize the graphic.
var onWindowLoaded = function() {
  formatData();
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

// Format graphic data for processing by D3.
var formatData = function() {
  DATA.forEach(d => {
    d.values = [];

    var x0 = 0;

    if ("offset" in d) {
      d.offset = +d.offset;
      x0 = d.offset;
    }

    var x0pos = x0,
      x0neg = x0;

    for (let key in d) {
      if (skipLabels.indexOf(key) > -1) {
        continue;
      }

      if (d[key] > 0) {
        var x1 = x0pos + d[key];

        d.values.push({
          name: key,
          x0: x0pos,
          x1,
          val: d[key]
        });

        x0pos = x1;
      } else if (d[key] < 0) {
        var x1 = x0neg + d[key];

        d.values.push({
          name: key,
          x0: x0neg,
          x1,
          val: d[key]
        });

        x0neg = x1;
      }
    }
  });
};

// Render the graphic(s). Called by pym with the container width.
var render = function() {
  // Render the chart!
  var container = "#stacked-bar-chart";
  var element = document.querySelector(container);
  var width = element.offsetWidth;

  var props = processProps(PROPS);

  var data = DATA.map(d => {
    Object.entries(props.columns).forEach(([key, val]) => {
      d[key] = d[val];
    });

    return d;
  });

  renderStackedBarChart({
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

// Render a stacked bar chart.
var renderStackedBarChart = function(config) {
  // Setup
  var { bar, labels, margin, values, x, xAxis } = config.props;

  // Calculate actual chart dimensions
  var chartWidth = config.width - margin.left - margin.right;
  var chartHeight = (bar.height + bar.gap) * config.data.length;

  // Clear existing graphic (for redraw)
  var containerElement = d3.select(config.container);
  containerElement.html("");

  var colorScale = d3
    .scaleOrdinal()
    .domain(
      Object.keys(config.data[0]).filter(d => skipLabels.indexOf(d) == -1)
    )
    .range([COLORS.teal3, COLORS.orange3, COLORS.blue3, "#ccc"]);

  // Render the legend.
  var legend = containerElement
    .append("ul.key")
    .appendMany("li", colorScale.domain())
    .attr("class", (d, i) => `key-item key-${i} ${classify(d)}`);

  legend.append("b").style("background-color", colorScale);

  legend.append("label").text(d => d);

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

  // Render grid to chart.
  if (xAxis.showGrid) {
    // Render grid to chart.
    var xAxisGrid = c.xAxis.tickSize(-c.height, 0, 0).tickFormat("");

    svg
      .append("g.x.grid")
      .translate([0, c.height])
      .call(xAxisGrid);
  }

  // Render bars to chart.
  var group = svg
    .appendMany("g.group", config.data)
    .attr("class", d => "group " + classify(d.label))
    .translate((d, i) => [0, i * (bar.height + bar.gap)]);

  group
    .appendMany("rect", ƒ("values"))
    .at({
      class: d => classify(d.name),
      height: bar.height,
      width: d => Math.abs(c.x(d.x1) - c.x(d.x0)),
      x: d => (d.x0 < d.x1 ? c.x(d.x0) : c.x(d.x1))
    })
    .st({ fill: d => colorScale(d.name) });

  // Render bar values.
  if (values.show) {
    group
      .append("g.value")
      .appendMany("text", d => d.values)
      .text(d => d3.format(values.format)(d.val))
      .attr("class", d => classify(d.name))
      .at({
        x: d => c.x(d.x1),
        dy: bar.height / 2 + 4
      })
      .attr("dx", function(d) {
        var textWidth = this.getComputedTextLength();
        var barWidth = Math.abs(c.x(d.x1) - c.x(d.x0));

        // Hide labels that don't fit
        if (textWidth + values.gap * 2 > barWidth) {
          d3.select(this).classed("hidden", true);
        }

        if (d.x1 < 0) {
          return values.gap;
        }

        return -(values.gap + textWidth);
      });
  }

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
    .st({
      width: labels.width,
      top: margin.top,
      left: 0
    })
    .appendMany("li", config.data)
    .st({
      width: labels.width,
      height: bar.height,
      left: 0,
      top: (d, i) => i * (bar.height + bar.gap)
    })
    .at({ class: d => classify(d.label) })
    .append("span")
    .text(ƒ("label"));
};

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
