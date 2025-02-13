import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

const dataPath = "data/data.csv"
const axisList = ["age", "height", "weight", "bmi"]
const plotKindList = ["distribution", "piPlot", "scatterPlot"]
const plotKindValueList = ["distribution", "piPlot", "scatterPlot"]


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
        allData: null,
        filteredData: null,
        x_label: null,
        y_label: null,
        plotContainer: d3.select("svg"),
        legendContainer: d3.select(".legend"),
    }
    let filter_info = {
        allData: null,
        sex: [],
        department: [],
        disease: null,
        plotKind: null
    }
    let other_info = {
        axisContainer: d3.select(".filter-axis"),
        diseasesList: null,
        departmentList: null,
        sexList: null,
        plotKindList: plotKindList,
        plotKindValueList: plotKindValueList,
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
        plot_info.allData = data;
        filter_info.allData = data;

        other_info.diseasesList = Array.from(new Set(data.map(d => d.dx))).sort();
        other_info.departmentList = Array.from(new Set(data.map(d => d.department))).sort();
        other_info.sexList = Array.from(new Set(data.map(d => d.sex))).sort();

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
      
      // 在包装容器内添加搜索输入框
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

    ul.append("li")
        .text("Select Diseases")
        .on("click", function() {
            button.text("Select Diseases");
            all_info.filter_info.disease = null;
            menu.style("display", "none");
            draw(all_info);
        });

    all_info.other_info.diseasesList.forEach(function(disease) {
        ul.append("li")
            .text(disease)
            .on("click", function() {
                button.text(disease);
                all_info.filter_info.disease = disease;
                menu.style("display", "none");
                draw(all_info);
            });
    });
}


function filterDepartment(all_info){
    let container = d3.select(".filter-department")
    container.selectAll("*").remove();

    container.append("button")
        .attr("class", "department all")
        .text("All")
        .on("click", function() {
            let allBtn = d3.select(this);
            let wasSelected = allBtn.classed("selected");

            allBtn.classed("selected", !wasSelected);
            container.selectAll("button.department").classed("selected", !wasSelected);
            all_info.filter_info.department = 
                !wasSelected ? all_info.other_info.departmentList.slice() : [];
    
            draw(all_info);
        });

    all_info.other_info.departmentList.forEach(dept => {
        container.append("button")
            .attr("class", "department")
            .text(title(dept))
            .datum(dept)
            .on("click", function() {
                let btn = d3.select(this);
                let wasSelected = btn.classed("selected");
                btn.classed("selected", !wasSelected);

                let selectedDepts = [];
                container.selectAll("button.department:not(.all)").each(function() {
                    if (d3.select(this).classed("selected")) {
                        selectedDepts.push(d3.select(this).datum());
                    }
                });
                all_info.filter_info.department = selectedDepts;

                container
                    .select("button.department.all")
                    .classed(
                        "selected", 
                        selectedDepts.length === all_info.other_info.departmentList.length
                    );
                
                draw(all_info);
            });
    });

    container.selectAll("button.department").classed("selected", true);
    all_info.filter_info.department = all_info.other_info.departmentList.slice();
}

function filterSex(all_info) {
    let container = d3.select(".filter-sex");
    container.selectAll("*").remove();

    // TODO with all or not
    container.append("button")
        .attr("class", "sex all")
        .text("All")
        .on("click", function() {
            let allBtn = d3.select(this);
            let wasSelected = allBtn.classed("selected");

            allBtn.classed("selected", !wasSelected);
            container.selectAll("button.sex").classed("selected", !wasSelected);
            all_info.filter_info.sex = !wasSelected ? all_info.other_info.sexList.slice() : [];
    
            draw(all_info);
        });

    all_info.other_info.sexList.forEach(sex => {
        container.append("button")
            .attr("class", "sex")
            .text({F: "Female", M: "Male"}[sex])
            .datum(sex)
            .on("click", function() {
                let btn = d3.select(this);
                let wasSelected = btn.classed("selected");
                btn.classed("selected", !wasSelected);

                let selectedSexes = [];
                container.selectAll("button.sex:not(.all)").each(function() {
                    if (d3.select(this).classed("selected")) {
                        selectedSexes.push(d3.select(this).datum());
                    }
                });
                all_info.filter_info.sex = selectedSexes;

                // TODO with all or not
                container
                    .select("button.sex.all")
                    .classed(
                        "selected", 
                        selectedSexes.length === all_info.other_info.sexList.length
                    );
                
                draw(all_info);
            });
    });

    container.selectAll("button.sex").classed("selected", true);
    all_info.filter_info.sex = all_info.other_info.sexList.slice();
}

function filterPlotKind(all_info) {
    let container = d3.select(".filter-plotkind");
    container.selectAll("*").remove();

    all_info.other_info.plotKindList.forEach((kind, idx) => {
        let btn = container.append("button")
            .attr("class", "plotkind")
            .text(kind)
            .on("click", function() {
                let btn = d3.select(this);
                if (btn.classed("selected")) return;
                
                container.selectAll("button.plotkind")
                    .classed("selected", false);
                btn.classed("selected", true);
                
                all_info.filter_info.plotKind = all_info.other_info.plotKindValueList[idx];

                draw(all_info);
            });

        if (idx === 0) {
            btn.classed("selected", true);
            all_info.filter_info.plotKind = all_info.other_info.plotKindValueList[0];
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

function filterData(filter_info) {
    let data = filter_info.allData;
    
    if (filter_info.sex.length > 0) {
        data = data.filter(d => filter_info.sex.includes(d.sex));
    }
    
    if (filter_info.department.length > 0) {
        data = data.filter(d => filter_info.department.includes(d.department));
    }
    
    if (filter_info.disease) {
        data = data.filter(d => d.dx === filter_info.disease);
    }
    
    return data;
}

function draw(all_info){
    let svg = all_info.plot_info.plotContainer;
    let legend = all_info.plot_info.legendContainer;
    svg.selectAll("*").remove();
    legend.selectAll("*").remove();

    if (all_info.filter_info.department.length === 0 || all_info.filter_info.sex.length === 0) {
        // svg.style("display", "none");
        d3.select(".legend-box").style("display", "none");
        d3.select(".no-selection").style("display", "flex");
        return;
    }

    // svg.style("display", "inline");
    d3.select(".legend-box").style("display", "flex");
    d3.select(".no-selection").style("display", "none");

    all_info.plot_info.filteredData = filterData(all_info.filter_info);
    
    switch(all_info.filter_info.plotKind) {
        case "distribution":
            all_info.other_info.axisContainer.select(".x").style("display", "inline");
            all_info.other_info.axisContainer.select(".y").style("display", "none");
            break;
        case "piPlot":
            all_info.other_info.axisContainer.selectAll(".axis-label").style("display", "none");
            // TODO add cossponding draw function
            break;
        case "scatterPlot":
            all_info.other_info.axisContainer.select(".x").style("display", "inline");
            all_info.other_info.axisContainer.select(".y").style("display", "inline");
            // TODO add cossponding draw function
    }

    console.log(all_info.plot_info)
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

loadPage();