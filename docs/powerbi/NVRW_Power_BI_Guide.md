# NVRW Power BI Demonstration Guide

This guide creates a reproducible Power BI model from the clean NVRW CSV files.

## Import

Import the CSV files from `data/nvrw/clean/` using **Get data > Text/CSV**. Set identifiers to text, dates to Date, counts to whole number, and financial fields to fixed decimal number.

## Relationships

Create one-to-many relationships from:

- `facilities[facility_id]` to the facility key in visits, programs, transactions, and population projections;
- `members[member_id]` to membership periods, visits, registrations, transactions, and campaign responses;
- `programs[program_id]` to `registrations[program_id]`; and
- `campaigns[campaign_id]` to `campaign_responses[campaign_id]`.

Create a calendar table and relate its date to the date field used by each fact table. Keep only one active date relationship per fact table.

## Measures

```DAX
Total Visits =
COUNTROWS(visits)

Total Contribution Margin =
SUM(transactions[contribution_margin])

Eligible Membership Periods =
CALCULATE(
    COUNTROWS(membership_periods),
    membership_periods[renewed_next_period] <> "Censored"
)

Retained Membership Periods =
CALCULATE(
    COUNTROWS(membership_periods),
    membership_periods[renewed_next_period] = "Yes"
)

Retention Rate =
DIVIDE([Retained Membership Periods], [Eligible Membership Periods])

Program Fill Rate =
DIVIDE(COUNTROWS(registrations), SUM(programs[capacity]))
```

## Recommended report page

Use four KPI cards for total visits, active members, contribution margin, and retention rate. Add a monthly visit line chart, a facility retention bar chart, and a program table containing capacity, registrations, and fill rate. Use a facility slicer and a date-range slicer.

Validate every total against the corresponding CSV or R result before using the report. A visually polished dashboard is not evidence that the relationships or measures are correct.
