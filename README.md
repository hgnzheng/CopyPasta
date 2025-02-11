# CopyPasta
Project 3: Interactive Visualization for DSC 106.

Ideas:
1. Search for disease names and filter the criteria by some basic metrics such as height, weight, etc.
- See https://namerology.com/baby-name-grapher/ for an example.
- Could be a histogram (for example, x could be age group and y is the probability...)

2. Input basic metrics such as height and weight and recommend top k most likely diseases.
- Each disease would serve as a legend; by clicking on each legend, one can visualize the interactive visualization for that disease and see where the person stands relative to other high-risk population.
- Could add a slice bar to filter for different values of metrics.
- Could relate to death rate for a interactive visualization of how death rate changes according to different filters.

Before February 10th at 9:00PM (DONE!)
- Youze: Plot 2 visualizations for Idea 2.
- Rihui: Basic website building.
- Minghan: Plot 2 visualizations for Idea 2.
- Kaijie: Plot 2 visualizations for Idea 1.


Next Steps
- Data preprocessing to remove duplicates, group similar diseases together, etc.
- Convert {Death rate, Count distribution, Disease clustering on height/weights} interactive visualizations with legend in terms of functions.
- Use the following to draw.
  let svg = d3.select('svg');
  let legend = d3.select('.legend');
  {
    allData:
    sex:
    department:
    diseases:
    filteredData: (use this to draw)
    x_label:
    y_label:
  }

Next Meeting: February 14th, Friday at 4:00PM. Tasks are delegated as follows:
Hargen: Convert clustering plot into a function (enable choose of x-y axes.
Rihui, Kaijie: Work on front-end code.
Minghan: Data preprocessing.
