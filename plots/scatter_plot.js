import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { title } from "../global.js"

/**
 * Draws a scatter plot with two modes:
 * 1) Disease selected => standard row-level scatter by dx.
 * 2) No disease selected => display all data points:
 *    - The top 5 most frequent diseases are in color
 *    - All other diseases are in grey with some transparency
 *    - The top 5 colored circles are drawn on top
 */
export function drawScatterPlotChart(all_info) {
    const svg = all_info.plot_info.plotContainer;
    const svgWidth  = +svg.attr("width");
    const svgHeight = +svg.attr("height");

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width  = svgWidth  - margin.left - margin.right;
    const height = svgHeight - margin.top  - margin.bottom;

    // Clear previous content (if re-drawing)
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xVar = all_info.plot_info.x_label;
    const yVar = all_info.plot_info.y_label;
    if (!xVar || !yVar) {
        console.warn("No x or y variable selected for scatter plot!");
        return;
    }

    // Decide which data to use
    let data = all_info.filter_info.disease
        ? all_info.plot_info.filteredData
        : all_info.plot_info.filteredAllData;

    if (!data || data.length === 0) {
        console.error("No data available for plotting. Possibly empty filters?");
        return;
    }

    // We'll store final array to plot in "displayData"
    // plus a color scale domain "legendValues".
    let displayData;
    let legendValues;
    let colorScale;

    // ==============================
    // Mode 1: A disease is selected
    // ==============================
    if (all_info.filter_info.disease) {
        // Row-level scatter
        displayData = data;

        // Get unique diseases from the filtered data
        const diseases = Array.from(new Set(displayData.map(d => d.dx))).sort();

        // Create a color scale for the diseases
        colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(diseases);
        legendValues = diseases;

    // ==================================
    // Mode 2: No disease is selected
    // ==================================
    } else {
        // Show all datapoints, highlight top 5 diseases, and group others as "other"

        // Count the frequencies for each disease (dx)
        const freqMap = d3.rollup(data, v => v.length, d => d.dx);

        // Sort diseases by frequency (highest first)
        const sortedDiseases = Array.from(freqMap.entries())
            .sort((a, b) => b[1] - a[1])  // descending order by count
            .map(entry => entry[0]);      // extract disease name

        // Get the top 5 diseases
        const topDiseases = sortedDiseases.slice(0, 5);

        // For each datapoint, assign a new property diseaseGroup
        displayData = data.map(d => ({
            ...d,
            diseaseGroup: topDiseases.includes(d.dx) ? d.dx : "other"
        }));

        // Create a color scale only for the top diseases
        colorScale = d3.scaleOrdinal()
            .domain(topDiseases)
            .range(d3.schemeCategory10);

        // Prepare legend values: top diseases plus "other" if there is any leftover
        legendValues = [...topDiseases];
        if (data.some(d => !topDiseases.includes(d.dx))) {
            legendValues.push("other");
        }
    }

    // Build x and y scales from the final displayData
    const xExtent = d3.extent(displayData, d => +d[xVar]);
    const yExtent = d3.extent(displayData, d => +d[yVar]);

    const xScale = d3.scaleLinear().domain(xExtent).range([0, width]).nice();
    const yScale = d3.scaleLinear().domain(yExtent).range([height, 0]).nice();

    // =========================
    // Draw axes with bigger text
    // =========================
    const xAxis = g.append("g")
        .attr("transform", `translate(25,${height})`)
        .call(d3.axisBottom(xScale));
    xAxis.selectAll("text").style("font-size", "20px");

    const yAxis = g.append("g")
        .attr("transform", "translate(25,0)") 
        .call(d3.axisLeft(yScale));
    yAxis.selectAll("text").style("font-size", "20px");

    // =========================
    // Axis labels with units
    // =========================
    let xLabel = title(xVar);
    if (["height", "weight", "bmi"].includes(xVar.toLowerCase())) {
        if (xVar.toLowerCase() === "height") {
            xLabel += " (cm)";
        } else if (xVar.toLowerCase() === "weight") {
            xLabel += " (kg)";
        } else if (xVar.toLowerCase() === "bmi") {
            xLabel = xLabel.toUpperCase() + " (kg/m²)";
        }
    }
    let yLabel = title(yVar);
    if (["height", "weight", "bmi"].includes(yVar.toLowerCase())) {
        if (yVar.toLowerCase() === "height") {
            yLabel += " (cm)";
        } else if (yVar.toLowerCase() === "weight") {
            yLabel += " (kg)";
        } else if (yVar.toLowerCase() === "bmi") {
            yLabel = yLabel.toUpperCase() + " (kg/m²)";
        }
    }

    // Draw axis labels
    g.append("text")
        .attr("x", width)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "end")
        .style("font-size", "24px")
        .text(xLabel);

    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top + 20)
        .attr("text-anchor", "end")
        .style("font-size", "24px")
        .text(yLabel);

    // =========================
    // Tooltip creation
    // =========================
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

    // Circle radius
    const circleRadius = 6;

    // =========================
    // Draw circles
    // =========================
    if (!all_info.filter_info.disease) {
        // --- No disease selected ---
        // We'll separate the "other" points from the top diseases

        // 1) "Other" points
        const otherPoints = displayData.filter(d => d.diseaseGroup === "other");
        g.selectAll(".point-other")
            .data(otherPoints)
            .enter()
            .append("circle")
            // ADDED: add class "other" in addition to "point-other"
            .attr("class", "point-other other") // <--- new
            .attr("cx", d => xScale(+d[xVar]))
            .attr("cy", d => yScale(+d[yVar]))
            .attr("r", circleRadius)
            .attr("fill", "#a9a9a9")  // grey color
            .attr("opacity", 0.4)     // some transparency
            .on("mouseover", function(event, d) {
                tooltip.style("display", "block");
                tooltip.html(`
                    <strong>Disease:</strong> ${d.dx}<br>
                    <strong>${xVar}:</strong> ${d[xVar]}<br>
                    <strong>${yVar}:</strong> ${d[yVar]}<br>
                    <strong>Age:</strong> ${d.age}<br>
                    <strong>Sex:</strong> ${d.sex}<br>
                    <strong>BMI:</strong> ${d.bmi}<br>
                `);
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            });

        // 2) Top diseases
        const topPoints = displayData.filter(d => d.diseaseGroup !== "other");
        g.selectAll(".point-top")
            .data(topPoints)
            .enter()
            .append("circle")
            .attr("class", "point-top")
            .attr("cx", d => xScale(+d[xVar]))
            .attr("cy", d => yScale(+d[yVar]))
            .attr("r", circleRadius)
            .attr("fill", d => colorScale(d.diseaseGroup))
            .attr("opacity", 1.0)
            .on("mouseover", function(event, d) {
                tooltip.style("display", "block");
                tooltip.html(`
                    <strong>Disease:</strong> ${d.dx}<br>
                    <strong>${xVar}:</strong> ${d[xVar]}<br>
                    <strong>${yVar}:</strong> ${d[yVar]}<br>
                    <strong>Age:</strong> ${d.age}<br>
                    <strong>Sex:</strong> ${d.sex}<br>
                    <strong>BMI:</strong> ${d.bmi}<br>
                `);
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            });

    } else {
        // --- A disease is selected ---
        // Just draw all points in one pass, color by dx
        g.selectAll(".point")
            .data(displayData)
            .enter()
            .append("circle")
            .attr("class", "point")
            .attr("cx", d => xScale(+d[xVar]))
            .attr("cy", d => yScale(+d[yVar]))
            .attr("r", circleRadius)
            .attr("fill", d => colorScale(d.dx))
            .on("mouseover", function(event, d) {
                tooltip.style("display", "block");
                tooltip.html(`
                    <strong>Disease:</strong> ${d.dx}<br>
                    <strong>${xVar}:</strong> ${d[xVar]}<br>
                    <strong>${yVar}:</strong> ${d[yVar]}<br>
                    <strong>Age:</strong> ${d.age}<br>
                    <strong>Sex:</strong> ${d.sex}<br>
                    <strong>BMI:</strong> ${d.bmi}<br>
                    <strong>Death Rate:</strong> ${d.death_inhosp}
                `);
            })
            .on("mousemove", function(event) {
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            });
    }

    // =========================
    // Optionally plot user input as a star
    // =========================
    const input_x = all_info.plot_info.input_x;
    const input_y = all_info.plot_info.input_y;
    if (typeof input_x === "number" && typeof input_y === "number") {
        const starSymbol = d3.symbol().type(d3.symbolStar).size(200);
        g.append("path")
            .attr("d", starSymbol)
            .attr("fill", "black")
            .attr("transform", `translate(${xScale(input_x)}, ${yScale(input_y)})`);
        g.append("text")
            .attr("x", xScale(input_x) + 5)
            .attr("y", yScale(input_y) - 5)
            .attr("fill", "black")
            .text("Your Input");
    }

    // =========================
    // Legend and Summary Stats
    // =========================
    const legend = all_info.plot_info.legendContainer;
    legend.selectAll("*").remove();

    if (all_info.filter_info.disease) {
        // A disease is selected => might have multiple dx in the filtered data
        const diseaseCounts = d3.rollup(displayData, v => v.length, d => d.dx);

        // Summaries
        const count = data.length;
        const avgX = d3.mean(data, d => +d[xVar]);
        const avgY = d3.mean(data, d => +d[yVar]);
        const minX = d3.min(data, d => +d[xVar]);
        const maxX = d3.max(data, d => +d[xVar]);
        const minY = d3.min(data, d => +d[yVar]);
        const maxY = d3.max(data, d => +d[yVar]);

        all_info.plot_info.commentContainer.html(`
            <strong>Disease:</strong> ${all_info.filter_info.disease}<br>
            <strong>Count:</strong> ${count}<br>
            <strong>${xVar}:</strong> avg ${avgX.toFixed(2)} (min ${minX}, max ${maxX})<br>
            <strong>${yVar}:</strong> avg ${avgY.toFixed(2)} (min ${minY}, max ${maxY})
        `);

        // Legend for each disease in the data
        legendValues.forEach(disease => {
            const countVal = diseaseCounts.get(disease) || 0;
            legend.append("li")
                .attr("style", `--color:${colorScale(disease)}`)
                .html(`<span class="swatch"></span> ${disease} <em>(${countVal})</em>`)
                .datum(disease)
                // ADDED: highlight on hover
                .on("mouseover", function(event, hoveredDisease) {
                    // Fade out circles that do NOT match hoveredDisease
                    g.selectAll("circle")
                        .transition().duration(100)
                        .style("opacity", d => (d.dx === hoveredDisease) ? 1 : 0.2);
                })
                .on("mouseout", function() {
                    // Reset all circles to full opacity
                    g.selectAll("circle")
                        .transition().duration(100)
                        .style("opacity", 1);
                });
        });
    } else {
        // No disease => top 5 + "other"
        const groupCounts = d3.rollup(displayData, v => v.length, d => d.diseaseGroup);
        all_info.plot_info.commentContainer.text("");

        legendValues.forEach(group => {
            const countVal = groupCounts.get(group) || 0;
            const color = group === "other" ? "#a9a9a9" : colorScale(group);
            const label = group === "other" ? "Other Diseases" : group;

            let li = legend.append("li")
                .attr("style", `--color:${color}`)
                .html(`<span class="swatch"></span> ${label} <em>(${countVal})</em>`)
                .datum(group)
                // ADDED: highlight on hover
                .on("mouseover", function(event, hoveredGroup) {
                    g.selectAll("circle")
                        .transition().duration(100)
                        .style("opacity", d => {
                            // For "other" circles, d.diseaseGroup === "other"
                            // For top diseases, d.diseaseGroup === actual disease name
                            // We also have d.dx itself for the original name
                            return (d.diseaseGroup === hoveredGroup) ? 1 : 0.2;
                        });
                })
                .on("mouseout", function() {
                    // Reset all circles to full opacity
                    g.selectAll("circle")
                        .transition().duration(100)
                        .style("opacity", 1);
                });

            if (group === "other") {
                li.attr("class", "other");
            }
        });
    }
}
