# North Valley Recreation and Wellness
# Retention, utilization projection, and CLV examples

library(tidyverse)

clean_path <- "data/nvrw/clean"
derived_path <- "data/nvrw/derived"

model_data <- read_csv(file.path(derived_path, "member_model.csv"), show_col_types = FALSE) |>
  filter(retained_after_first_period != "Censored") |>
  mutate(retained_after_first_period = factor(retained_after_first_period))

retention_model <- glm(
  retained_after_first_period ~ visits_first_90_days +
    program_registrations_first_year + membership_type + home_facility_id,
  data = model_data,
  family = binomial()
)

summary(retention_model)

projection <- read_csv(
  file.path(derived_path, "utilization_projection.csv"),
  show_col_types = FALSE
)

projection |>
  filter(year %in% c(2025, 2030)) |>
  select(facility_name, year, population, projected_visits_constant_rate) |>
  arrange(facility_name, year)

clv <- read_csv(
  file.path(derived_path, "clv_by_membership_type.csv"),
  show_col_types = FALSE
)

clv |>
  arrange(desc(estimated_clv)) |>
  select(
    membership_type,
    retention_rate,
    average_annual_margin,
    assumed_cac,
    estimated_clv
  )

# The model and CLV estimates are descriptive instructional examples.
# They should not be interpreted as causal estimates of intervention effects.
