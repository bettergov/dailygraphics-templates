var pym = require("./lib/pym");
var ANALYTICS = require("./lib/analytics");
require("./lib/webfonts");

var pymChild;
var skipLabels = ["Group", "key", "values"];

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
    pymChild.sendHeight();

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
  DATA.forEach(function(d) {
    d.key = d.Group;
    d.values = [];

    Object.keys(d).forEach(function(k) {
      var v = d[k];
      if (skipLabels.indexOf(k) > -1) {
        return;
      }

      d.values.push({ label: k, amt: +v });
      delete d[k];
    });

    delete d.Group;
  });
};

// Render the graphic(s). Called by pym with the container width.
var render = function() {
  // Render the chart!
  var container = "#grouped-bar-chart";
  var element = document.querySelector(container);
  var width = element.offsetWidth;

  var props = processProps(PROPS);

  renderGroupedBarChart({
    container,
    width,
    props,
    data: DATA
  });

  // Update iframe
  if (pymChild) {
    pymChild.sendHeight();
  }
};

// Render a bar chart.
var renderGroupedBarChart = function(config) {
  var { bar, group, labels, margin, values, x, xAxis } = config.props;

  // Setup chart container.
  var labelColumn = "label";
  var valueColumn = "amt";

  // Calculate actual chart dimensions
  var chartWidth = config.width - margin.left - margin.right;
  var chartHeight =
    ((bar.height + bar.gapInner) * group.numBars - bar.gapInner + bar.gap) *
      group.numTotal -
    bar.gap +
    bar.gapInner;

  // Clear existing graphic (for redraw)
  var containerElement = d3.select(config.container);
  containerElement.html("");

  // Create D3 scale objects.
  var colorScale = d3
    .scaleOrdinal()
    .domain(
      Object.keys(config.data[0].values).filter(
        d => skipLabels.indexOf(d) == -1
      )
    )
    .range([COLORS.teal3, COLORS.teal5]);

  // Render a color legend.
  var legend = containerElement
    .append("ul.key")
    .appendMany("li", config.data[0].values)
    .attr("class", function(d, i) {
      return "key-item key-" + i + " " + classify(d.label);
    });

  legend.append("b").style("background-color", d => colorScale(d.label));

  legend.append("label").text(d => d.label);

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
    c.xAxis
      .ticks(xAxis.ticks)
      .tickFormat(d => d3.format(values.format)(d / 100));
    d3.drawAxis(c);
  }

  // Render grid to chart.
  if (xAxis.showGrid) {
    var xAxisGrid = c.xAxis.tickSize(-c.height, 0, 0).tickFormat("");

    svg
      .append("g.x.grid")
      .translate([0, c.height])
      .call(xAxisGrid);
  }

  // Render bars to chart.
  var barGroups = svg
    .appendMany("g.bars", config.data)
    .translate((d, i) => [0, i ? (group.height + bar.gap) * i : 0]);

  barGroups
    .appendMany("rect", ƒ("values"))
    .attr("x", d => (d[valueColumn] >= 0 ? c.x(0) : c.x(d[valueColumn])))
    .attr("y", (d, i) => (i ? bar.height * i + bar.gapInner * i : 0))
    .attr("width", d => Math.abs(c.x(0) - c.x(d[valueColumn])))
    .attr("height", bar.height)
    .style("fill", d => colorScale(d.label))
    .attr("class", d => "y-" + d.label);

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
      width: labels.width - 10,
      height: bar.height,
      left: 0,
      top: (d, i) => (group.height + bar.gap) * i
    })
    .attr("class", d => classify(d.key))
    .append("span")
    .text(d => d.key);

  // Render bar values.
  barGroups
    .append("g.value")
    .appendMany("text", ƒ("values"))
    .text(function(d) {
      var v = d[valueColumn].toFixed(0);

      if (d[valueColumn] > 0 && v == 0) {
        v = "<1";
      }

      return v + "%";
    })
    .at({
      x: d => c.x(d[valueColumn]),
      y: (d, i) => (i ? bar.height * i + bar.gapInner : 0)
    })
    .attr("dx", function(d) {
      var xStart = c.x(d[valueColumn]);
      var textWidth = this.getComputedTextLength();

      // Negative case
      if (d[valueColumn] < 0) {
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
    })
    .attr("dy", bar.height / 2 + 4);
};

/*
 * Initially load the graphic
 * (NB: Use window.load to ensure all images have loaded)
 */
window.onload = onWindowLoaded;
