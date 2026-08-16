# North Valley Recreation and Wellness
# Reproducible exploratory analysis

library(tidyverse)
library(scales)

clean_path <- "data/nvrw/clean"

visits <- read_csv(file.path(clean_path, "visits.csv"), show_col_types = FALSE) |>
  mutate(visit_date = as.Date(visit_date))

facilities <- read_csv(file.path(clean_path, "facilities.csv"), show_col_types = FALSE)

membership_periods <- read_csv(
  file.path(clean_path, "membership_periods.csv"),
  show_col_types = FALSE
)

monthly_visits <- visits |>
  mutate(month = floor_date(visit_date, "month")) |>
  count(month, facility_id, name = "visits") |>
  left_join(facilities |> select(facility_id, facility_name), by = "facility_id")

monthly_visits |>
  ggplot(aes(month, visits, colour = facility_name)) +
  geom_line(linewidth = 0.9) +
  scale_y_continuous(labels = comma) +
  labs(
    title = "Facility visits increased, but growth was uneven",
    subtitle = "Monthly recorded visits by facility",
    x = NULL,
    y = "Visits",
    colour = "Facility"
  ) +
  theme_minimal(base_size = 12) +
  theme(legend.position = "bottom")

retention_by_facility <- membership_periods |>
  filter(renewed_next_period != "Censored") |>
  mutate(retained = renewed_next_period == "Yes") |>
  left_join(
    read_csv(file.path(clean_path, "members.csv"), show_col_types = FALSE) |>
      select(member_id, home_facility_id),
    by = "member_id"
  ) |>
  group_by(home_facility_id) |>
  summarize(
    eligible_memberships = n(),
    retained_memberships = sum(retained),
    retention_rate = mean(retained),
    .groups = "drop"
  ) |>
  left_join(facilities, by = c("home_facility_id" = "facility_id"))

retention_by_facility
