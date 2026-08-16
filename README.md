# Data Science in Practice

*A Guide for Capstone, Consulting, and Client-Based Work*

This folder contains the Bookdown source for a searchable HTML textbook and professional project reference.

## Build in RStudio

Install the required packages once:

```r
install.packages(c("bookdown", "rmarkdown", "knitr"))
```

Open the project folder in RStudio and run:

```r
bookdown::render_book("index.Rmd", "bookdown::gitbook")
```

The searchable HTML book will be written to `docs/`.

## Contents

The book contains developed chapters on:

- applied data science projects and analytical questioning;
- project planning, team charters, and interim reviews;
- confidentiality and responsible data use;
- data dictionaries and reproducible EDA;
- secondary data and geographic sources;
- machine learning, forecasting, projections, and CLV;
- storytelling, visualization, recommendations, reports, and presentations;
- R, Excel, Power BI, statistics, and machine-learning refreshers; and
- reusable project templates and checklists.

The repository also contains a complete synthetic NVRW data package with raw, clean, and derived CSV files; an Excel workbook; reproducible R scripts; a Power BI implementation guide; and a final synthesis appendix that connects every project component.

The fictional North Valley Recreation and Wellness case connects methods across the book. Shorter industry examples provide additional context.

`SOURCE_INVENTORY.md` records how the uploaded materials were used and which reuse restrictions require attention.
