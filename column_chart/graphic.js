var pym = require("./lib/pym");
var ANALYTICS = require("./lib/analytics");
require("./lib/webfonts");
var { isMobile } = require("./lib/breakpoints");
var { flow, mapValues, omitBy, forEach } = require("lodash/fp");

// Global vars
var pymChild = null;

var d3 = Object.assign(
  {},
  require("d3-axis"),
  require("d3-format"),
  require("d3-scale"),
  require("d3-selection")
);

var {
  COLORS,
  makeTranslate,
  lookupColor,
  parseNumber
} = require("./lib/helpers");

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
var render = function(containerWidth) {
  // Render the chart!
  var container = "#column-chart";
  var element = document.querySelector(container);
  var width = element.offsetWidth;

  const parseValue = d => {
    switch (d.type) {
      case "number":
        return parseNumber(d.value);
      default:
        return d.value;
    }
  };

  var props = flow(
    mapValues(parseValue),
    omitBy(d => d == null)
  )(PROPS);

  renderColumnChart({
    container,
    width,
    data: DATA,
    props
  });

  // Update iframe
  if (pymChild) {
    pymChild.sendHeight();
  }
};

// Render a column chart.
var renderColumnChart = function(config) {
  var {
    /* data refs */
    labelColumn,
    valueColumn,
    /* labels */
    valueGap,
    xAxisFormat = "",
    yAxisFormat = "",
    valueFormat = "",
    showColumnValues,
    /* x axis */
    xScalePaddingInner,
    xScalePaddingOuter,
    xScaleAlign,
    showXAxisTop,
    showXAxisBottom,
    /* y axis */
    ticksY,
    roundTicksFactor,
    yMin,
    yMax,
    showYAxisLeft,
    showYAxisRight,
    showYAxisGrid,
    /* margins */
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    maxChartHeight = 9999
  } = config.props;
  // Setup chart container

  var aspectWidth = isMobile.matches ? 4 : 16;
  var aspectHeight = isMobile.matches ? 3 : 9;

  var margins = {
    top: marginTop,
    right: marginRight,
    bottom: marginBottom,
    left: marginLeft
  };

  // Calculate actual chart dimensions
  var chartWidth = config.width - margins.left - margins.right;
  var chartHeight =
    Math.ceil((config.width * aspectHeight) / aspectWidth) -
    margins.top -
    margins.bottom;

  chartHeight = Math.min(chartHeight, maxChartHeight);

  // Clear existing graphic (for redraw)
  var containerElement = d3.select(config.container);
  containerElement.html("");

  // Create the root SVG element.
  var chartWrapper = containerElement
    .append("div")
    .attr("class", "graphic-wrapper");

  var chartElement = chartWrapper
    .append("svg")
    .attr("width", chartWidth + margins.left + margins.right)
    .attr("height", chartHeight + margins.top + margins.bottom)
    .append("g")
    .attr("transform", "translate(" + margins.left + "," + margins.top + ")");

  // Create D3 scale objects.
  var xScale = d3
    .scaleBand()
    .range([0, chartWidth])
    .round(true)
    .paddingInner(xScalePaddingInner)
    .paddingOuter(xScalePaddingOuter)
    .align(xScaleAlign)
    .domain(
      config.data.map(function(d) {
        return d[labelColumn];
      })
    );

  var yScale = d3
    .scaleLinear()
    .domain([yMin, yMax])
    .range([chartHeight, 0]);

  // Create D3 axes.
  if (showXAxisBottom) {
    var xAxisBottom = d3
      .axisBottom()
      .scale(xScale)
      .tickFormat(function(d, i) {
        return d3.format(xAxisFormat)(d);
      });

    chartElement
      .append("g")
      .attr("class", "x axis bottom")
      .attr("transform", makeTranslate(0, chartHeight))
      .call(xAxisBottom);
  }

  if (showXAxisTop) {
    var xAxisTop = d3
      .axisTop()
      .scale(xScale)
      .tickFormat(function(d, i) {
        return d3.format(xAxisFormat)(d);
      });

    chartElement
      .append("g")
      .attr("class", "x axis top")
      .call(xAxisTop);
  }

  if (showYAxisLeft) {
    var yAxisLeft = d3
      .axisLeft()
      .scale(yScale)
      .ticks(ticksY)
      .tickFormat(function(d) {
        return d3.format(yAxisFormat)(d);
      });

    chartElement
      .append("g")
      .attr("class", "y axis left")
      .call(yAxisLeft);
  }

  if (showYAxisRight) {
    var yAxisRight = d3
      .axisRight()
      .scale(yScale)
      .ticks(ticksY)
      .tickFormat(function(d) {
        return d3.format(yAxisFormat)(d);
      });

    chartElement
      .append("g")
      .attr("class", "y axis right")
      .attr("transform", makeTranslate(chartWidth, 0))
      .call(yAxisRight);
  }

  // Render grid to chart.
  if (showYAxisGrid) {
    var yAxisGrid = d3
      .axisLeft()
      .scale(yScale)
      .ticks(ticksY)
      .tickSize(-chartWidth, 0)
      .tickFormat("");

    chartElement
      .append("g")
      .attr("class", "y grid")
      .call(yAxisGrid);
  }

  // Render bars to chart.
  chartElement
    .append("g")
    .attr("class", "bars")
    .selectAll("rect")
    .data(config.data)
    .enter()
    .append("rect")
    .attr("x", function(d) {
      return xScale(d[labelColumn]);
    })
    .attr("y", function(d) {
      if (d[valueColumn] < 0) {
        return yScale(0);
      }

      return yScale(d[valueColumn]);
    })
    .attr("width", xScale.bandwidth())
    .attr("height", function(d) {
      return Math.abs(yScale(0) - yScale(d[valueColumn]));
    })
    .attr("class", function(d) {
      return "bar bar-" + d[labelColumn];
    })
    .attr("fill", d => lookupColor(d.fill));

  // Render 0 value line.
  chartElement
    .append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", chartWidth)
    .attr("y1", yScale(0))
    .attr("y2", yScale(0));

  // Render bar values.
  if (showColumnValues) {
    chartElement
      .append("g")
      .attr("class", "value")
      .selectAll("text")
      .data(config.data)
      .enter()
      .append("text")
      .text(function(d) {
        return d3.format(valueFormat)(d[valueColumn]);
      })
      .attr("x", function(d, i) {
        return xScale(d[labelColumn]) + xScale.bandwidth() / 2;
      })
      .attr("y", function(d) {
        return yScale(d[valueColumn]);
      })
      .attr("dy", function(d) {
        var textHeight = d3
          .select(this)
          .node()
          .getBBox().height;
        var barHeight = Math.abs(yScale(d[valueColumn]) - yScale(0));

        if (d[valueColumn] < 0) {
          if (textHeight + valueGap * 2 < barHeight) {
            d3.select(this).classed("in", true);
            return -(textHeight - valueGap / 2);
          } else {
            d3.select(this).classed("out", true);
            return textHeight + valueGap;
          }
        } else {
          if (textHeight + valueGap * 2 < barHeight) {
            d3.select(this).classed("in", true);
            return textHeight + valueGap;
          } else {
            d3.select(this).classed("out", true);
            return -(textHeight - valueGap / 2);
          }
        }
      })
      .attr("text-anchor", "middle");
  }
};

//Initially load the graphic
window.onload = onWindowLoaded;
