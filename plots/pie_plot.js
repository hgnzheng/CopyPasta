import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Draws a 2-slice pie chart:
 *   - "Selected" = number of patients with the chosen disease
 *   - "Others"   = total - selected
 *
 * If no department is chosen or no data, it displays a short message in comment.
 * Legend style matches the scatter approach (2 color boxes).
 */
export function drawPiePlotChart(all_info) {
  // Get main SVG dimensions
  const svg = all_info.plot_info.plotContainer;
  const svgWidth = +svg.attr("width");
  const svgHeight = +svg.attr("height");

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const width  = svgWidth  - margin.left - margin.right;
  const height = svgHeight - margin.top  - margin.bottom;

  // Create a group in the center
  const g = svg.append("g")
    .attr("class", "pie-group")
    .attr("transform", `translate(${margin.left + width/2},${margin.top + height/2})`);

  // References
  const dataAll = all_info.plot_info.filteredAllData;
  const dataDx  = all_info.plot_info.filteredData; // might or might not be used
  const dxVal   = all_info.filter_info.disease;    // e.g. null => "ALL"

  const deptList = all_info.filter_info.department || [];
  // Filter data in those departments
  let deptData = dataAll.filter(d => deptList.includes(d.department));
  const total = deptData.length;

  // If user has selected a disease, count how many are that disease
  let selectedCount = 0;
  if (dxVal) {
    selectedCount = deptData.filter(d => d.dx === dxVal).length;
  } else {
    // If dxVal is null => consider that as "ALL"
    // so "selected" = total
    selectedCount = total;
  }
  const othersCount = total - selectedCount;

  // Pie data => 2 slices
  const pieData = [
    { name: "Selected", value: selectedCount },
    { name: "Others",   value: othersCount }
  ];

  // Create a pie layout
  const pie = d3.pie()
    .sort(null)
    .value(d => d.value);
  const arcs = pie(pieData);

  // Radius
  const radius = Math.min(width, height) / 2 - 10;

  // Arc generator
  const arcGen = d3.arc()
    .outerRadius(radius)
    .innerRadius(0);

  // Color
  const colorScale = d3.scaleOrdinal()
    .domain(["Selected", "Others"])
    .range(["#2ecc71", "#e67e22"]); // or pick any colors

  // Draw slices
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

  g.selectAll("path.slice")
    .data(arcs)
    .enter()
    .append("path")
    .attr("class", "slice")
    .attr("fill", d => colorScale(d.data.name))
    .attr("d", arcGen)
    .on("mouseover", function(event, d) {
      tooltip.style("display", "block");
    })
    .on("mousemove", function(event, d) {
      const ratio = total > 0 ? ((d.data.value * 100) / total).toFixed(1) + "%" : "N/A";
      tooltip
        .style("left", (event.pageX + 15) + "px")
        .style("top", (event.pageY - 15) + "px")
        .html(`${d.data.name}<br><b>${d.data.value}</b> (${ratio})`);
    })
    .on("mouseout", () => {
      tooltip.style("display", "none");
    });

  // Optionally add labels in the middle of each arc
  g.selectAll(".pieLabel")
    .data(arcs)
    .enter()
    .append("text")
    .attr("class", "pieLabel")
    .attr("transform", d => {
      const midAngle = (d.startAngle + d.endAngle) / 2;
      const x = Math.cos(midAngle) * radius * 0.6;
      const y = Math.sin(midAngle) * radius * 0.6;
      return `translate(${x}, ${y})`;
    })
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .style("font-size", "0.85rem")
    .text(d => {
      if (!total) return "";
      const pct = (d.data.value * 100) / total;
      return pct < 5 ? "" : pct.toFixed(1) + "%";
    });

  // ----- Legend & Comment -----
  const legend = all_info.plot_info.legendContainer;
  legend.selectAll("*").remove();

  // Show "Selected" + "Others" in a style consistent with scatter
  ["Selected", "Others"].forEach(label => {
    const legendItem = legend.append("div")
      .attr("class", "legend-item")
      .style("display", "flex")
      .style("align-items", "center");

    legendItem.append("div")
      .style("width", "20px")
      .style("height", "20px")
      .style("background-color", colorScale(label))
      .style("margin-right", "5px");

    legendItem.append("div").text(label);
  });

  const comment = all_info.plot_info.commentContainer;
  comment.selectAll("*").remove();

  if (deptList.length === 0) {
    // No department => no data
    comment.html("No department selected. Pie is empty.");
    return;
  }
  // Otherwise show a short summary
  const joinedDept = deptList.join(", ");
  const dxName = dxVal ? dxVal : "ALL diseases";
  const ratioText = total > 0
    ? ((selectedCount * 100) / total).toFixed(1) + "%"
    : "N/A";

  comment.html(`
    <b>${dxName}</b> in department(s) [${joinedDept}] 
    accounts for ${ratioText} of ${total} patients.
  `);
}
