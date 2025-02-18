import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * A helper function to assign a data point's numeric value (e.g. age/bmi) 
 * into a bucket such as "0-4", "5-9", etc., or return "M"/"F" if attr is sex.
 */
function getBin(value, attr) {
  // Example logic from old project:
  if (attr === "sex") {
    return value === "M" ? "M" : "F";
  } else {
    if (isNaN(value)) return "N/A";
    const step = 5;
    const binLow = Math.floor(value / step) * step;
    const binHigh = binLow + step - 1;
    return `${binLow}-${binHigh}`;
  }
}

/**
 * A helper function to parse the bin string "0-4" into a numeric for sorting.
 * If bin is "M"/"F" or "N/A", assign them a large numeric code so they appear last.
 */
function parseBin(binStr) {
  if (binStr === "M")   return 100000;
  if (binStr === "F")   return 100001;
  if (binStr === "N/A") return 100002;
  const parts = binStr.split("-");
  return +parts[0];
}

/**
 * Draws a stacked area distribution chart based on the 'x_label' in all_info.
 * If a single disease is selected => one-layer area,
 * else => multiple diseases stacked area by bin.
 *
 * Legend style is consistent with the Scatter Plot in the new project:
 *   - Multi disease => show top 5 in legend, each clickable => filter that disease
 *   - Single disease => short summary in commentContainer
 */
export function drawDistributionPlotChart(all_info) {
  // Grab the main SVG and define width/height from it
  const svg = all_info.plot_info.plotContainer;
  const svgWidth = +svg.attr("width");
  const svgHeight = +svg.attr("height");

  // Define margins and inner plotting area
  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const width = svgWidth - margin.left - margin.right;
  const height = svgHeight - margin.top - margin.bottom;

  // Group for the chart
  const g = svg.append("g")
    .attr("class", "distribution-group")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Basic references
  const dataAll = all_info.plot_info.filteredAllData;  // multi disease scenario
  const dataDx  = all_info.plot_info.filteredData;     // single disease scenario
  const xAttr   = all_info.plot_info.x_label || "bmi";
  const isSingleDisease = !!all_info.filter_info.disease;

  // Decide which data to use: single disease => dataDx, else dataAll
  let usedData, allDiseases;
  if (isSingleDisease) {
    usedData = dataDx;
    if (usedData.length > 0) {
      allDiseases = [usedData[0].dx];
    } else {
      allDiseases = [];
    }
  } else {
    usedData = dataAll;
    allDiseases = Array.from(new Set(usedData.map(d => d.dx))).sort();
  }

  // If there's no data, just return
  if (!usedData || usedData.length === 0) {
    g.append("text")
      .attr("fill", "#666")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("No data available for Distribution.");
    return;
  }

  // Bin the data
  // binMap: Map(binName => Map(dxVal => count))
  const binMap = new Map();
  usedData.forEach(r => {
    const binName = getBin(r[xAttr], xAttr);
    if (!binMap.has(binName)) {
      binMap.set(binName, new Map());
    }
    const dxVal = r.dx;
    const dxMap = binMap.get(binName);
    dxMap.set(dxVal, (dxMap.get(dxVal) || 0) + 1);
  });

  // Convert binMap into rowData array
  let rowData = [];
  for (const [binName, dxCountMap] of binMap.entries()) {
    const obj = { bin: binName };
    allDiseases.forEach(dz => {
      obj[dz] = dxCountMap.get(dz) || 0;
    });
    rowData.push(obj);
  }
  // Sort rowData by numeric bin
  rowData.sort((a, b) => parseBin(a.bin) - parseBin(b.bin));

  // Build scales
  const xScale = d3.scaleBand()
    .domain(rowData.map(d => d.bin))
    .range([0, width])
    .padding(0.1);

  // Y scale from 0 to the sum of all diseases (max stacked)
  const maxVal = d3.max(rowData, d => {
    return allDiseases.reduce((acc, dz) => acc + d[dz], 0);
  }) || 1;
  const yScale = d3.scaleLinear()
    .domain([0, maxVal])
    .range([height, 0])
    .nice();

  // stack generator
  const stackGen = d3.stack().keys(allDiseases);
  const series = stackGen(rowData);

  // area generator
  const areaGen = d3.area()
    .x(d => xScale(d.data.bin) + xScale.bandwidth() / 2) 
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCardinal); // or curveBasis etc.

  // color scale
  const colorScale = d3.scaleOrdinal()
    .domain(allDiseases)
    .range(d3.schemeSet2);

  // Draw stacked areas
  g.selectAll(".layer")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => colorScale(d.key))
    .attr("fill-opacity", 0.8)
    .attr("d", areaGen);

  // Axes
  const xAxis = d3.axisBottom(xScale)
    .tickSizeOuter(0);
  g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("transform", "rotate(-90) translate(-10, -5)");

  g.append("g")
    .call(d3.axisLeft(yScale));

  // Tooltip
  let tooltip = d3.select("body").select(".tooltip");
  if (tooltip.empty()) {
    tooltip = d3.select("body").append("div")
      .attr("class", "tooltip")
      .style("position", "absolute")
      .style("background", "rgba(0,0,0,0.7)")
      .style("color", "white")
      .style("padding", "5px")
      .style("border-radius", "3px")
      .style("pointer-events", "none")
      .style("font-size", "12px")
      .style("display", "none");
  }

  // Mouse events: on stacked layers, we can do a simpler approach
  g.selectAll(".layer")
    .on("mousemove", function(event, d) {
      const [mx, my] = d3.pointer(event, this);
      tooltip
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 15) + "px")
        .style("display", "block")
        .html(`Disease: <b>${d.key}</b> (Stack Area)`);
    })
    .on("mouseout", () => {
      tooltip.style("display", "none");
    });

  // ----- Legend and Comment -----
  const legend = all_info.plot_info.legendContainer;
  legend.selectAll("*").remove();

  const comment = all_info.plot_info.commentContainer;
  comment.selectAll("*").remove(); // or .html("")

  if (isSingleDisease && allDiseases.length === 1) {
    // single disease => short summary
    const diseaseName = allDiseases[0];
    comment.text(`Short summary for ${diseaseName}.`);
    // Also create a single legend item (not usually clickable to revert)
    const legendItem = legend.append("div")
      .attr("class", "legend-item")
      .style("display", "flex")
      .style("align-items", "center");

    legendItem.append("div")
      .style("width", "20px")
      .style("height", "20px")
      .style("background-color", colorScale(diseaseName))
      .style("margin-right", "5px");

    legendItem.append("div").text(diseaseName);

  } else {
    // multiple diseases => pick top 5
    // to replicate the "top 5" approach
    const freqMap = d3.rollup(usedData, v => v.length, d => d.dx);
    const freqArray = Array.from(freqMap, ([dx, count]) => ({ dx, count }));
    freqArray.sort((a, b) => d3.descending(a.count, b.count));
    const top5 = freqArray.slice(0, 5).map(d => d.dx);

    top5.forEach(dz => {
      const legendItem = legend.append("div")
        .attr("class", "legend-item")
        .style("display", "flex")
        .style("align-items", "center")
        .style("cursor", "pointer")
        .on("click", function() {
          // click => filter to that disease
          all_info.filter_info.disease = dz;
          // call the global filter function & re-draw
          filterDiseases(all_info);
          draw(all_info);
        });

      legendItem.append("div")
        .style("width", "20px")
        .style("height", "20px")
        .style("background-color", colorScale(dz))
        .style("margin-right", "5px");

      legendItem.append("div").text(dz);
    });
  }
}
