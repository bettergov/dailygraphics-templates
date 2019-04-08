var pym = require("./lib/pym");
var ANALYTICS = require("./lib/analytics");
require("./lib/webfonts");

// Global vars
var pymChild = null;
var skipLabels = ["label", "values", "total"];
var {
  COLORS,
  makeTranslate,
  classify,
  processProps
} = require("./lib/helpers");

var d3 = {
  ...require("d3-axis"),
  ...require("d3-scale"),
  ...require("d3-selection"),
  ...require("d3-format")
};

// Initialize the graphic.
var onWindowLoaded = function() {
  formatData(window.DATA);
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
var formatData = function(data) {
  data.forEach(function(d) {
    d.values = [];
    var y0 = 0;

    d.total = 0;

    if ("offset" in d) {
      d.offset = +d.offset;
      y0 = d.offset;
    }

    var y0pos = y0,
      y0neg = y0;

    for (let key in d) {
      if (skipLabels.indexOf(key) > -1) {
        continue;
      }

      d.total += d[key];

      if (d[key] > 0) {
        var y1 = y0pos + d[key];

        d.values.push({
          name: key,
          y0: y0pos,
          y1,
          val: d[key]
        });

        y0pos = y1;
      } else if (d[key] < 0) {
        var y1 = y0neg + d[key];

        d.values.push({
          name: key,
          y0: y0neg,
          y1,
          val: d[key]
        });

        y0neg = y1;
      }
    }
  });
  return data;
};

// Render the graphic(s). Called by pym with the container width.
var render = function(containerWidth) {
  var container = "#stacked-column-chart";
  var element = document.querySelector(container);
  var width = element.offsetWidth;

  renderStackedColumnChart({
    container,
    width,
    data: DATA,
    props: processProps(PROPS)
  });

  // Update iframe
  if (pymChild) {
    pymChild.sendHeight();
  }
};

// Render a stacked column chart.
var renderStackedColumnChart = function(config) {
  // Setup
  var {
    margins,
    /* data refs */
    labelColumn,
    aspectWidth,
    aspectHeight,
    /* labels */
    valueGap,
    showBarValues,
    valueFormat,
    /* axes */
    ticksY,
    roundTicksFactor,
    yMin,
    yMax,
    xAxisTickValues
  } = config.props;

  // Calculate actual chart dimensions
  var chartWidth = config.width - margins.left - margins.right;
  var chartHeight =
    Math.ceil((config.width * aspectHeight) / aspectWidth) -
    margins.top -
    margins.bottom;

  // Clear existing graphic (for redraw)
  var containerElement = d3.select(config.container);
  containerElement.html("");

  var labels = config.data.map(d => d[labelColumn]);

  // Create D3 scale objects.
  var xScale = d3
    .scaleBand()
    .domain(labels)
    .range([0, chartWidth])
    .padding(0.1);

  var yScale = d3
    .scaleLinear()
    .domain([yMin, yMax])
    .rangeRound([chartHeight, 0]);

  var colorScale = d3
    .scaleOrdinal()
    .domain(
      Object.keys(config.data[0]).filter(k => skipLabels.indexOf(k) == -1)
    )
    .range([COLORS.teal2, COLORS.teal5]);

  // Render the legend.
  var legend = containerElement
    .append("ul")
    .attr("class", "key")
    .selectAll("g")
    .data(colorScale.domain())
    .enter()
    .append("li")
    .attr("class", function(d, i) {
      return "key-item key-" + i + " " + classify(d);
    });

  legend.append("b").style("background-color", function(d) {
    return colorScale(d);
  });

  legend.append("label").text(function(d) {
    return d;
  });

  // Create the root SVG element.
  var chartWrapper = containerElement
    .append("div")
    .attr("class", "graphic-wrapper");

  var chartElement = chartWrapper
    .append("svg")
    .attr("width", chartWidth + margins.left + margins.right)
    .attr("height", chartHeight + margins.top + margins.bottom)
    .append("g")
    .attr("transform", makeTranslate(margins.left, margins.top));

  // Create D3 axes.
  var xAxis = d3
    .axisBottom()
    .scale(xScale)
    .tickFormat(d => d)
    .tickValues(xAxisTickValues && xAxisTickValues.split(", "));

  var yAxis = d3
    .axisLeft()
    .scale(yScale)
    .ticks(ticksY)
    .tickFormat(d => d3.format(valueFormat)(d));

  // Render axes to chart.
  chartElement
    .append("g")
    .attr("class", "x axis")
    .attr("transform", makeTranslate(0, chartHeight))
    .call(xAxis);

  chartElement
    .append("g")
    .attr("class", "y axis")
    .call(yAxis);

  // Render grid to chart.
  var yAxisGrid = function() {
    return yAxis;
  };

  chartElement
    .append("g")
    .attr("class", "y grid")
    .call(
      yAxisGrid()
        .tickSize(-chartWidth, 0)
        .tickFormat("")
    );

  // Render bars to chart.
  var bars = chartElement
    .selectAll(".bars")
    .data(config.data)
    .enter()
    .append("g")
    .attr("class", "bar")
    .attr("transform", function(d) {
      return makeTranslate(xScale(d[labelColumn]), 0);
    });

  bars
    .selectAll("rect")
    .data(d => d.values)
    .enter()
    .append("rect")
    .attr("y", function(d) {
      if (d.y1 < d.y0) {
        return yScale(d.y0);
      }

      return yScale(d.y1);
    })
    .attr("width", xScale.bandwidth())
    .attr("height", function(d) {
      return Math.abs(yScale(d.y0) - yScale(d.y1));
    })
    .style("fill", function(d) {
      return colorScale(d.name);
    })
    .attr("class", function(d) {
      return classify(d.name);
    });

  // Render 0 value line.
  chartElement
    .append("line")
    .attr("class", "zero-line")
    .attr("x1", 0)
    .attr("x2", chartWidth)
    .attr("y1", yScale(0))
    .attr("y2", yScale(0));

  // Render values to chart.
  if (showBarValues) {
    bars
      .selectAll("text")
      .data(function(d) {
        return d.values;
      })
      .enter()
      .append("text")
      .text(function(d) {
        return d3.format(valueFormat)(d.val);
      })
      .attr("class", function(d) {
        return classify(d.name);
      })
      .attr("x", function(d) {
        return xScale.bandwidth() / 2;
      })
      .attr("y", function(d) {
        var textHeight = d3
          .select(this)
          .node()
          .getBBox().height;
        var barHeight = Math.abs(yScale(d.y0) - yScale(d.y1));

        if (textHeight + valueGap * 2 > barHeight) {
          d3.select(this).classed("hidden", true);
        }

        var barCenter = yScale(d.y1) + (yScale(d.y0) - yScale(d.y1)) / 2;

        return barCenter + textHeight / 2;
      })
      .attr("text-anchor", "middle");
  }
};

// Initially load the graphic
//(NB: Use window.load to ensure all images have loaded)
window.onload = onWindowLoaded;
