import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";
import { drawDeathRateChart } from "./plots/death_rate_plot.js";
import { drawScatterPlotChart } from "./plots/scatter_plot.js";
import { drawDistributionPlotChart } from "./plots/distribution_plot.js";
import { drawPiePlotChart } from "./plots/pie_plot.js";

const dataPath = "data/data_cleaned_filtered.csv"
const axisList = ["age", "height", "weight", "bmi"]
const plotKindList = ["Distribution", "Death Rate", "Physical Condition", "Percentage in Department"]
const plotKindValueList = ["distribution", "deathRate", "scatterPlot", "piePlot"]
const plotKindNeedAbleList = ["piePlot"]


function title(s) {
    return s.charAt(0).toUpperCase() + s.slice(1)
}

let currentTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <label class="color-scheme">
        Theme:
        <select>
            <option value="light dark" selected>Automatic (${title(currentTheme)})</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
        </select>
    </label>`
);

const select = document.querySelector(".color-scheme select");
select.addEventListener('input', function (event) {
    console.log('color scheme changed to', event.target.value);
    document.documentElement.style.setProperty('color-scheme', event.target.value);
    localStorage.colorScheme = event.target.value;
});


function loadData(){
    let plot_info = {
        filteredAllData: null,
        filteredData: null,
        x_label: null,
        y_label: null,
        plotContainer: d3.select("svg"),
        legendContainer: d3.select(".legend"),
        commentContainer: d3.select(".comment")
    }
    let filter_info = {
        allData: null,
        sex: [],
        department: [],
        disease: null,
        plotKind: null,
        legendBox: d3.select(".legend-box"),
        commentBox: d3.select(".comment-box")
    }
    let other_info = {
        axisContainer: d3.select(".filter-axis"),
        diseasesList: {},
        departmentList: null,
        sexList: null,
        filteredDiseasesList: {},
        plotKindList: plotKindList,
        plotKindValueList: plotKindValueList,
        plotKindNeedAbleList: plotKindNeedAbleList,
        axisList: axisList
    }

    let all_info = {
        plot_info: plot_info,
        filter_info: filter_info, 
        other_info: other_info
    }

    return d3.csv(dataPath).then(data => {
        data.forEach(d => {
          d.age    = +d.age;
          d.height = +d.height;
          d.weight = +d.weight;
          d.bmi    = +d.bmi;
        });
        filter_info.allData = data;

        other_info.diseasesList = Array.from(
            d3.group(data, d => d.dx)
        ).map(([dx, rows]) => ({ disease: dx, count: rows.length }))
            .sort((a, b) => a.disease.localeCompare(b.disease));

        other_info.departmentList = Array.from(new Set(data.map(d => d.department))).sort();
        other_info.sexList = Array.from(new Set(data.map(d => d.sex))).sort();

        other_info.filteredDiseasesList = other_info.diseasesList;

        return all_info
    });

    
}

function filterDiseases(all_info) {
    let container = d3.select(".filter-diseases");
    container.selectAll("*").remove();

    let button = container.append("button")
        .text("Select Diseases")
        .on("click", function() {
            let menu = container.select(".dropdown-menu");
            let isVisible = menu.style("display") === "block";
            menu.style("display", isVisible ? "none" : "block");
        });

    let menu = container.append("div")
        .attr("class", "dropdown-menu")
        .style("display", "none");

    let searchContainer = menu.append("div")
    .attr("class", "search-container");
      
    searchContainer.append("input")
        .attr("type", "text")
        .attr("placeholder", "Search...")
        .on("input", function() {
            let searchText = this.value.toLowerCase();
            menu.selectAll("ul li")
                .style("display", function() {
                    let txt = d3.select(this).text().toLowerCase();
                    return txt.indexOf(searchText) >= 0 ? "block" : "none";
                });
        });

    let ul = menu.append("ul");
    let diseasesList = all_info.other_info.filteredDiseasesList;
    const totalCount = diseasesList.reduce((sum, d) => sum + d.count, 0);

    ul.append("li")
        .html(`All <em>(${totalCount})</em>`)
        .classed("all", true)
        .on("click", function() {
            ul.selectAll("li").classed("selected", false);
            d3.select(this).classed("selected", true);
            button.text("Select Diseases");
            all_info.filter_info.disease = null;
            menu.style("display", "none");
            updateFilterButton(all_info);
            draw(all_info);
        });

    diseasesList.forEach(function(disease) {
        ul.append("li")
            .html(`${disease.disease} <em>(${disease.count})</em>`)
            .on("click", function() {
                if (!d3.select(this).classed("selected")) {
                    ul.selectAll("li").classed("selected", false);
                    d3.select(this).classed("selected", true);
                    button.text(disease.disease);
                    all_info.filter_info.disease = disease.disease;
                } else {
                    ul.selectAll("li").classed("selected", false);
                    d3.select(".all").classed("selected", true);
                    button.text("Select Diseases");
                    all_info.filter_info.disease = null;
                }

                menu.style("display", "none");
                updateFilterButton(all_info);
                draw(all_info);
            });
    });

    if (all_info.filter_info.disease) {
        d3.selectAll(".dropdown-menu ul li")
            .filter(function() {
                return d3.select(this).text().trim().startsWith(all_info.filter_info.disease);
            })
            .classed("selected", true);
        button.text(all_info.filter_info.disease);
    } else {
        d3.select(".all").classed("selected", true);
    }
}


function filterDepartment(all_info) {
    let container = d3.select(".filter-department")
    container.selectAll("*").remove();

    container.append("button")
        .attr("class", "department all")
        .text("All")
        .on("click", function() {
            let allBtn = d3.select(this);
            let wasSelected = allBtn.classed("selected");

            allBtn.classed("selected", !wasSelected);
            container.selectAll("button.department:not(.all)")
                .classed("selected", !wasSelected)
                .classed("was-selected", !wasSelected);
            all_info.filter_info.department = 
                !wasSelected ? all_info.other_info.departmentList.slice() : [];

            updateFilteredDiseasesList(all_info);
            filterDiseases(all_info);
    
            draw(all_info);
        });

    all_info.other_info.departmentList.forEach(dept => {
        container.append("button")
            .attr("class", "department")
            .text(title(dept))
            .datum(dept)
            .on("click", function() {
                let btn = d3.select(this);
                let currSelected = btn.classed("selected");
                btn.classed("selected", !currSelected)
                    .classed("was-selected", !currSelected);

                let selectedDepts = [];
                container.selectAll("button.department:not(.all)").each(function() {
                    if (d3.select(this).classed("selected")) {
                        selectedDepts.push(d3.select(this).datum());
                    }
                });
                all_info.filter_info.department = selectedDepts;

                container.select("button.department.all")
                    .classed(
                        "selected", 
                        selectedDepts.length === all_info.other_info.departmentList.length
                    );
                
                updateFilteredDiseasesList(all_info);
                filterDiseases(all_info);

                draw(all_info);
            });
    });

    container.selectAll("button.department").classed("selected", true);
    container.selectAll("button.department:not(.all)").classed("was-selected", true);
    all_info.filter_info.department = all_info.other_info.departmentList.slice();
}

function filterSex(all_info) {
    let container = d3.select(".filter-sex");
    container.selectAll("*").remove();

    container.append("button")
        .attr("class", "sex all")
        .text("All")
        .on("click", function() {
            let allBtn = d3.select(this);
            let wasSelected = allBtn.classed("selected");

            allBtn.classed("selected", !wasSelected);
            container.selectAll("button.sex:not(.all)")
                .classed("selected", !wasSelected)
                .classed("was-selected", !wasSelected);
            all_info.filter_info.sex = !wasSelected ? all_info.other_info.sexList.slice() : [];

            updateFilteredDiseasesList(all_info);
            filterDiseases(all_info);
    
            draw(all_info);
        });

    all_info.other_info.sexList.forEach(sex => {
        container.append("button")
            .attr("class", "sex")
            .text({F: "Female", M: "Male"}[sex])
            .datum(sex)
            .on("click", function() {
                let btn = d3.select(this);
                let currSelected = btn.classed("selected");
                btn.classed("selected", !currSelected)
                    .classed("was-selected", !currSelected);

                let selectedSexes = [];
                container.selectAll("button.sex:not(.all)").each(function() {
                    if (d3.select(this).classed("selected")) {
                        selectedSexes.push(d3.select(this).datum());
                    }
                });
                all_info.filter_info.sex = selectedSexes;

                container.select("button.sex.all")
                    .classed(
                        "selected", 
                        selectedSexes.length === all_info.other_info.sexList.length
                    );

                updateFilteredDiseasesList(all_info);
                filterDiseases(all_info);
                
                draw(all_info);
            });
    });

    container.selectAll("button.sex").classed("selected", true);
    container.selectAll("button.sex:not(.all)").classed("was-selected", true);
    all_info.filter_info.sex = all_info.other_info.sexList.slice();
}

function filterPlotKind(all_info) {
    let container = d3.select(".filter-plotkind");
    container.selectAll("*").remove();

    all_info.other_info.plotKindList.forEach((kind, idx) => {
        let btn = container.append("button")
            .attr("class", "plotkind")
            .text(kind)
            .datum(all_info.other_info.plotKindValueList[idx])
            .on("click", function() {
                let btn = d3.select(this);
                if (btn.classed("selected")) return;
                
                container.selectAll("button.plotkind")
                    .classed("selected", false);
                btn.classed("selected", true);
                
                all_info.filter_info.plotKind = btn.datum();

                draw(all_info);
            });

        if (idx === 0) {
            btn.classed("initial", true).classed("selected", true);
            all_info.filter_info.plotKind = btn.datum();
        }
        if (all_info.other_info.plotKindNeedAbleList.indexOf(btn.datum()) != -1) {
            btn.classed("need-select", true).classed("unable", true).on("click", null);
        }
    });
}

function filterAxis(all_info) {
    let container = all_info.other_info.axisContainer;
    container.selectAll("*").remove();

    let xLabel = container.append("label")
        .attr("class", "x axis-label")
        .html("X-axis: ");

    let xSelect = xLabel.append("select")
        .on("change", function() {
            all_info.plot_info.x_label = d3.select(this).property("value");
            draw(all_info);
        });

    all_info.other_info.axisList.forEach(function(axis) {
        xSelect.append("option")
            .attr("value", axis)
            .text(title(axis));
    });

    all_info.plot_info.x_label = all_info.other_info.axisList[0];

    let yLabel = container.append("label")
        .attr("class", "y axis-label")
        .html("Y-axis: ");

    let ySelect = yLabel.append("select")
        .on("change", function() {
            all_info.plot_info.y_label = d3.select(this).property("value");
            draw(all_info);
        });

    all_info.other_info.axisList.forEach(function(axis) {
        ySelect.append("option")
            .attr("value", axis)
            .text(title(axis));
    });

    all_info.plot_info.y_label = all_info.other_info.axisList[0];
}

function updateFilteredDiseasesList(all_info) {
    let filter_info = all_info.filter_info;
    let data = filter_info.allData;

    if (filter_info.sex.length > 0) {
        data = data.filter(d => filter_info.sex.includes(d.sex));
    }
    
    if (filter_info.department.length > 0) {
        data = data.filter(d => filter_info.department.includes(d.department));
    }

    all_info.other_info.filteredDiseasesList = Array.from(
        d3.group(data, d => d.dx)
    ).map(([dx, rows]) => ({ disease: dx, count: rows.length }))
        .sort((a, b) => a.disease.localeCompare(b.disease));
}

function updateFilterButton(all_info) {
    let filter_info = all_info.filter_info;
    let data = filter_info.allData;

    if (filter_info.disease) {
        data = data.filter(d => d.dx === filter_info.disease);
    }

    updateDepartmentContainer(all_info, data);
    updateSexContainer(all_info, data);

    updatePlotKindButton(all_info, data.length !== all_info.filter_info.allData.length);

    if (!all_info.filter_info.disease) {
        updateFilteredDiseasesList(all_info);
        filterDiseases(all_info);
    }

}

function updateDepartmentContainer(all_info, data) {
    let departmentFilteredList = Array.from(
        new Set(data.map(d => d.department))
    ).sort();
    let container = d3.select(".filter-department")

    container.selectAll("button.department:not(.all)").each(function() {
        let btn = d3.select(this);
        let dept = btn.datum();

        if (departmentFilteredList.indexOf(dept) === -1) {
            btn.classed("unable", true)
                .classed("selected", false)
                .on("click", null);
        } else {
            btn.classed("unable", false)
                .classed("selected", btn.classed("was-selected"))
                .on("click", function() {
                    let btn = d3.select(this);
                    let currSelected = btn.classed("selected");
                    btn.classed("selected", !currSelected)
                        .classed("was-selected", !currSelected);

                    let selectedDepts = [];
                    container.selectAll("button.department:not(.all)").each(function() {
                        if (d3.select(this).classed("selected")) {
                            selectedDepts.push(d3.select(this).datum());
                        }
                    });
                    all_info.filter_info.department = selectedDepts;

                    container.select("button.department.all")
                        .classed(
                            "selected", 
                            selectedDepts.length === all_info.other_info.departmentList.length
                        );
                    
                    updateFilteredDiseasesList(all_info);
                    filterDiseases(all_info);

                    draw(all_info);
                });
        }
    });

    let allBtn = container.select("button.department.all");
    let selectedDepts = [];
    container.selectAll("button.department:not(.all)").each(function() {
        if (d3.select(this).classed("selected")) {
            selectedDepts.push(d3.select(this).datum());
        }
    });
    all_info.filter_info.department = selectedDepts;

    if (departmentFilteredList.length 
                !== all_info.other_info.departmentList.length) {
        allBtn.classed("unable", true)
                .classed("selected", false)
                .on("click", null);
    } else {
        allBtn.classed("unable", false)
            .classed(
                "selected", 
                selectedDepts.length === all_info.other_info.departmentList.length
            ).on("click", function() {
                let allBtn = d3.select(this);
                let wasSelected = allBtn.classed("selected");

                allBtn.classed("selected", !wasSelected);
                container.selectAll("button.department:not(.all)")
                    .classed("selected", !wasSelected)
                    .classed("was-selected", !wasSelected);
                all_info.filter_info.department = 
                    !wasSelected ? all_info.other_info.departmentList.slice() : [];

                updateFilteredDiseasesList(all_info);
                filterDiseases(all_info);
        
                draw(all_info);
            });
    }
}

function updateSexContainer(all_info, data) {
    let sexFilteredList = Array.from(
        new Set(data.map(d => d.sex))
    ).sort();
    let container = d3.select(".filter-sex")

    container.selectAll("button.sex:not(.all)").each(function() {
        let btn = d3.select(this);
        let sex = btn.datum();

        if (sexFilteredList.indexOf(sex) === -1) {
            btn.classed("unable", true)
                .classed("selected", false)
                .on("click", null);
        } else {
            btn.classed("unable", false)
                .classed("selected", btn.classed("was-selected"))
                .on("click", function() {
                    let btn = d3.select(this);
                    let currSelected = btn.classed("selected");
                    btn.classed("selected", !currSelected)
                        .classed("was-selected", !currSelected);

                    let selectedSexes = [];
                    container.selectAll("button.sex:not(.all)").each(function() {
                        if (d3.select(this).classed("selected")) {
                            selectedSexes.push(d3.select(this).datum());
                        }
                    });
                    all_info.filter_info.sex = selectedSexes;

                    container.select("button.sex.all")
                        .classed(
                            "selected", 
                            selectedSexes.length === all_info.other_info.sexList.length
                        );

                    updateFilteredDiseasesList(all_info);
                    filterDiseases(all_info);
                    
                    draw(all_info);
                });
        }
    });

    let allBtn = container.select("button.sex.all");
    let selectedSexes = [];
    container.selectAll("button.sex:not(.all)").each(function() {
        if (d3.select(this).classed("selected")) {
            selectedSexes.push(d3.select(this).datum());
        }
    });
    all_info.filter_info.sex = selectedSexes;

    if (sexFilteredList.length !== all_info.other_info.sexList.length) {
        allBtn.classed("unable", true)
                .classed("selected", false)
                .on("click", null);
    } else {
        allBtn.classed("unable", false)
            .classed(
                "selected", 
                selectedSexes.length === all_info.other_info.sexList.length
            ).on("click", function() {
                let allBtn = d3.select(this);
                let wasSelected = allBtn.classed("selected");

                allBtn.classed("selected", !wasSelected);
                container.selectAll("button.sex:not(.all)")
                    .classed("selected", !wasSelected)
                    .classed("was-selected", !wasSelected);
                all_info.filter_info.sex = !wasSelected ? all_info.other_info.sexList.slice() : [];

                updateFilteredDiseasesList(all_info);
                filterDiseases(all_info);
        
                draw(all_info);
            });
    }
}
  
function updatePlotKindButton(all_info, able) {
    let container = d3.select(".filter-plotkind");
    container.selectAll("button.need-select").each(function() {
        let btn = d3.select(this);
        if (able) {
            btn.classed("unable", false)
                .on("click", function() {
                    let btn = d3.select(this);
                    if (btn.classed("selected")) return;
                    
                    container.selectAll("button.plotkind")
                        .classed("selected", false);
                    btn.classed("selected", true);
                    
                    all_info.filter_info.plotKind = btn.datum();

                    draw(all_info);
            });
        } else {
            if (btn.classed('selected')) {
                let initialBtn = container.select("button.initial").classed("selected", true);
                all_info.filter_info.plotKind = initialBtn.datum();
            }
            btn.classed("unable", true)
                .classed("selected", false)
                .on("click", null);
        }
        

    });
} 

function filterData(all_info) {
    let filter_info = all_info.filter_info;
    let data = filter_info.allData;
    
    if (filter_info.sex.length > 0) {
        data = data.filter(d => filter_info.sex.includes(d.sex));
    }
    
    if (filter_info.department.length > 0) {
        data = data.filter(d => filter_info.department.includes(d.department));
    }

    all_info.plot_info.filteredAllData = data;
    
    if (filter_info.disease) {
        data = data.filter(d => d.dx === filter_info.disease);
        filter_info.legendBox.style("display", "none");
        filter_info.commentBox.style("display", "flex");
    } else {
        filter_info.legendBox.style("display", "flex");
        filter_info.commentBox.style("display", "none");
    }

    all_info.plot_info.filteredData = data;
}

function draw(all_info){
    all_info.plot_info.plotContainer.selectAll("*").remove();
    all_info.plot_info.legendContainer.selectAll("*").remove();
    all_info.plot_info.commentContainer.selectAll("*").remove();

    if (all_info.filter_info.department.length === 0 || all_info.filter_info.sex.length === 0) {
        d3.select(".legend-comment").style("display", "none");
        d3.select(".no-selection").style("display", "flex");
        return;
    }

    d3.select(".legend-comment").style("display", "flex");
    d3.select(".no-selection").style("display", "none");

    filterData(all_info);
    
    switch(all_info.filter_info.plotKind) {
        case "distribution":
            all_info.other_info.axisContainer.select(".x").style("display", "inline");
            all_info.other_info.axisContainer.select(".y").style("display", "none");
            // TODO add cossponding draw function
            drawDistributionPlotChart(all_info);
            break;
        case "scatterPlot":
            all_info.other_info.axisContainer.select(".x").style("display", "inline");
            all_info.other_info.axisContainer.select(".y").style("display", "inline");
            // TODO add cossponding draw function
            drawScatterPlotChart(all_info);
            break;
        case "piePlot":
            all_info.other_info.axisContainer.selectAll(".axis-label").style("display", "none");
            // TODO add cossponding draw function
            drawPiePlotChart(all_info);
            break;
        case "deathRate":
            all_info.other_info.axisContainer.select(".x").style("display", "inline");
            all_info.other_info.axisContainer.select(".y").style("display", "none");
            // TODO add cossponding draw function
            drawDeathRateChart(all_info);
            break;
    }

    all_info.plot_info.legendContainer.selectAll("li:not(.other)").each(function() {
       let li = d3.select(this);
       li.on("click", function() {
        selectDiseaseViaPlot(all_info, li.datum());
       });
    });
}

async function loadPage(){
    let all_info = await loadData();

    filterDiseases(all_info);
    filterDepartment(all_info);
    filterSex(all_info);
    filterPlotKind(all_info);
    filterAxis(all_info);
    
    draw(all_info);
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadPage();

    const svgElement = document.querySelector('svg');
    const svgHeight = svgElement.getBoundingClientRect().height;
    document.documentElement.style.setProperty('--svg-height', svgHeight + 'px');
});

document.addEventListener("click", function(event) {
    let container = document.querySelector(".filter-diseases");
    if (!container.contains(event.target)) {
        container.querySelector(".dropdown-menu").style.display = "none";
    }
});

function selectDiseaseViaPlot(all_info, diseaseName) {
    all_info.filter_info.disease = diseaseName;
    filterDiseases(all_info);
    updateFilterButton(all_info);
    draw(all_info);
}

