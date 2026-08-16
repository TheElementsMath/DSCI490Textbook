# North Valley Recreation and Wellness
# Import and validation checks

library(tidyverse)
library(janitor)

raw_path <- "data/nvrw/raw"

members_raw <- read_csv(file.path(raw_path, "members.csv"), show_col_types = FALSE)
visits_raw <- read_csv(file.path(raw_path, "visits.csv"), show_col_types = FALSE)
membership_periods <- read_csv(
  file.path(raw_path, "membership_periods.csv"),
  show_col_types = FALSE
)

member_key_check <- members_raw |>
  count(member_id, name = "records") |>
  filter(records > 1)

visit_key_check <- visits_raw |>
  count(visit_id, name = "records") |>
  filter(records > 1)

visit_quality_summary <- visits_raw |>
  summarize(
    rows = n(),
    distinct_visit_ids = n_distinct(visit_id),
    duplicated_rows = rows - distinct_visit_ids,
    missing_duration = sum(is.na(duration_minutes)),
    implausible_duration = sum(duration_minutes > 360, na.rm = TRUE)
  )

members_clean <- members_raw |>
  mutate(
    membership_type = str_to_sentence(membership_type),
    service_area = na_if(service_area, "Unknown"),
    postal_fsa = na_if(postal_fsa, "")
  )

visits_clean <- visits_raw |>
  distinct(visit_id, .keep_all = TRUE) |>
  mutate(
    visit_date = as.Date(visit_date),
    duration_minutes = if_else(
      duration_minutes > 360,
      NA_real_,
      as.numeric(duration_minutes)
    )
  )

stopifnot(nrow(member_key_check) == 0)
stopifnot(nrow(visits_clean) == n_distinct(visits_clean$visit_id))
stopifnot(all(membership_periods$renewed_next_period %in% c("Yes", "No", "Censored")))

visit_quality_summary
