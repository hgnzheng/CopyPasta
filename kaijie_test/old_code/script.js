/***********************
 * 全局变量/选择器
 ***********************/
let dataAll = [];            // 读入的全部数据
let deptListAll = [];        // 所有科室
const dxSelect  = d3.select("#dxSelect");
const dxSearch  = d3.select("#dxSearch");
const attrSelect= d3.select("#attrSelect");
const deptContainer = d3.select("#deptChecks");

// 堆叠图
const svg = d3.select("#chart"),
      width = +svg.attr("width"),
      height= +svg.attr("height"),
      margin= { top: 40, right: 150, bottom: 50, left: 60 };
let xAxisG, yAxisG, xScale, yScale, stackGen, areaGen, colorScale;
const tooltip = d3.select("#tooltip");

// 饼图
const pieSvg   = d3.select("#pieChart"),
      pieWidth = +pieSvg.attr("width"),
      pieHeight= +pieSvg.attr("height"),
      pieRadius= Math.min(pieWidth, pieHeight)/2 - 20;
const pieTooltip= d3.select("#pieTooltip");
const pieInfo   = d3.select("#pieInfo");

/***********************
 * 1) 读取CSV并初始化
 ***********************/
d3.csv("mydata.csv").then(data => {
  // 转数值
  data.forEach(d => {
    d.age    = +d.age;
    d.height = +d.height;
    d.weight = +d.weight;
    d.bmi    = +d.bmi;
  });
  dataAll = data;

  // 提取所有科室
  deptListAll = Array.from(new Set(dataAll.map(d => d.department))).sort();
  // 渲染 dept 多选
  renderDeptCheckboxes(deptListAll);

  // 事件绑定
  dxSelect.on("change", updateAllCharts);
  attrSelect.on("change", updateAllCharts);
  dxSearch.on("input", () => updateAllCharts() ); // 在此也可

  // 初次绘图
  updateAllCharts();
});

/***********************
 * 2) 多选框 (Select All, 各科室)
 ***********************/
function renderDeptCheckboxes(depts){
  deptContainer.selectAll("*").remove();

  // (Select All) 选项
  const allLabel = deptContainer.append("label");
  allLabel.append("input")
    .attr("type","checkbox")
    .attr("value","__ALL__")
    .on("change", onDeptAllChange);
  allLabel.append("span").text("(Select All)");

  // 具体科室
  depts.forEach(dept => {
    const lb = deptContainer.append("label");
    lb.append("input")
      .attr("type","checkbox")
      .attr("value", dept)
      .on("change", onDeptChange);
    lb.append("span").text(dept);
  });

  // 默认全选
  deptContainer.selectAll("input[type=checkbox]").property("checked",true);
}

function onDeptAllChange(e){
  const checked = e.target.checked;
  deptContainer.selectAll("input[type=checkbox]")
    .property("checked", checked);
  updateAllCharts();
}
function onDeptChange(e){
  if(!e.target.checked){
    deptContainer.select("input[value='__ALL__']").property("checked",false);
  }
  updateAllCharts();
}

/***********************
 * 3) 主更新函数
 ***********************/
function updateAllCharts(){
  // 先更新 disease 下拉
  updateDiseaseDropdown();

  // 然后获取当前选项
  const selectedDx   = dxSelect.property("value");
  const selectedAttr = attrSelect.property("value");
  const selectedDepts= getSelectedDepts();

  // 1) 堆叠图
  updateStackedChart(selectedDx, selectedAttr, selectedDepts);

  // 2) 饼图
  updatePieChart(selectedDx, selectedDepts);
}

/***********************
 * 3.1) 更新 Disease 下拉
 ***********************/
function updateDiseaseDropdown(){
  // 获取当前选中的 dx
  const oldDx = dxSelect.property("value");

  // 根据当前 dept 过滤 dataAll
  const selectedDepts = getSelectedDepts();
  let deptData = dataAll.filter(d => selectedDepts.includes(d.department));
  if(selectedDepts.length===0) deptData = [];

  // 统计 disease
  const dxCounts = d3.rollup(deptData, v=>v.length, d=>d.dx);
  let dxArr = Array.from(dxCounts, ([dx,count])=>({dx,count}))
                   .sort((a,b)=> d3.descending(a.count,b.count));

  // 搜索框过滤
  const kw = dxSearch.property("value").trim().toLowerCase();
  if(kw){
    dxArr = dxArr.filter(d => d.dx.toLowerCase().includes(kw));
  }

  // 加 "ALL" 在最前
  const sumCount = d3.sum(dxArr, d=>d.count);
  dxArr = [{dx:"ALL", count: sumCount}, ...dxArr];

  // 重绘下拉
  dxSelect.selectAll("option").remove();
  dxSelect.selectAll("option")
    .data(dxArr)
    .enter()
    .append("option")
    .attr("value", d=>d.dx)
    .text(d => `${d.dx} (${d.count})`);

  // 若 oldDx 不在此 list => 选 ALL
  const stillIn = dxArr.some(d=> d.dx===oldDx);
  dxSelect.property("value", stillIn ? oldDx : "ALL");
}

