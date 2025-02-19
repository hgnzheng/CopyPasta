import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { selectDiseaseViaPlot } from "../global.js";
import { title } from "../global.js";

export function drawDistributionPlotChart(all_info) {
  const svg = all_info.plot_info.plotContainer;
  const svgWidth  = +svg.attr("width");
  const svgHeight = +svg.attr("height");

  const margin = { top: 40, right: 40, bottom: 60, left: 60 };
  const width  = svgWidth  - margin.left - margin.right;
  const height = svgHeight - margin.top  - margin.bottom;

  const g = svg.append("g")
    .attr("class", "distribution-group")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const dataAll = all_info.plot_info.filteredAllData;
  const dataDx  = all_info.plot_info.filteredData;


  const xAttr = all_info.plot_info.x_label || "bmi";
  let xVar = title(all_info.plot_info.x_label);
  let xLabel = title(xVar);
  // Append the appropriate unit if the xVar is "height", "weight", or "bmi"
  if (["height", "weight", "bmi"].includes(xVar.toLowerCase())) {
      if (xVar.toLowerCase() === "height") {
          xLabel += " (cm)"; // assuming height is measured in centimeters
      } else if (xVar.toLowerCase() === "weight") {
          xLabel += " (kg)"; // assuming weight is in kilograms
      } else if (xVar.toLowerCase() === "bmi") {
          xLabel = xLabel.toUpperCase(); // BMI is usually in uppercase
          xLabel += " (kg/m²)"; // standard unit for BMI
      }
  }


  const isSingleDisease = !!all_info.filter_info.disease;

  const legend = all_info.plot_info.legendContainer;
  legend.selectAll("*").remove();
  const comment = all_info.plot_info.commentContainer;
  comment.selectAll("*").remove();

  if ((!dataAll || dataAll.length === 0) && (!dataDx || dataDx.length === 0)) {
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height / 2)
      .attr("text-anchor", "middle")
      .text("No data available for Distribution.");
    return;
  }

  const globalData = all_info.filter_info.allData; 
  const freqMap = d3.rollup(globalData, v => v.length, d => d.dx);
  const freqArray = Array.from(freqMap, ([dx, c]) => ({ dx, c }))
    .sort((a,b) => d3.descending(a.c, b.c));

  const top5Colors = ["#F8766D", "#A3A500", "#00BF7D", "#00B0F6", "#E76BF3"];
  const fallbackColorScale = d3.scaleOrdinal(d3.schemeTableau10);

  const diseaseColorMap = new Map();
  freqArray.forEach((obj, i) => {
    const disease = obj.dx;
    if (i < 5) {
      diseaseColorMap.set(disease, top5Colors[i]);
    } else {
      diseaseColorMap.set(disease, fallbackColorScale(disease));
    }
  });

  let usedData, allDiseases;
  if (isSingleDisease) {
    usedData = dataDx;
    allDiseases = usedData.length ? [usedData[0].dx] : [];
  } else {
    usedData = dataAll;
    allDiseases = Array.from(new Set(usedData.map(d => d.dx))).sort();
  }

  if (!usedData || usedData.length === 0) {
    g.append("text")
      .attr("x", width/2)
      .attr("y", height/2)
      .attr("text-anchor", "middle")
      .text("No data available for Distribution.");
    return;
  }

  function getBin(value) {
    if (isNaN(value)) return "N/A";
    const step = 5;
    const binLow  = Math.floor(value / step) * step;
    const binHigh = binLow + step - 1;
    return `${binLow}-${binHigh}`;
  }
  function parseBin(binStr) {
    if (binStr === "N/A") return 999999;
    return +binStr.split("-")[0];
  }
  function shortBinLabel(binStr) {
    if (binStr === "N/A") return "N/A";
    return binStr.split("-")[0];
  }

  const binMap = new Map();
  usedData.forEach(row => {
    const binName = getBin(+row[xAttr]);
    if (!binMap.has(binName)) {
      binMap.set(binName, new Map());
    }
    const dxName = row.dx;
    const dxMap = binMap.get(binName);
    dxMap.set(dxName, (dxMap.get(dxName) || 0) + 1);
  });

  let rowData = [];
  for (const [binName, dxCountMap] of binMap.entries()) {
    const obj = { bin: binName };
    allDiseases.forEach(dz => {
      obj[dz] = dxCountMap.get(dz) || 0;
    });
    rowData.push(obj);
  }
  rowData.sort((a,b) => parseBin(a.bin) - parseBin(b.bin));

  const xScale = d3.scaleBand()
    .domain(rowData.map(d => d.bin))
    .range([0, width])
    .padding(0.1);

  const maxVal = d3.max(rowData, r =>
    allDiseases.reduce((acc, dz) => acc + r[dz], 0)
  ) || 1;

  const yScale = d3.scaleLinear()
    .domain([0, maxVal])
    .range([height, 0])
    .nice();

  const stackGen = d3.stack().keys(allDiseases);
  const series = stackGen(rowData);

  const areaGen = d3.area()
    .x(d => xScale(d.data.bin) + xScale.bandwidth()/2)
    .y0(d => yScale(d[0]))
    .y1(d => yScale(d[1]))
    .curve(d3.curveCardinal);

  const layerPaths = g.selectAll(".layer")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => diseaseColorMap.get(d.key) || "#ccc")
    .attr("fill-opacity", 0.8)
    .attr("stroke", "none")
    .attr("d", areaGen);

  const xAxis = g.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(xScale).tickFormat(shortBinLabel));
  xAxis.selectAll("text").style("font-size", "20px");

  const yAxis = g.append("g")
    .attr("transform", "translate(10,0)") 
    .call(d3.axisLeft(yScale));
  yAxis.selectAll("text").style("font-size", "20px");

  g.append("text")
    .attr("x", width)
    .attr("y", height + margin.bottom - 10)
    .attr("text-anchor", "end")
    .style("font-size", "24px")
    .text(xLabel);

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 16)
    .attr("x", -margin.top + 70)
    .attr("text-anchor", "end")
    .style("font-size", "24px")
    .text("Count");

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

  const guideLine = g.append("line")
    .attr("class", "hover-line")
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .style("opacity", 0);

  const guideCircle = g.append("circle")
    .attr("class", "hover-circle")
    .attr("r", 4)
    .attr("fill", "red")
    .style("opacity", 0);

  layerPaths
    .on("mouseover", function(evt, dStack) {
      g.selectAll(".layer")
        .transition().duration(100)
        .style("opacity", s => s.key === dStack.key ? 1 : 0.3);

      guideLine.style("opacity", 1);
      guideCircle.style("opacity", 1);
    })
    .on("mousemove", function(evt, dStack) {
      const [mx, my] = d3.pointer(evt, this);
      const bandWidth = xScale.bandwidth() + xScale.step() * xScale.paddingInner();
      const binIndex = Math.floor(mx / bandWidth + 0.5);
      if (binIndex < 0 || binIndex >= rowData.length) {
        tooltip.style("display", "none");
        guideLine.style("opacity", 0);
        guideCircle.style("opacity", 0);
        return;
      }

      const binObj = rowData[binIndex];
      const disease = dStack.key;
      const countVal = binObj[disease] || 0;
      const binName = binObj.bin;

      const binX = xScale(binName) + xScale.bandwidth()/2;
      const [y0, y1] = dStack[binIndex];
      const topY = yScale(y1);

      guideLine
        .attr("x1", binX).attr("x2", binX)
        .attr("y1", 0).attr("y2", height)
        .style("opacity", 1);

      guideCircle
        .attr("cx", binX)
        .attr("cy", topY)
        .style("opacity", 1);

      tooltip
        .style("display", "block")
        .style("left", (evt.pageX + 10) + "px")
        .style("top",  (evt.pageY - 15) + "px")
        .html(`
          <strong>${disease}</strong><br>
          ≈ <b>${shortBinLabel(binName)}</b> ${xAttr}, count = <b>${countVal}</b>.
        `);
    })
    .on("mouseout", function() {
      g.selectAll(".layer")
        .transition().duration(100)
        .style("opacity", 0.8);

      tooltip.style("display", "none");
      guideLine.style("opacity", 0);
      guideCircle.style("opacity", 0);
    })
    .on("click", function(evt, dStack) {
      selectDiseaseViaPlot(all_info, dStack.key);
    });

  if (isSingleDisease && allDiseases.length === 1) {
    const diseaseName = allDiseases[0];
    const singleData  = usedData;
    const n = singleData.length;

    const xVals = singleData.map(d => +d[xAttr]).filter(v => !isNaN(v));
    const minX  = d3.min(xVals) || 0;
    const maxX  = d3.max(xVals) || 0;
    const meanX = d3.mean(xVals) || 0;

    const counts = rowData.map(r => r[diseaseName] || 0);
    const minCount = d3.min(counts);
    const maxCount = d3.max(counts);
    const avgCount = d3.mean(counts);

    comment.html(`
      <p>
        The current disease is <strong>${diseaseName}</strong><br>
        with <strong>${n}</strong> total samples.<br/>
        About the ${xAttr},
          the minimun count is <strong>${minX.toFixed(2)}</strong>,
          the maximun count is <strong>${maxX.toFixed(2)}</strong>,
          and the average count is about <strong>${meanX.toFixed(2)}</strong>.
          <br/>
        The count across bins shows,
          the minimun count is <strong>${minCount}</strong>,
          the maximun count is <strong>${maxCount}</strong>,
          and the average count is about <strong>${avgCount.toFixed(2)}</strong>.
      </p>
    `);

    legend.append("li").html(`
      <span class="swatch"
        style="display:inline-block; width:12px; height:12px;
               background-color:${diseaseColorMap.get(diseaseName) || "#ccc"};
               margin-right:5px;">
      </span> 
      ${diseaseName}
    `);

  } else {
    const usedFreqMap2 = d3.rollup(usedData, v => v.length, d => d.dx);
    const usedFreqArr = Array.from(usedFreqMap2, ([dx, c]) => ({dx, c}))
      .sort((a,b) => d3.descending(a.c, b.c));
    const top5Used = usedFreqArr.slice(0,5);

    top5Used.forEach(obj => {
      const dz = obj.dx;
      const count = obj.c;  
      legend.append("li")
        .datum(dz)
        .html(`
          <span class="swatch"
            style="display:inline-block; width:12px; height:12px;
                   background-color:${diseaseColorMap.get(dz) || "#ccc"};
                   margin-right:5px;">
          </span> 
          ${dz} <em>(${count})</em>
        `)
        .on("mouseover", () => {
          g.selectAll(".layer")
            .transition().duration(100)
            .style("opacity", s => s.key === dz ? 1 : 0.3);
        })
        .on("mouseout", () => {
          g.selectAll(".layer")
            .transition().duration(100)
            .style("opacity", 0.8);
        });
    });
  }
}
