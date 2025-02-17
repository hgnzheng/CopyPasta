/* scatterPlotChart.js */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

/**
 * Draws a scatter plot with two modes:
 * 1) Disease selected => standard row-level scatter by dx.
 * 2) No disease selected => aggregated by department (average x/y).
 *
 * Now uses **larger circles** in the aggregated view.
 */
export function drawScatterPlotChart(all_info) {
    const svg = all_info.plot_info.plotContainer;
    const svgWidth  = +svg.attr("width");
    const svgHeight = +svg.attr("height");

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width  = svgWidth  - margin.left - margin.right;
    const height = svgHeight - margin.top  - margin.bottom;

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const xVar = all_info.plot_info.x_label;
    const yVar = all_info.plot_info.y_label;
    if (!xVar || !yVar) {
        console.warn("No x or y variable selected for scatter plot!");
        return;
    }

    // Decide which data to use:
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

    // If a disease is selected => row-level scatter
    if (all_info.filter_info.disease) {
        displayData = data;  // row-level
        // Unique diseases
        const diseases = Array.from(new Set(displayData.map(d => d.dx))).sort();
        colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(diseases);
        legendValues = diseases;
    } else {
        // No disease => aggregated by department
        const grouped = d3.groups(data, d => d.department)
        .map(([dept, rows]) => {
            const avgX = d3.mean(rows, r => +r[xVar]);
            const avgY = d3.mean(rows, r => +r[yVar]);
            return {
            department: dept,
            xVal: avgX,
            yVal: avgY,
            count: rows.length
            };
        })
        .sort((a, b) => a.department.localeCompare(b.department));

        displayData = grouped;
        const departments = displayData.map(d => d.department);
        colorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(departments);
        legendValues = departments;
    }

    // Build scales
    const xExtent = d3.extent(displayData, d => all_info.filter_info.disease ? +d[xVar] : +d.xVal);
    const yExtent = d3.extent(displayData, d => all_info.filter_info.disease ? +d[yVar] : +d.yVal);

    const xScale = d3.scaleLinear().domain(xExtent).range([0, width]).nice();
    const yScale = d3.scaleLinear().domain(yExtent).range([height, 0]).nice();

    // Axes
    g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(xScale));
    g.append("g")
        .call(d3.axisLeft(yScale));

    // Axis labels
    g.append("text")
        .attr("x", width)
        .attr("y", height + margin.bottom - 10)
        .attr("text-anchor", "end")
        .text(xVar);
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -margin.top)
        .attr("text-anchor", "end")
        .text(yVar);

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

    // Circle radius: bigger if no disease is selected
    const circleRadius = all_info.filter_info.disease ? 6 : 12;

    // Draw the points
    g.selectAll(".point")
        .data(displayData)
        .enter()
        .append("circle")
        .attr("class", "point")
        .attr("cx", d => all_info.filter_info.disease ? xScale(+d[xVar]) : xScale(+d.xVal))
        .attr("cy", d => all_info.filter_info.disease ? yScale(+d[yVar]) : yScale(+d.yVal))
        .attr("r", circleRadius)
        .attr("fill", d => {
        if (all_info.filter_info.disease) {
            return colorScale(d.dx);
        } else {
            return colorScale(d.department);
        }
        })
        .on("mouseover", function(event, d) {
        tooltip.style("display", "block");
        if (all_info.filter_info.disease) {
            // Disease-based tooltip
            tooltip.html(`
            <strong>Disease:</strong> ${d.dx}<br>
            <strong>${xVar}:</strong> ${d[xVar]}<br>
            <strong>${yVar}:</strong> ${d[yVar]}<br>
            <strong>Age:</strong> ${d.age}<br>
            <strong>Sex:</strong> ${d.sex}<br>
            <strong>BMI:</strong> ${d.bmi}<br>
            <strong>Death Rate:</strong> ${d.death_inhosp}
            `);
        } else {
            // Department-based tooltip
            tooltip.html(`
            <strong>Department:</strong> ${d.department}<br>
            <strong>Average ${xVar}:</strong> ${d.xVal.toFixed(2)}<br>
            <strong>Average ${yVar}:</strong> ${d.yVal.toFixed(2)}<br>
            <strong>Count:</strong> ${d.count}
            `);
        }
        })
        .on("mousemove", function(event) {
        tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", function() {
        tooltip.style("display", "none");
        });

    // Optionally plot the user input as a star
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

    // Legend
    const legend = all_info.plot_info.legendContainer;
    legend.selectAll("*").remove();

    if (all_info.filter_info.disease) {
        // Single disease => short summary
        all_info.plot_info.commentContainer.text(
        `Short summary for ${all_info.filter_info.disease}.`
        );

        legendValues.forEach(disease => {
        const legendItem = legend.append("div")
            .attr("class", "legend-item")
            .style("display", "flex")
            .style("align-items", "center")
            .style("cursor", "pointer")
            .on("click", function() {
            // Unset disease filter on click
            all_info.filter_info.disease = null;
            filterDiseases(all_info);
            draw(all_info);
            });

        legendItem.append("div")
            .style("width", "20px")
            .style("height", "20px")
            .style("background-color", colorScale(disease))
            .style("margin-right", "5px");

        legendItem.append("div").text(disease);
        });

    } else {
        // No disease => aggregated
        all_info.plot_info.commentContainer.text("");
        legendValues.forEach(dept => {
        const legendItem = legend.append("div")
            .attr("class", "legend-item")
            .style("display", "flex")
            .style("align-items", "center")
            .style("cursor", "pointer")
            .on("click", function() {
            // For example, set the department filter or do something else
            // all_info.filter_info.department = [dept];
            // filterDepartment(all_info);
            // draw(all_info);
            console.log("Clicked department:", dept);
            });

        legendItem.append("div")
            .style("width", "20px")
            .style("height", "20px")
            .style("background-color", colorScale(dept))
            .style("margin-right", "5px");

        legendItem.append("div").text(dept);
        });
    }
}
