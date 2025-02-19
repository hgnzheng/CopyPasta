import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

export function drawPiePlotChart(all_info) {
  const svg = all_info.plot_info.plotContainer;
  const svgWidth  = +svg.attr("width");
  const svgHeight = +svg.attr("height");

  const margin = { top: 20, right: 20, bottom: 20, left: 20 };
  const width  = svgWidth  - margin.left - margin.right;
  const height = svgHeight - margin.top  - margin.bottom;

  const rotateOffset = Math.PI / 4;

  const g = svg.append("g")
    .attr("class", "pie-group")
    .attr("transform", `translate(${margin.left + width / 2},${margin.top + height / 2})`);

  const dataAll = all_info.plot_info.filteredAllData;
  const dxVal   = all_info.filter_info.disease;
  const deptList = all_info.filter_info.department || [];
  const sexList  = all_info.filter_info.sex || [];

  const comment = all_info.plot_info.commentContainer;
  comment.selectAll("*").remove();

  const deptData = dataAll.filter(d => deptList.includes(d.department));
  const total = deptData.length;

  if (!deptList.length || !total) {
    comment.html("No department selected or no data. Pie is empty.");
    return;
  }

  let selectedFemale = 0;
  let selectedMale   = 0;

  if (dxVal) {
    selectedFemale = deptData.filter(d => d.sex === "F" && d.dx === dxVal).length;
    selectedMale   = deptData.filter(d => d.sex === "M" && d.dx === dxVal).length;
  } else {
    selectedFemale = deptData.filter(d => d.sex === "F").length;
    selectedMale   = deptData.filter(d => d.sex === "M").length;
  }

  const sumSelected = selectedFemale + selectedMale;
  const othersCount = total - sumSelected;

  const pieData = [];
  if (sexList.includes("F") && selectedFemale > 0) {
    pieData.push({ name: "FemaleSelected", value: selectedFemale });
  }
  if (sexList.includes("M") && selectedMale > 0) {
    pieData.push({ name: "MaleSelected", value: selectedMale });
  }
  if (othersCount > 0) {
    pieData.push({ name: "Others", value: othersCount });
  }

  if (!pieData.length) {
    comment.html("No valid data for Pie. Possibly no matching sex/disease.");
    return;
  }

  const pie = d3.pie()
    .sort(null)
    .value(d => d.value);

  const arcs = pie(pieData);
  const radius = Math.min(width, height) / 2 - 10;

  const arcGen = d3.arc()
    .outerRadius(radius)
    .innerRadius(0)
    .startAngle(d => d.startAngle + rotateOffset)
    .endAngle(d => d.endAngle + rotateOffset);

  const colorMap = {
    FemaleSelected: "#d6614f",
    MaleSelected:   "#2064ab",
    Others:         "#9f9f9f"
  };

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
      .style("font-size", "24px")
      .style("display", "none");
  }

  g.selectAll("path.slice")
    .data(arcs)
    .enter()
    .append("path")
    .attr("class", "slice")
    .attr("fill", d => colorMap[d.data.name] || "#ccc")
    .attr("d", arcGen)
    .on("mouseover", () => {
      tooltip.style("display", "block");
    })
    .on("mousemove", function(e, d) {
      const ratio = total ? ((d.data.value * 100) / total).toFixed(1) + "%" : "N/A";
      let displayedName = d.data.name;
      if (dxVal && displayedName.includes("Selected")) {
        if (displayedName.includes("Female")) displayedName = dxVal + " (Female)";
        else if (displayedName.includes("Male")) displayedName = dxVal + " (Male)";
        else displayedName = dxVal;
      }
      tooltip
        .style("left", (e.pageX + 15) + "px")
        .style("top",  (e.pageY - 15) + "px")
        .html(`
          ${displayedName}<br>
          <b>${d.data.value}</b> (${ratio})
        `);
    })
    .on("mouseout", () => {
      tooltip.style("display", "none");
    });

  g.selectAll(".pieLabel")
    .data(arcs)
    .enter()
    .append("text")
    .attr("class", "pieLabel")
    .style("font-size", "24px")
    .attr("text-anchor", "middle")
    .attr("dy", "0.35em")
    .attr("transform", d => {
      const midAngle = (d.startAngle + d.endAngle) / 2 + rotateOffset;
      const x = Math.cos(midAngle + 4.72) * radius * 0.6;
      const y = Math.sin(midAngle + 4.72) * radius * 0.6;
      return `translate(${x},${y})`;
    })
    .text(d => {
      if (!total) return "";
      const pct = (d.data.value * 100) / total;
      return pct < 3 ? "" : pct.toFixed(1) + "%";
    });

  const legend = all_info.plot_info.legendContainer;
  legend.selectAll("*").remove();
  pieData.forEach(d => {
    legend.append("li")
      .style("margin-bottom", "5px")
      .html(`
        <span class="swatch"
          style="display:inline-block; width:12px; height:12px;
                 background-color:${colorMap[d.name] || "#ccc"};
                 margin-right:5px;">
        </span>
        ${d.name}
      `);
  });

  const dxName = dxVal ? dxVal : "ALL diseases";
  const ratioText = total ? ((sumSelected * 100) / total).toFixed(1) + "%" : "N/A";
  const joinedDept = deptList.join(", ");
  comment.html(`
    <b>${dxName}</b> in department(s) [<strong>${joinedDept}</strong>]
    accounts for <strong>${ratioText}</strong> of <strong>${total}</strong>
    patients. It contains <strong>${selectedMale}</strong> male and
    <strong>${selectedFemale}</strong> female.
  `);
}