/***********************
 * 3.2) 获取选中科室
 ***********************/
function getSelectedDepts(){
  const arr = [];
  deptContainer.selectAll("input[type=checkbox]")
    .each(function(){
      if(this.value==="__ALL__") return;
      if(this.checked) arr.push(this.value);
    });
  return arr;
}

/***********************
 * 3.3) 堆叠图
 ***********************/
function updateStackedChart(dxVal, attrVal, deptList){
  // 过滤 dept
  let deptData = dataAll.filter(d => deptList.includes(d.department));
  if(deptList.length===0) deptData=[];

  // 若 dx != ALL => 仅保留对应病
  let finalData;
  if(dxVal==="ALL"){
    finalData = deptData;
  } else {
    finalData = deptData.filter(d => d.dx===dxVal);
  }

  // 收集 allDx (if ALL => 多病，否则1)
  let allDx;
  if(dxVal==="ALL"){
    allDx = Array.from(new Set(finalData.map(d=>d.dx))).sort();
  } else {
    allDx = [dxVal];
  }

  // 分箱
  const binMap = new Map();
  finalData.forEach(r=>{
    const binName = getBin(r[attrVal], attrVal);
    if(!binMap.has(binName)) binMap.set(binName,new Map());
    const dxKey = r.dx;
    const dxCountMap = binMap.get(binName);
    if(!dxCountMap.has(dxKey)) dxCountMap.set(dxKey,0);
    dxCountMap.set(dxKey, dxCountMap.get(dxKey)+1);
  });

  // rowData
  const rowData = [];
  for(let [binName, dxCountMap] of binMap.entries()){
    const rowObj = {bin: binName};
    allDx.forEach(dk=>{
      rowObj[dk] = dxCountMap.get(dk)||0;
    });
    rowData.push(rowObj);
  }
  rowData.sort((a,b)=> parseBin(a.bin)-parseBin(b.bin));

  // x,y scale
  xScale = d3.scaleBand()
             .domain(rowData.map(d=>d.bin))
             .range([margin.left, width-margin.right])
             .padding(0.1);
  const maxVal = d3.max(rowData, d=> allDx.reduce((acc,k)=> acc+d[k],0)) || 1;
  yScale = d3.scaleLinear()
             .domain([0,maxVal])
             .range([height-margin.bottom, margin.top])
             .nice();
  
  colorScale = d3.scaleOrdinal()
                 .domain(allDx)
                 .range(d3.schemeSet2);

  stackGen = d3.stack().keys(allDx);
  const series = stackGen(rowData);

  areaGen = d3.area()
    .x(d=> xScale(d.data.bin)+ xScale.bandwidth()/2)
    .y0(d=> yScale(d[0]))
    .y1(d=> yScale(d[1]))
    .curve(d3.curveCardinal);

  // data join
  let layers = svg.selectAll("path.layer")
    .data(series, d=>d.key);

  // exit
  layers.exit()
    .transition().duration(500)
    .attr("fill-opacity",0)
    .remove();

  // enter+update
  layers.enter()
    .append("path")
    .attr("class","layer")
    .attr("fill-opacity",0)
    .attr("fill", d=> colorScale(d.key))
    .merge(layers)
    .on("mousemove",(evt,d)=>{
      const [mx,my] = d3.pointer(evt);
      tooltip.style("left",(mx)+"px")
             .style("top",(my)+"px");
    })
    .on("mouseover",(evt,d)=>{
      tooltip.html(`dx: <b>${d.key}</b>`)
             .style("opacity",1);
    })
    .on("mouseout",(evt,d)=>{
      tooltip.style("opacity",0);
    })
    .transition().duration(800)
    .attr("fill", d=> colorScale(d.key))
    .attr("fill-opacity",0.8)
    .attr("d", areaGen);

  // 轴
  if(!xAxisG){
    xAxisG = svg.append("g")
      .attr("class","axis x-axis")
      .attr("transform",`translate(0,${height-margin.bottom})`);
    yAxisG = svg.append("g")
      .attr("class","axis y-axis")
      .attr("transform",`translate(${margin.left},0)`);
  }
  xAxisG.transition().duration(800)
        .call(d3.axisBottom(xScale))
        .selectAll("text")
        .style("text-anchor","end")
        .attr("transform","rotate(-90) translate(-10,-5)");

  yAxisG.transition().duration(800)
        .call(d3.axisLeft(yScale));

  // legend
  svg.selectAll(".legend").remove();
  const legend = svg.selectAll(".legend")
    .data(allDx)
    .enter()
    .append("g")
    .attr("class","legend")
    .attr("transform",(d,i)=>`translate(${width-margin.right+10},${margin.top+i*20})`);
  legend.append("rect")
    .attr("width",15)
    .attr("height",15)
    .attr("fill", d=>colorScale(d));
  legend.append("text")
    .attr("x",20)
    .attr("y",12)
    .style("fill","#333")
    .style("font-size","0.8rem")
    .text(d=>d);
}

/***********************
 * 3.4) 饼图
 ***********************/
