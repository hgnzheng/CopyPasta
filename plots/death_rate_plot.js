/* death_rate_plot.js */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { title } from "../global.js";

/**
 * Helper function to create bins for any numeric axis.
 * By default, it creates 10 equally spaced bins.
 */
function createBins(data, xVar, binCount = 10) {
    const values = data.map(d => +d[xVar]).filter(v => !isNaN(v));
    if (values.length < 2) return [];
    const minVal = d3.min(values);
    const maxVal = d3.max(values);
    const step = (maxVal - minVal) / binCount;
    const bins = [];
    for (let i = 0; i < binCount; i++) {
        bins.push(minVal + i * step);
    }
    // push one more value so that the last bin covers the maximum value
    bins.push(maxVal + 0.0000001);
    return bins;
}

/**
 * Draws a "Death Rate" line chart for the selected x-axis variable.
 * It bins the data, groups by (dx, x_bin), computes the mean death rate,
 * and adds interactive tooltips and a vertical reference line if provided.
 *
 * Modification: When no disease is selected, only the top k diseases with a positive
 * average death rate will be displayed. The legend label is updated accordingly.
 * Additionally, if fewer than k diseases are displayed, an "Other" legend item
 * with a 0.0 death rate is added.
 */
export function drawDeathRateChart(all_info) {
    const svg = all_info.plot_info.plotContainer;
    const svgWidth = +svg.attr("width");
    const svgHeight = +svg.attr("height");
    const margin = { top: 20, right: 30, bottom: 60, left: 90 };
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    // Create the drawing group inside the SVG
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xVar = all_info.plot_info.x_label;
    if (!xVar) {
        console.warn("No xVar selected for Death Rate chart!");
        return;
    }

    // Select the data based on the disease filter
    const data = all_info.filter_info.disease
        ? all_info.plot_info.filteredData      // if a single disease is selected
        : all_info.plot_info.filteredAllData;  // if no disease is selected
    if (!data || !data.length) {
        console.error("No data available for plotting. Possibly empty filters?");
        return;
    }

    // Create bins for the chosen x-axis
    const bins = createBins(data, xVar, 10);
    if (bins.length < 2) {
        console.warn("Not enough data or invalid x-axis to bin.");
        return;
    }

    // For each data point, determine its bin
    data.forEach(d => {
        const val = +d[xVar];
        if (!isNaN(val)) {
            for (let i = 0; i < bins.length - 1; i++) {
                if (val >= bins[i] && val < bins[i + 1]) {
                    d.x_bin = [bins[i], bins[i + 1]];
                    break;
                }
            }
        }
    });

    // Filter valid data and group by disease + bin
    const validData = data.filter(d => d.x_bin && !isNaN(d.death_inhosp));
    const grouped = d3.rollup(
        validData,
        v => ({
            death_inhosp: d3.mean(v, d => d.death_inhosp),
            count: v.length
        }),
        d => d.dx,
        d => d.x_bin.toString()
    );

    // Flatten the grouped data into an array with extra statistics
    let aggregatedData = [];
    for (let [dx, binMap] of grouped.entries()) {
        for (let [binStr, stats] of binMap.entries()) {
            const binParts = binStr.split(",").map(Number);
            aggregatedData.push({
                dx: dx,
                death_inhosp: stats.death_inhosp,
                count: stats.count,
                x_bin: binParts,
                x_mid: (binParts[0] + binParts[1]) / 2
            });
        }
    }

    // If no specific disease is selected, filter to keep only the top k diseases with positive average death_inhosp
    if (!all_info.filter_info.disease) {
        // Use a parameter k if provided, otherwise default to 5
        const k = all_info.plot_info.top_k || 5;
    
        // 1) Group aggregatedData by disease
        const diseaseGroups = d3.group(aggregatedData, d => d.dx);

        // 2) Compute weighted average death rate for each disease,
        //    filter to keep only those with positive averages, then sort descending
        const sortedByAvg = Array.from(diseaseGroups.entries())
            .map(([dx, arr]) => {
                const totalDeaths = d3.sum(arr, d => d.death_inhosp * d.count);
                const totalCount  = d3.sum(arr, d => d.count);
                const weightedAvg = totalDeaths / totalCount;
                return { dx, avg: weightedAvg };
            })
            .filter(d => d.avg > 0)
            .sort((a, b) => d3.descending(a.avg, b.avg));

        // 3) Determine how many diseases we can actually show (some might be fewer than k)
        const actualCount = Math.min(sortedByAvg.length, k);

        // 4) Slice out the top `actualCount` diseases
        const topDiseases = sortedByAvg.slice(0, actualCount).map(d => d.dx);

        // 5) Filter aggregatedData to keep only these top diseases
        aggregatedData = aggregatedData.filter(d => topDiseases.includes(d.dx));

        // 6) Update the legend label text to reflect the actual number of diseases shown
        all_info.plot_info.legendLabel.text(`Top ${actualCount} Diseases:`);

        // 7) Save these values for later use when building the legend
        all_info.plot_info.actualCount = actualCount;
        all_info.plot_info.top_k_value = k;
    }

    // Build scales for the x and y axes
    const xExtent = d3.extent(aggregatedData, d => d.x_mid);
    const yMax = d3.max(aggregatedData, d => d.death_inhosp);
    const xScale = d3.scaleLinear().domain(xExtent).range([0, width]).nice();
    const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0]).nice();

    // Create and append the axes
    // Increase font size for axis tick labels
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("font-size", "20px");

    g.append("g")
        .call(d3.axisLeft(yScale))
        .selectAll("text")
        .style("font-size", "20px");

    // Axis labels with increased font size
    if (all_info.plot_info.x_label) {
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
        g.append("text")
            .attr("x", width)
            .attr("y", height + margin.bottom - 10)
            .attr("text-anchor", "end")
            .style("font-size", "24px")
            .text(xLabel);
    }
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 20)
        .attr("x", -margin.top + 20)
        .attr("text-anchor", "end")
        .style("font-size", "24px")
        .text(title("Death Rate (%)"));

    // Prepare the line generator and color scale
    let dataByDx = d3.groups(aggregatedData, d => d.dx);
    dataByDx.sort((a, b) => {
        const totalDeathsA = d3.sum(a[1], d => d.death_inhosp * d.count);
        const totalCountA  = d3.sum(a[1], d => d.count);
        const weightedAvgA = totalDeathsA / totalCountA;

        const totalDeathsB = d3.sum(b[1], d => d.death_inhosp * d.count);
        const totalCountB  = d3.sum(b[1], d => d.count);
        const weightedAvgB = totalDeathsB / totalCountB;

        return d3.descending(weightedAvgA, weightedAvgB);
    });
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10)
        .domain(dataByDx.map(d => d[0]));
    const lineGen = d3.line()
        .x(d => xScale(d.x_mid))
        .y(d => yScale(d.death_inhosp));

    // Create a tooltip (if it doesn’t already exist)
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

    // Draw lines and markers with an invisible "hover" circle
    dataByDx.forEach(([dx, values]) => {
        // Sort by x_mid so lines connect in the correct order
        values.sort((a, b) => a.x_mid - b.x_mid);

        // Draw the line for this disease
        g.append("path")
            .datum(values)
            .attr("fill", "none")
            .attr("stroke", colorScale(dx))
            .attr("stroke-width", 2)
            .attr("d", lineGen);

        // For each data point, create a <g> with two circles:
        // 1) A small visible circle
        // 2) A larger invisible circle to capture hover events
        const markers = g.selectAll(`.marker-${dx}`)
            .data(values)
            .enter()
            .append("g")
            .attr("class", `marker-${dx}`)
            .attr("transform", d => `translate(${xScale(d.x_mid)}, ${yScale(d.death_inhosp)})`);

        // Small visible circle
        markers.append("circle")
            .attr("r", 4)
            .attr("fill", colorScale(dx));

        // Larger invisible circle for easier hovering
        markers.append("circle")
            .attr("r", 10)
            .attr("fill", "transparent")
            .style("pointer-events", "all")
            .on("mouseover", function(event, d) {
                tooltip.style("display", "block")
                    .html(`
                        <strong>Disease:</strong> ${d.dx}<br>
                        <strong>X range:</strong> ${d.x_bin[0].toFixed(2)} - ${d.x_bin[1].toFixed(2)}<br>
                        <strong>Mean Death Rate:</strong> ${d.death_inhosp.toFixed(2)}%<br>
                        <strong>Total Count:</strong> ${d.count}
                    `);
            })
            .on("mousemove", function(event) {
                tooltip.style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                tooltip.style("display", "none");
            });
    });

    // Draw a vertical reference line if an input value is provided
    const input_x = all_info.plot_info.input_x;
    if (typeof input_x === "number") {
        g.append("line")
            .attr("x1", xScale(input_x))
            .attr("x2", xScale(input_x))
            .attr("y1", 0)
            .attr("y2", height)
            .attr("stroke", "red")
            .attr("stroke-dasharray", "4");

        g.append("text")
            .attr("x", xScale(input_x) + 5)
            .attr("y", 15)
            .attr("fill", "red")
            .style("font-size", "12px")
            .text("Input X");
    }

    // Build the legend with interactive filtering
    const legend = all_info.plot_info.legendContainer;
    legend.selectAll("*").remove();
    dataByDx.forEach(([dx, values]) => {
        // Sum the counts for this disease
        const totalDeaths = d3.sum(values, d => d.death_inhosp * d.count);
        const totalCount  = d3.sum(values, d => d.count);
        const weightedAvg = totalDeaths / totalCount;
    
        // Build the legend item text with the weighted average death rate
        legend.append("li")
            .attr("style", `--color: ${colorScale(dx)}`)
            .html(`<span class="swatch"></span> ${dx} <em>(${(weightedAvg * 100).toFixed(2)}%)</em>`)
            .datum(dx);
    });

    // If fewer than k diseases were displayed, add "Other" with 0.0 death rate
    if (!all_info.filter_info.disease && all_info.plot_info.actualCount < all_info.plot_info.top_k_value) {
        legend.append("li")
            .attr("style", `--color: gray`)
            .html(`<span class="swatch" style="background: gray"></span> Other <em>(0.00%)</em>`)
            .datum("Other");
    }

    // Display a summary if a single disease is selected
    if (all_info.filter_info.disease) {
        // Filter aggregatedData for that single disease
        const diseaseData = aggregatedData.filter(d => d.dx === all_info.filter_info.disease);

        if (diseaseData.length > 0) {
            const minDeath = d3.min(diseaseData, d => d.death_inhosp);
            const maxDeath = d3.max(diseaseData, d => d.death_inhosp);
            const totalDeaths = d3.sum(diseaseData, d => d.death_inhosp * d.count);
            const totalCount  = d3.sum(diseaseData, d => d.count);
            const meanDeath   = totalDeaths / totalCount;
            const totalPoints = d3.sum(diseaseData, d => d.count);

            const summaryHtml = `
                <strong>Disease:</strong> ${all_info.filter_info.disease}<br>
                <strong>Minimum Death Rate:</strong> ${minDeath.toFixed(2)}<br>
                <strong>Maximum Death Rate:</strong> ${maxDeath.toFixed(2)}<br>
                <strong>Average Death Rate:</strong> ${meanDeath.toFixed(2)}<br>
                <strong>Total Points:</strong> ${totalPoints}
            `;
            all_info.plot_info.commentContainer.html(summaryHtml);
        } else {
            all_info.plot_info.commentContainer.text(
                `No data available for ${all_info.filter_info.disease}`
            );
        }
    }
}
