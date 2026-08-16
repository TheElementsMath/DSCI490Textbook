# North Valley Recreation and Wellness Synthetic Data

This package supports the recurring North Valley Recreation and Wellness (NVRW) case in *Data Science in Practice*. Every organization, person, location, transaction, and result is fictional.

## Repository structure

```text
data/nvrw/
├── raw/                         # Files containing documented quality issues
├── clean/                       # Standardized files for worked demonstrations
├── derived/                     # Analysis-ready summaries and model files
├── data_dictionary.csv          # Dataset and variable definitions
├── NVRW_Analysis_Examples.xlsx  # Excel examples and charts
└── README.md
scripts/
├── build_nvrw_data.mjs          # Deterministic data generator
├── nvrw_import_validate.R       # Import and validation checks
├── nvrw_eda.R                   # Reproducible EDA examples
└── nvrw_analysis.R              # Retention, projections, and CLV examples
powerbi/
└── NVRW_Power_BI_Guide.md       # Data model and measure instructions
```

## Core datasets

| File | Unit of analysis | Purpose |
|---|---|---|
| `facilities.csv` | One facility | Facility attributes and service areas |
| `members.csv` | One synthetic member | Membership profile and acquisition information |
| `membership_periods.csv` | One member-period | Revenue, margin, and renewal outcomes |
| `visits.csv` | One facility visit | Service use by date, location, and category |
| `programs.csv` | One program offering | Schedule, capacity, category, and listed fee |
| `registrations.csv` | One program registration | Registration outcome and amount paid |
| `transactions.csv` | One financial transaction | Revenue, direct cost, and contribution margin |
| `campaigns.csv` | One campaign | Timing, audience, channel, and expenditure |
| `campaign_responses.csv` | One member-campaign contact | Engagement, conversion, and attributed revenue |
| `population_projections.csv` | One area-age-year | Synthetic population estimates and projections |

The `derived` directory includes monthly visits, facility retention, CLV inputs and results, a member-level modelling file, and a utilization-based projection.

## Intended quality problems

The raw files contain a small number of realistic issues for instructional use:

- duplicated visit identifiers;
- missing and implausible visit durations;
- missing postal FSAs;
- unknown service areas; and
- inconsistent capitalization in membership types.

These issues are intentional. They are identified in `data_dictionary.csv` and addressed by the accompanying R scripts. The clean files should be used when the purpose is to reproduce the published worked examples.

## Reproducibility

The data generator uses a fixed seed. Run it from the project root with the JavaScript runtime and dependencies described by the project environment. The R scripts assume the working directory is the Bookdown project root.

## Suggested citation

> [Author]. (2026). *North Valley Recreation and Wellness synthetic data* [Data set]. In *Data Science in Practice: A Guide for Capstone, Consulting, and Client-Based Work*.

## Rights

Copyright © [Year] [Copyright holder]. All rights reserved. No real personal or organizational information is included.