function updatePieChart(dxVal, deptList){
  let deptData = dataAll.filter(d=> deptList.includes(d.department));
  if(deptList.length===0) deptData=[];

  const totalDept = deptData.length;
  let countDx;
  if(dxVal==="ALL"){
    countDx = totalDept;
  } else {
    countDx = deptData.filter(d=> d.dx===dxVal).length;
  }
  const countOthers = totalDept - countDx;

  const pieData = [
    { name:"Selected", value:countDx },
    { name:"Others",   value:countOthers }
  ];

  const pie = d3.pie().sort(null).value(d=>d.value);
  const arcs= pie(pieData);

  const arcGen = d3.arc().outerRadius(pieRadius).innerRadius(0);

  // 两色
  const pieColor = d3.scaleOrdinal()
                    .domain(["Selected","Others"])
                    .range(["#2ecc71","#e67e22"]);

  let paths = pieSvg.selectAll("path.arcSlice").data(arcs, d=>d.data.name);
  // exit
  paths.exit()
    .transition().duration(500)
    .attr("fill-opacity",0)
    .remove();

  // enter+update
  paths.enter()
    .append("path")
    .attr("class","arcSlice")
    .attr("fill-opacity",0)
    .merge(paths)
    .on("mousemove",(evt,d)=>{
      const [mx,my] = d3.pointer(evt);
      pieTooltip.style("left",(mx+200)+"px")
                .style("top",(my+150)+"px");
    })
    .on("mouseover",(evt,d)=>{
      const ratio = (totalDept>0)? (d.data.value*100/totalDept).toFixed(1)+"%" : "N/A";
      pieTooltip.html(`${d.data.name}: <b>${d.data.value}</b> (${ratio})`)
                .style("opacity",1);
    })
    .on("mouseout",()=>{
      pieTooltip.style("opacity",0);
    })
    .transition().duration(800)
    .attr("fill", d=>pieColor(d.data.name))
    .attr("fill-opacity",1)
    .attrTween("d",function(d){
      const i = d3.interpolate(this._current||d, d);
      this._current = i(1);
      return t => arcGen(i(t));
    });

  const cx = pieWidth/2, cy = pieHeight/2;
  pieSvg.selectAll("path.arcSlice")
        .attr("transform",`translate(${cx},${cy})`);

  // 弧上文字
  pieSvg.selectAll(".pieLabel").remove();
  pieSvg.selectAll(".pieLabel")
    .data(arcs)
    .enter()
    .append("text")
    .attr("class","pieLabel")
    .attr("transform", d=>{
      const mid = (d.startAngle + d.endAngle)/2;
      const x = Math.cos(mid)*pieRadius*0.6;
      const y = Math.sin(mid)*pieRadius*0.6;
      return `translate(${cx+x},${cy+y})`;
    })
    .attr("text-anchor","middle")
    .attr("dy","0.35em")
    .style("font-size","0.8rem")
    .text(d=>{
      if(totalDept===0) return "";
      const pct = d.data.value*100/totalDept;
      return (pct<3)?"": pct.toFixed(1)+"%";
    });

  // 图例
  pieSvg.selectAll(".pieLegend").remove();
  const legendData = ["Selected","Others"];
  const lG = pieSvg.selectAll(".pieLegend")
    .data(legendData)
    .enter()
    .append("g")
    .attr("class","pieLegend")
    .attr("transform",(d,i)=>`translate(${cx+pieRadius+30},${cy-30+i*20})`);
  lG.append("rect")
    .attr("width",15)
    .attr("height",15)
    .attr("fill", d=>pieColor(d));
  lG.append("text")
    .attr("x",20)
    .attr("y",12)
    .style("font-size","0.8rem")
    .style("fill","#333")
    .text(d=>d);

  // 右侧文字
  if(deptList.length===0){
    pieInfo.html("No department selected. Pie is empty.");
    return;
  }
  const joinedDept = deptList.join(", ");
  const dxName = (dxVal==="ALL") ? "ALL diseases" : dxVal;
  const ratio = (totalDept>0)? ((countDx*100)/totalDept).toFixed(1)+"%" : "N/A";

  let txt;
  if(deptList.length===1){
    txt = `<b>${dxName}</b> belongs to ${joinedDept}. It accounts for ${ratio} of that department's patients.`;
  } else {
    txt = `<b>${dxName}</b> belongs to [${joinedDept}]. It accounts for ${ratio} of these departments' patients.`;
  }
  pieInfo.html(txt);
}

/***********************
 * 工具函数: getBin/parseBin
 ***********************/
function getBin(value, attr){
  if(attr==="sex"){
    return (value==="M")?"M":"F";
  } else {
    if(isNaN(value)) return "N/A";
    const step=5;
    const binLow= Math.floor(value/step)*step;
    const binHigh= binLow + step -1;
    return `${binLow}-${binHigh}`;
  }
}
function parseBin(binStr){
  if(binStr==="M") return 100000;
  if(binStr==="F") return 100001;
  if(binStr==="N/A") return 100002;
  const parts= binStr.split("-");
  return +parts[0];
}
