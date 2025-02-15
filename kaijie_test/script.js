import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

// Create tooltip if not already present
let tooltip = d3.select(".tooltip");
if (tooltip.empty()) {
  tooltip = d3.select("body").append("div").attr("class", "tooltip");
}

/******************************************************
 * Utility functions
 ******************************************************/
function getBin(value, attr) {
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
function parseBin(binStr) {
  if (binStr === "M") return 100000;
  if (binStr === "F") return 100001;
  if (binStr === "N/A") return 100002;
  const parts = binStr.split("-");
  return +parts[0];
}

/******************************************************
 * Stacked area chart: drawDistribution
 ******************************************************/
export function drawDistribution(all_info) {
  const dataAll = all_info.plot_info.filteredAllData;
  const dataDx = all_info.plot_info.filteredData;
  const xAttr = all_info.plot_info.x_label || "bmi";

  // single or multi disease?
  const isSingleDisease = all_info.filter_info.disease !== null;

  let usedData, allDiseases;
  if (!isSingleDisease) {
    usedData = dataAll;
    allDiseases = Array.from(new Set(usedData.map(d => d.dx))).sort();
  } else {
    usedData = dataDx;
    allDiseases = usedData.length ? [usedData[0].dx] : [];
  }

  console.log("[drawDistribution] usedData.length =", usedData.length, "xAttr =", xAttr);

  const svg = all_info.plot_info.plotContainer;
  svg.selectAll("g.distribution-group").remove();

  const totalWidth = 1200, totalHeight = 800;
  const margin = { top: 40, right: 200, bottom: 60, left: 60 };
  const innerWidth = totalWidth - margin.left - margin.right;
  const innerHeight = totalHeight - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("class", "distribution-group")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // bin data by xAttr
  const binMap = new Map();
  usedData.forEach(r => {
    const binName = getBin(r[xAttr], xAttr);
    if (!binMap.has(binName)) binMap.set(binName, new Map());
    const dxVal = r.dx;
    const dxMap = binMap.get(binName);
    dxMap.set(dxVal, (dxMap.get(dxVal) || 0) + 1);
  });

  let rowData = [];
  for (const [binName, dxMap] of binMap.entries()) {
    const obj = { bin: binName };
    allDiseases.forEach(dz => {
      obj[dz] = dxMap.get(dz) || 0;
    });
    rowData.push(obj);
  }
  rowData.sort((a, b) => parseBin(a.bin) - parseBin(b.bin));

  const xScale = d3.scaleBand()
    .domain(rowData.map(d => d.bin))
    .range([0, innerWidth])
    .padding(0.1);
  const maxVal = d3.max(rowData, d => 
    allDiseases.reduce((acc, k) => acc + d[k], 0)
  ) || 1;
  const yScale = d3.scaleLinear()
    .domain([0, maxVal])
    .range([innerHeight, 0])
    .nice();

  const stackGen = d3.stack().keys(allDiseases);
  const series = stackGen(rowData);

  const areaGen = d3.area()
    .x(d => xScale(d.data.bin) + xScale.bandwidth() / 2)
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCardinal);

  const colorScale = d3.scaleOrdinal()
    .domain(allDiseases)
    .range(d3.schemeSet2);

  g.selectAll(".layer")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => colorScale(d.key))
    .attr("fill-opacity", 0.8)
    .attr("d", areaGen)
    .on("mousemove", (evt, d) => {
      const [mx, my] = d3.pointer(evt);
      tooltip
        .style("left", (mx + 20) + "px")
        .style("top", (my + 20) + "px")
        .style("opacity", 1)
        .html(`Disease: <b>${d.key}</b>`);
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  // X-axis
  g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("transform", "rotate(-90) translate(-10,-5)");

  // Y-axis
  g.append("g")
    .call(d3.axisLeft(yScale));

  // Legend
  const legendContainer = all_info.plot_info.legendContainer;
  legendContainer.selectAll("*").remove();

  // If usedData is empty, show no distribution
  if (usedData.length === 0) {
    legendContainer.append("li")
      .text("No data in distribution")
      .style("color", "#888");
    return;
  }

  // multi disease => top 5, single disease => "This is X"
  if (!isSingleDisease) {
    const freqMap = d3.rollup(usedData, v => v.length, d => d.dx);
    const freqArray = Array.from(freqMap, ([dx, count]) => ({ dx, count }));
    freqArray.sort((a, b) => d3.descending(a.count, b.count));
    const top5 = freqArray.slice(0, 5).map(d => d.dx);

    legendContainer.selectAll("li")
      .data(top5)
      .enter()
      .append("li")
      .text(d => d)
      .style("color", d => colorScale(d));
  } else {
    const diseaseName = usedData[0].dx;
    const displayText = `This is ${diseaseName}`;
    legendContainer.append("li")
      .text(displayText)
      .style("color", colorScale(diseaseName));
  }
}

/******************************************************
 * Pie chart: drawPiPlot
 ******************************************************/
export function drawPiPlot(all_info) {
  const dataAll = all_info.plot_info.filteredAllData;
  const dataDx = all_info.plot_info.filteredData;
  const dxVal = all_info.filter_info.disease || "ALL";

  const deptList = all_info.filter_info.department;
  let deptData = dataAll.filter(d => deptList.includes(d.department));
  if (deptList.length === 0) deptData = [];
  const total = deptData.length;
  const selected = (dxVal === "ALL") ? total : deptData.filter(d => d.dx === dxVal).length;
  const others = total - selected;

  const svg = all_info.plot_info.plotContainer;
  svg.selectAll("g.pie-group").remove();

  const totalWidth = 1200;
  const totalHeight = 800;
  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const innerW = totalWidth - margin.left - margin.right;
  const innerH = totalHeight - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("class", "pie-group")
    .attr("transform", `translate(${innerW/2},${innerH/2})`);
  let radius = Math.min(innerW, innerH) / 2 - 20;
  if (radius < 0) radius = 100;

  const pieData = [
    { name: "Selected", value: selected },
    { name: "Others", value: others }
  ];
  const pie = d3.pie().sort(null).value(d => d.value);
  const arcs = pie(pieData);
  const arcGen = d3.arc().outerRadius(radius).innerRadius(0);

  const pieColor = d3.scaleOrdinal()
    .domain(["Selected", "Others"])
    .range(["#2ecc71", "#e67e22"]);

  g.selectAll("path.slice")
    .data(arcs)
    .enter()
    .append("path")
    .attr("class", "slice")
    .attr("fill", d => pieColor(d.data.name))
    .attr("d", arcGen)
    .on("mousemove", (evt, d) => {
      const [mx, my] = d3.pointer(evt);
      const ratio = total > 0 ? (d.data.value * 100 / total).toFixed(1) + "%" : "N/A";
      tooltip
        .style("left", (mx + 30) + "px")
        .style("top", (my + 30) + "px")
        .style("opacity", 1)
        .html(`${d.data.name}: <b>${d.data.value}</b> (${ratio})`);
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  g.selectAll(".pieLabel")
    .data(arcs)
    .enter()
    .append("text")
    .attr("class", "pieLabel")
    .attr("transform", d => {
      const mid = (d.startAngle + d.endAngle) / 2;
      const x = Math.cos(mid) * radius * 0.6;
      const y = Math.sin(mid) * radius * 0.6;
      return `translate(${x},${y})`;
    })
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "0.8rem")
    .text(d => {
      if (total === 0) return "";
      const pct = (d.data.value * 100 / total);
      return pct < 3 ? "" : pct.toFixed(1) + "%";
    });

  const legend = all_info.plot_info.legendContainer;
  legend.selectAll("li")
    .data(["Selected", "Others"])
    .enter()
    .append("li")
    .text(d => d)
    .style("color", d => pieColor(d));

  const comment = all_info.plot_info.commentContainer;
  if (deptList.length === 0) {
    comment.html("No department selected. Pie is empty.");
    return;
  }
  const joinedDept = deptList.join(", ");
  const dxName = (dxVal === "ALL") ? "ALL diseases" : dxVal;
  const ratioText = total > 0 ? ((selected * 100) / total).toFixed(1) + "%" : "N/A";
  const info = deptList.length === 1
    ? `<b>${dxName}</b> belongs to ${joinedDept}. It accounts for ${ratioText} of that department's patients.`
    : `<b>${dxName}</b> belongs to [${joinedDept}]. It accounts for ${ratioText} of these departments' patients.`;
  comment.html(info);
}
