/* death_rate_plot.js */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

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
 * Modification #1: When no disease is selected, only the top 5 diseases
 * (by highest average death rate) are displayed.
 *
 * Modification #2: Uses a small visible circle plus a larger invisible
 * "hover" circle so that hovering for the tooltip is easier.
 */
export function drawDeathRateChart(all_info) {
    const svg = all_info.plot_info.plotContainer;
    const svgWidth = +svg.attr("width");
    const svgHeight = +svg.attr("height");
    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
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

    // If no specific disease is selected, keep only the top 5 diseases by avg death_inhosp
    if (!all_info.filter_info.disease) {
        const diseaseGroups = d3.group(aggregatedData, d => d.dx);
        const top5Diseases = Array.from(diseaseGroups.entries())
        .map(([dx, arr]) => ({ dx, avg: d3.mean(arr, d => d.death_inhosp) }))
        .sort((a, b) => d3.descending(a.avg, b.avg))
        .slice(0, 5)
        .map(d => d.dx);

        aggregatedData = aggregatedData.filter(d => top5Diseases.includes(d.dx));
    }

    // Build scales for the x and y axes
    const xExtent = d3.extent(aggregatedData, d => d.x_mid);
    const yMax = d3.max(aggregatedData, d => d.death_inhosp);
    const xScale = d3.scaleLinear().domain(xExtent).range([0, width]).nice();
    const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0]).nice();

    // Create and append the axes
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
    g.append("g")
        .call(d3.axisLeft(yScale));

    // Axis labels
    if (all_info.plot_info.x_label) {
        g.append("text")
        .attr("x", width)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "end")
        .text(all_info.plot_info.x_label);
    }
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -margin.top)
        .attr("text-anchor", "end")
        .text("Death Rate");

    // Prepare the line generator and color scale
    const dataByDx = d3.groups(aggregatedData, d => d.dx);
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
        .attr("r", 10)                // bigger radius for hover
        .attr("fill", "transparent")  // invisible
        .style("pointer-events", "all") // ensure it captures mouse events
        .on("mouseover", function(event, d) {
            tooltip.style("display", "block")
            .html(`
                <strong>Disease:</strong> ${d.dx}<br>
                <strong>x range:</strong> ${d.x_bin[0].toFixed(2)} - ${d.x_bin[1].toFixed(2)}<br>
                <strong>Mean Death Rate:</strong> ${d.death_inhosp.toFixed(2)}<br>
                <strong>Count:</strong> ${d.count}
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
        .text("Input X");
    }

    // Build the legend with interactive filtering
    const legend = all_info.plot_info.legendContainer;
    legend.selectAll("*").remove();
    dataByDx.forEach(([dx]) => {
        const legendItem = legend.append("div")
        .attr("class", "legend-item")
        .style("display", "flex")
        .style("align-items", "center")
        .style("cursor", "pointer")
        .on("click", function() {
            all_info.filter_info.disease = dx;
            filterDiseases(all_info);
            draw(all_info);
        });

        legendItem.append("div")
        .style("width", "20px")
        .style("height", "20px")
        .style("background-color", colorScale(dx))
        .style("margin-right", "5px");

        legendItem.append("div").text(dx);
    });

    // Display a short summary if a single disease is selected
    if (all_info.filter_info.disease) {
        all_info.plot_info.commentContainer.text(
        `Short summary for ${all_info.filter_info.disease}.`
        );
    }
}
