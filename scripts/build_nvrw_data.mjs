import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const projectRoot = path.resolve(process.cwd());
const packageRoot = path.join(projectRoot, "data", "nvrw");
const rawDir = path.join(packageRoot, "raw");
const cleanDir = path.join(packageRoot, "clean");
const derivedDir = path.join(packageRoot, "derived");
const figureDir = path.join(projectRoot, "figures");
await Promise.all([rawDir, cleanDir, derivedDir, figureDir].map((d) => fs.mkdir(d, { recursive: true })));

function mulberry32(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(4902026);
const choice = (items, weights = null) => {
  if (!weights) return items[Math.floor(rng() * items.length)];
  const total = weights.reduce((a, b) => a + b, 0);
  let draw = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    draw -= weights[i];
    if (draw <= 0) return items[i];
  }
  return items.at(-1);
};
const poisson = (lambda) => {
  const limit = Math.exp(-lambda);
  let product = 1;
  let count = 0;
  do { count += 1; product *= rng(); } while (product > limit);
  return count - 1;
};
const pad = (n, width) => String(n).padStart(width, "0");
const iso = (date) => date.toISOString().slice(0, 10);
const randomDate = (start, end) => new Date(start.getTime() + rng() * (end.getTime() - start.getTime()));
const csvEscape = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
async function writeCsv(filePath, rows) {
  if (!rows.length) throw new Error(`No rows supplied for ${filePath}`);
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(","))];
  await fs.writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
}

const facilities = [
  { facility_id: "F01", facility_name: "Downtown Centre", service_area: "Central", opened_year: 2008, floor_area_sq_m: 5100, pool_available: "Yes" },
  { facility_id: "F02", facility_name: "Lakeside Centre", service_area: "East Shore", opened_year: 2015, floor_area_sq_m: 4200, pool_available: "Yes" },
  { facility_id: "F03", facility_name: "North Ridge Centre", service_area: "North Valley", opened_year: 1999, floor_area_sq_m: 3300, pool_available: "No" },
  { facility_id: "F04", facility_name: "Westbrook Centre", service_area: "West Valley", opened_year: 2021, floor_area_sq_m: 3900, pool_available: "No" },
];
const facilityWeights = [0.34, 0.25, 0.18, 0.23];
const ageGroups = ["Under 18", "18-34", "35-49", "50-64", "65+"];
const ageWeights = [0.08, 0.29, 0.27, 0.22, 0.14];
const membershipTypes = ["Adult annual", "Family annual", "Youth annual", "Senior annual", "Monthly flexible"];
const membershipWeights = [0.34, 0.22, 0.08, 0.14, 0.22];
const channels = ["Organic web", "Referral", "Community event", "Paid social", "Email", "Walk-in"];
const channelWeights = [0.24, 0.21, 0.12, 0.15, 0.10, 0.18];
const feeMap = { "Adult annual": 540, "Family annual": 840, "Youth annual": 300, "Senior annual": 390, "Monthly flexible": 480 };
const marginRateMap = { "Adult annual": 0.44, "Family annual": 0.39, "Youth annual": 0.31, "Senior annual": 0.36, "Monthly flexible": 0.41 };
const baseVisitMap = { "Adult annual": 2.2, "Family annual": 2.8, "Youth annual": 2.5, "Senior annual": 2.0, "Monthly flexible": 1.3 };

const membersClean = [];
for (let i = 1; i <= 1400; i += 1) {
  const facility = choice(facilities, facilityWeights);
  const joinYear = choice([2022, 2023, 2024, 2025], [0.22, 0.29, 0.31, 0.18]);
  const joinDate = randomDate(new Date(`${joinYear}-01-05T12:00:00Z`), new Date(`${joinYear}-11-25T12:00:00Z`));
  const membershipType = choice(membershipTypes, membershipWeights);
  const engagement = Math.max(0.2, Math.min(1.8, 0.45 + rng() * 1.25));
  membersClean.push({
    member_id: `M${pad(i, 5)}`,
    household_id: `H${pad(Math.ceil(i / choice([1, 1, 1, 2, 3])), 5)}`,
    join_date: iso(joinDate),
    home_facility_id: facility.facility_id,
    service_area: facility.service_area,
    age_group: choice(ageGroups, ageWeights),
    membership_type: membershipType,
    acquisition_channel: choice(channels, channelWeights),
    marketing_consent: rng() < 0.72 ? "Yes" : "No",
    postal_fsa: choice(["V1A", "V1B", "V1C", "V1D", "V1E"], [0.22, 0.19, 0.25, 0.18, 0.16]),
    engagement_score: Number(engagement.toFixed(3)),
  });
}

const membershipPeriods = [];
const visitsClean = [];
const transactions = [];
const memberFeatures = [];
let visitCounter = 1;
let transactionCounter = 1;

for (const member of membersClean) {
  const joinYear = Number(member.join_date.slice(0, 4));
  let active = true;
  let firstYearVisits = 0;
  let first90Visits = 0;
  let activeYears = 0;
  let totalMargin = 0;
  let programRegistrations = 0;
  let retainedFirstEligible = null;
  for (let year = joinYear; year <= 2025 && active; year += 1) {
    activeYears += 1;
    const periodStart = year === joinYear ? member.join_date : `${year}-01-01`;
    const periodEnd = `${year}-12-31`;
    const fee = feeMap[member.membership_type];
    const discount = choice([0, 0, 0, 25, 50, 75], [0.5, 0.12, 0.08, 0.12, 0.11, 0.07]);
    const annualRevenue = fee - discount;
    const margin = annualRevenue * marginRateMap[member.membership_type];
    totalMargin += margin;
    const renewalProbability = Math.max(0.35, Math.min(0.94,
      0.49 + 0.23 * member.engagement_score + (member.membership_type === "Family annual" ? 0.06 : 0) + (member.home_facility_id === "F02" ? 0.03 : 0) - (member.membership_type === "Monthly flexible" ? 0.10 : 0)
    ));
    const renewed = year < 2025 ? rng() < renewalProbability : null;
    if (year === joinYear && year < 2025) retainedFirstEligible = renewed ? 1 : 0;
    membershipPeriods.push({
      membership_period_id: `MP${pad(membershipPeriods.length + 1, 6)}`,
      member_id: member.member_id,
      period_year: year,
      period_start: periodStart,
      period_end: periodEnd,
      membership_type: member.membership_type,
      list_fee: fee,
      discount_amount: discount,
      net_membership_revenue: annualRevenue,
      contribution_margin: Number(margin.toFixed(2)),
      renewed_next_period: renewed === null ? "Censored" : renewed ? "Yes" : "No",
    });
    transactions.push({
      transaction_id: `T${pad(transactionCounter++, 7)}`,
      member_id: member.member_id,
      transaction_date: periodStart,
      facility_id: member.home_facility_id,
      revenue_type: "Membership",
      gross_revenue: annualRevenue,
      direct_cost: Number((annualRevenue - margin).toFixed(2)),
      contribution_margin: Number(margin.toFixed(2)),
    });
    for (let month = 1; month <= 12; month += 1) {
      if (year === joinYear && month < Number(member.join_date.slice(5, 7))) continue;
      const season = [0.92, 1.05, 1.10, 1.02, 0.98, 0.90, 0.76, 0.78, 0.98, 1.08, 1.12, 0.88][month - 1];
      const facilityEffect = { F01: 1.08, F02: 1.14, F03: 0.84, F04: 0.96 }[member.home_facility_id];
      const expected = baseVisitMap[member.membership_type] * member.engagement_score * season * facilityEffect;
      const visitCount = poisson(expected);
      for (let v = 0; v < visitCount; v += 1) {
        const day = 1 + Math.floor(rng() * 27);
        const visitDate = `${year}-${pad(month, 2)}-${pad(day, 2)}`;
        const facilityId = rng() < 0.84 ? member.home_facility_id : choice(facilities).facility_id;
        const serviceCategory = choice(["Fitness", "Aquatics", "Gymnasium", "Group class", "Open recreation"], [0.31, 0.22, 0.17, 0.14, 0.16]);
        const duration = Math.max(15, Math.round(30 + rng() * 100));
        visitsClean.push({
          visit_id: `V${pad(visitCounter++, 8)}`,
          member_id: member.member_id,
          visit_date: visitDate,
          facility_id: facilityId,
          service_category: serviceCategory,
          check_in_hour: choice([6, 7, 8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20], [4, 5, 4, 3, 3, 3, 3, 3, 5, 8, 10, 9, 4]),
          duration_minutes: duration,
          source_system: rng() < 0.94 ? "Access control" : "Front desk entry",
        });
        if (year === joinYear) {
          firstYearVisits += 1;
          const join = new Date(`${member.join_date}T00:00:00Z`);
          const visit = new Date(`${visitDate}T00:00:00Z`);
          if ((visit - join) / 86400000 <= 90) first90Visits += 1;
        }
      }
    }
    if (year < 2025 && !renewed) active = false;
  }
  programRegistrations = poisson(0.6 + member.engagement_score * 1.3);
  memberFeatures.push({
    member_id: member.member_id,
    join_year: joinYear,
    home_facility_id: member.home_facility_id,
    age_group: member.age_group,
    membership_type: member.membership_type,
    acquisition_channel: member.acquisition_channel,
    visits_first_90_days: first90Visits,
    visits_first_membership_year: firstYearVisits,
    program_registrations_first_year: programRegistrations,
    active_years_observed: activeYears,
    contribution_margin_observed: Number(totalMargin.toFixed(2)),
    retained_after_first_period: retainedFirstEligible === null ? "Censored" : retainedFirstEligible,
  });
}

const programCategories = ["Aquatics", "Fitness", "Youth", "Older adult", "Arts and wellness", "Recreation league"];
const programs = [];
const registrations = [];
let registrationCounter = 1;
for (let year = 2023; year <= 2025; year += 1) {
  for (const facility of facilities) {
    for (let p = 1; p <= 8; p += 1) {
      const category = choice(programCategories);
      const month = choice([1, 2, 4, 5, 7, 9, 10, 11]);
      const programId = `P${year}${facility.facility_id.slice(1)}${pad(p, 2)}`;
      const capacity = choice([16, 20, 24, 30, 40]);
      const fee = choice([45, 60, 75, 90, 120]);
      programs.push({
        program_id: programId,
        facility_id: facility.facility_id,
        program_year: year,
        program_name: `${category} Series ${p}`,
        program_category: category,
        start_date: `${year}-${pad(month, 2)}-05`,
        end_date: `${year}-${pad(Math.min(12, month + 2), 2)}-20`,
        capacity,
        listed_fee: fee,
      });
      const demandFactor = { F01: 0.92, F02: 1.08, F03: 0.72, F04: 0.84 }[facility.facility_id];
      const registrationsCount = Math.min(capacity + choice([0, 0, 2, 4]), Math.max(4, Math.round(capacity * demandFactor * (0.72 + rng() * 0.42))));
      for (let r = 0; r < registrationsCount; r += 1) {
        const member = choice(membersClean);
        const attended = rng() < (0.78 + member.engagement_score * 0.08);
        const amountPaid = fee - choice([0, 0, 0, 10, 15]);
        registrations.push({
          registration_id: `R${pad(registrationCounter++, 7)}`,
          program_id: programId,
          member_id: member.member_id,
          registration_date: `${year}-${pad(Math.max(1, month - 1), 2)}-${pad(1 + Math.floor(rng() * 25), 2)}`,
          registration_status: attended ? "Completed" : choice(["Cancelled", "No-show"], [0.7, 0.3]),
          amount_paid: amountPaid,
        });
        transactions.push({
          transaction_id: `T${pad(transactionCounter++, 7)}`,
          member_id: member.member_id,
          transaction_date: `${year}-${pad(Math.max(1, month - 1), 2)}-${pad(1 + Math.floor(rng() * 25), 2)}`,
          facility_id: facility.facility_id,
          revenue_type: "Program",
          gross_revenue: amountPaid,
          direct_cost: Number((amountPaid * 0.46).toFixed(2)),
          contribution_margin: Number((amountPaid * 0.54).toFixed(2)),
        });
      }
    }
  }
}

const campaigns = [];
const campaignResponses = [];
let responseCounter = 1;
for (let i = 1; i <= 12; i += 1) {
  const year = i <= 4 ? 2023 : i <= 8 ? 2024 : 2025;
  const month = ((i - 1) % 4) * 3 + 1;
  const channel = choice(["Paid social", "Email", "Community event", "Search"]);
  const spend = choice([2400, 3200, 4500, 6000, 7500]);
  const campaignId = `C${pad(i, 3)}`;
  campaigns.push({
    campaign_id: campaignId,
    campaign_name: `${year} ${choice(["New year", "Spring", "Summer", "Fall"])} membership campaign`,
    start_date: `${year}-${pad(month, 2)}-01`,
    end_date: `${year}-${pad(month, 2)}-28`,
    channel,
    target_segment: choice(["New residents", "Families", "Adults 18-34", "Former members", "General"]),
    campaign_spend: spend,
  });
  const audience = 180 + Math.floor(rng() * 260);
  for (let j = 0; j < audience; j += 1) {
    const member = choice(membersClean);
    const converted = rng() < (channel === "Email" ? 0.10 : channel === "Community event" ? 0.075 : 0.045);
    campaignResponses.push({
      response_id: `CR${pad(responseCounter++, 7)}`,
      campaign_id: campaignId,
      member_id: member.member_id,
      contacted: "Yes",
      clicked_or_engaged: rng() < 0.22 ? "Yes" : "No",
      converted_membership: converted ? "Yes" : "No",
      attributed_revenue: converted ? feeMap[member.membership_type] : 0,
    });
  }
}

const population = [];
const basePopulation = {
  Central: [5400, 9200, 8800, 7100, 5100],
  "East Shore": [4200, 6900, 7200, 6100, 4300],
  "North Valley": [3500, 4800, 5200, 4700, 3900],
  "West Valley": [4100, 6400, 6600, 5200, 3600],
};
for (const facility of facilities) {
  for (let a = 0; a < ageGroups.length; a += 1) {
    const annualGrowth = [0.011, 0.018, 0.015, 0.020, 0.027][a] + (facility.facility_id === "F04" ? 0.006 : 0);
    for (let year = 2023; year <= 2030; year += 1) {
      population.push({
        service_area: facility.service_area,
        facility_id: facility.facility_id,
        age_group: ageGroups[a],
        year,
        population: Math.round(basePopulation[facility.service_area][a] * ((1 + annualGrowth) ** (year - 2023))),
        scenario: year <= 2025 ? "Observed estimate" : "Central projection",
      });
    }
  }
}

const visitsRaw = visitsClean.map((row) => ({ ...row }));
for (let i = 0; i < visitsRaw.length; i += 1) {
  if (rng() < 0.018) visitsRaw[i].duration_minutes = "";
  if (rng() < 0.002) visitsRaw[i].duration_minutes = 720;
  if (rng() < 0.006) visitsRaw.push({ ...visitsRaw[i] });
}
const membersRaw = membersClean.map((row) => ({ ...row }));
for (const row of membersRaw) {
  if (rng() < 0.025) row.postal_fsa = "";
  if (rng() < 0.012) row.service_area = "Unknown";
  if (rng() < 0.015) row.membership_type = row.membership_type.toUpperCase();
}

const monthlyMap = new Map();
for (const row of visitsClean) {
  const month = row.visit_date.slice(0, 7);
  const key = `${month}|${row.facility_id}`;
  monthlyMap.set(key, (monthlyMap.get(key) || 0) + 1);
}
const monthlyVisits = [...monthlyMap.entries()].map(([key, visits]) => {
  const [month, facilityId] = key.split("|");
  return { month, facility_id: facilityId, visits };
}).sort((a, b) => a.month.localeCompare(b.month) || a.facility_id.localeCompare(b.facility_id));

const retentionByFacility = facilities.map((facility) => {
  const eligible = memberFeatures.filter((r) => r.home_facility_id === facility.facility_id && r.retained_after_first_period !== "Censored");
  const retained = eligible.reduce((sum, r) => sum + Number(r.retained_after_first_period), 0);
  return {
    facility_id: facility.facility_id,
    facility_name: facility.facility_name,
    eligible_members: eligible.length,
    retained_members: retained,
    retention_rate: Number((retained / eligible.length).toFixed(4)),
  };
});

const clvByType = membershipTypes.map((type) => {
  const records = membershipPeriods.filter((r) => r.membership_type === type);
  const eligible = records.filter((r) => r.renewed_next_period !== "Censored");
  const retention = eligible.filter((r) => r.renewed_next_period === "Yes").length / eligible.length;
  const avgMargin = records.reduce((s, r) => s + r.contribution_margin, 0) / records.length;
  const cac = { "Adult annual": 72, "Family annual": 84, "Youth annual": 48, "Senior annual": 55, "Monthly flexible": 63 }[type];
  const discountRate = 0.08;
  let clv = -cac;
  for (let t = 1; t <= 4; t += 1) clv += avgMargin * (retention ** (t - 1)) / ((1 + discountRate) ** t);
  return {
    membership_type: type,
    eligible_periods: eligible.length,
    retention_rate: Number(retention.toFixed(4)),
    average_annual_margin: Number(avgMargin.toFixed(2)),
    assumed_cac: cac,
    discount_rate: discountRate,
    horizon_years: 4,
    estimated_clv: Number(clv.toFixed(2)),
  };
});

const annualVisits = new Map();
for (const v of visitsClean) {
  const year = Number(v.visit_date.slice(0, 4));
  const key = `${v.facility_id}|${year}`;
  annualVisits.set(key, (annualVisits.get(key) || 0) + 1);
}
const utilizationProjection = [];
for (const facility of facilities) {
  const basePop = population.filter((p) => p.facility_id === facility.facility_id && p.year === 2025).reduce((s, p) => s + p.population, 0);
  const baseVisits = annualVisits.get(`${facility.facility_id}|2025`) || 0;
  const rate = baseVisits / basePop * 1000;
  for (let year = 2025; year <= 2030; year += 1) {
    const projectedPop = population.filter((p) => p.facility_id === facility.facility_id && p.year === year).reduce((s, p) => s + p.population, 0);
    utilizationProjection.push({
      facility_id: facility.facility_id,
      facility_name: facility.facility_name,
      year,
      population: projectedPop,
      visits_per_1000_2025: Number(rate.toFixed(2)),
      projected_visits_constant_rate: Math.round(rate * projectedPop / 1000),
    });
  }
}

const dictionary = [
  ["facilities.csv", "facility_id", "text", "Unique facility identifier", "Primary key", "No"],
  ["members.csv", "member_id", "text", "Synthetic unique member identifier", "Primary key", "No"],
  ["members.csv", "household_id", "text", "Synthetic household grouping identifier", "Grouping key", "No"],
  ["members.csv", "join_date", "date", "Date the membership relationship began", "YYYY-MM-DD", "No"],
  ["members.csv", "home_facility_id", "text", "Member's designated home facility", "Foreign key to facilities", "No"],
  ["members.csv", "service_area", "text", "Geographic service area associated with the home facility", "Central, East Shore, North Valley, West Valley", "Raw only"],
  ["members.csv", "age_group", "category", "Broad age category used for service and population comparisons", ageGroups.join("; "), "No"],
  ["members.csv", "membership_type", "category", "Membership product at initial acquisition", membershipTypes.join("; "), "Raw only"],
  ["members.csv", "acquisition_channel", "category", "Channel credited with acquiring the member", channels.join("; "), "No"],
  ["members.csv", "marketing_consent", "category", "Whether marketing contact is permitted", "Yes; No", "No"],
  ["members.csv", "postal_fsa", "text", "Synthetic first three characters of a postal code", "V1A to V1E", "Raw only"],
  ["members.csv", "engagement_score", "number", "Latent synthetic value used to generate behaviour", "0.2 to 1.8; not an operational source field", "No"],
  ["membership_periods.csv", "membership_period_id", "text", "Unique membership-period identifier", "Primary key", "No"],
  ["membership_periods.csv", "period_year", "integer", "Calendar year represented by the membership period", "2022 to 2025", "No"],
  ["membership_periods.csv", "renewed_next_period", "category", "Whether the member renewed for the following calendar period", "Yes; No; Censored", "No"],
  ["membership_periods.csv", "contribution_margin", "currency", "Net membership revenue less synthetic attributable direct cost", "Canadian dollars", "No"],
  ["visits.csv", "visit_id", "text", "Unique visit-event identifier", "Primary key", "Raw duplicate issue"],
  ["visits.csv", "visit_date", "date", "Date of facility entry", "YYYY-MM-DD", "No"],
  ["visits.csv", "service_category", "category", "Primary service category associated with the visit", "Fitness; Aquatics; Gymnasium; Group class; Open recreation", "No"],
  ["visits.csv", "check_in_hour", "integer", "Hour of day at check-in", "24-hour clock", "No"],
  ["visits.csv", "duration_minutes", "integer", "Recorded visit duration", "Minutes", "Raw only"],
  ["programs.csv", "program_id", "text", "Unique program-offering identifier", "Primary key", "No"],
  ["programs.csv", "capacity", "integer", "Maximum registration capacity", "People", "No"],
  ["registrations.csv", "registration_id", "text", "Unique program-registration identifier", "Primary key", "No"],
  ["registrations.csv", "registration_status", "category", "Final registration outcome", "Completed; Cancelled; No-show", "No"],
  ["transactions.csv", "gross_revenue", "currency", "Revenue recorded for the transaction", "Canadian dollars", "No"],
  ["transactions.csv", "direct_cost", "currency", "Synthetic attributable direct cost", "Canadian dollars", "No"],
  ["transactions.csv", "contribution_margin", "currency", "Gross revenue minus attributable direct cost", "Canadian dollars", "No"],
  ["campaigns.csv", "campaign_spend", "currency", "Synthetic campaign expenditure", "Canadian dollars", "No"],
  ["campaign_responses.csv", "converted_membership", "category", "Whether an attributed membership conversion occurred", "Yes; No", "No"],
  ["population_projections.csv", "population", "integer", "Synthetic population estimate or projection", "People", "No"],
  ["member_model.csv", "retained_after_first_period", "category", "Target indicating first-period renewal", "0; 1; Censored", "No"],
];
const dictionaryRows = dictionary.map((r) => ({ dataset: r[0], variable: r[1], type: r[2], definition: r[3], allowed_values_or_unit: r[4], known_quality_issue: r[5] }));

await Promise.all([
  writeCsv(path.join(rawDir, "facilities.csv"), facilities),
  writeCsv(path.join(rawDir, "members.csv"), membersRaw),
  writeCsv(path.join(rawDir, "membership_periods.csv"), membershipPeriods),
  writeCsv(path.join(rawDir, "visits.csv"), visitsRaw),
  writeCsv(path.join(rawDir, "programs.csv"), programs),
  writeCsv(path.join(rawDir, "registrations.csv"), registrations),
  writeCsv(path.join(rawDir, "transactions.csv"), transactions),
  writeCsv(path.join(rawDir, "campaigns.csv"), campaigns),
  writeCsv(path.join(rawDir, "campaign_responses.csv"), campaignResponses),
  writeCsv(path.join(rawDir, "population_projections.csv"), population),
  writeCsv(path.join(cleanDir, "facilities.csv"), facilities),
  writeCsv(path.join(cleanDir, "members.csv"), membersClean),
  writeCsv(path.join(cleanDir, "membership_periods.csv"), membershipPeriods),
  writeCsv(path.join(cleanDir, "visits.csv"), visitsClean),
  writeCsv(path.join(cleanDir, "programs.csv"), programs),
  writeCsv(path.join(cleanDir, "registrations.csv"), registrations),
  writeCsv(path.join(cleanDir, "transactions.csv"), transactions),
  writeCsv(path.join(cleanDir, "campaigns.csv"), campaigns),
  writeCsv(path.join(cleanDir, "campaign_responses.csv"), campaignResponses),
  writeCsv(path.join(cleanDir, "population_projections.csv"), population),
  writeCsv(path.join(derivedDir, "monthly_visits.csv"), monthlyVisits),
  writeCsv(path.join(derivedDir, "retention_by_facility.csv"), retentionByFacility),
  writeCsv(path.join(derivedDir, "clv_by_membership_type.csv"), clvByType),
  writeCsv(path.join(derivedDir, "member_model.csv"), memberFeatures),
  writeCsv(path.join(derivedDir, "utilization_projection.csv"), utilizationProjection),
  writeCsv(path.join(packageRoot, "data_dictionary.csv"), dictionaryRows),
]);

const workbook = Workbook.create();
workbook.comments.setSelf({ displayName: "Joe Hobart" });
const summary = workbook.worksheets.add("Summary");
const monthlySheet = workbook.worksheets.add("Monthly Visits");
const retentionSheet = workbook.worksheets.add("Retention");
const clvSheet = workbook.worksheets.add("CLV");
const projectionSheet = workbook.worksheets.add("Projection");
const dictionarySheet = workbook.worksheets.add("Data Dictionary");

const navy = "#17365D";
const blue = "#DCE6F1";
const gold = "#F2C14E";
const pale = "#F6F8FB";
const headerFormat = { fill: navy, font: { bold: true, color: "#FFFFFF" }, wrapText: true, verticalAlignment: "center" };
const sectionFormat = { fill: blue, font: { bold: true, color: navy }, verticalAlignment: "center" };

summary.showGridLines = false;
summary.getRange("A1:H2").merge();
summary.getRange("A1").values = [["North Valley Recreation and Wellness: Analysis Examples"]];
summary.getRange("A1:H2").format = { fill: navy, font: { bold: true, color: "#FFFFFF", size: 18 }, verticalAlignment: "center" };
summary.getRange("A4:B4").values = [["Dataset", "Records"]];
summary.getRange("A4:B4").format = headerFormat;
summary.getRange("A5:B10").values = [
  ["Members", membersClean.length],
  ["Membership periods", membershipPeriods.length],
  ["Visits", visitsClean.length],
  ["Programs", programs.length],
  ["Registrations", registrations.length],
  ["Transactions", transactions.length],
];
summary.getRange("A5:A10").format.fill = pale;
summary.getRange("B5:B10").format.numberFormat = "#,##0";
summary.getRange("D4:E4").values = [["Facility", "Retention rate"]];
summary.getRange("D4:E4").format = headerFormat;
summary.getRange("D5:E8").values = retentionByFacility.map((r) => [r.facility_name, r.retention_rate]);
summary.getRange("E5:E8").format.numberFormat = "0.0%";
summary.getRange("G4:H4").values = [["Membership type", "Estimated CLV"]];
summary.getRange("G4:H4").format = headerFormat;
summary.getRange("G5:H9").values = clvByType.map((r) => [r.membership_type, r.estimated_clv]);
summary.getRange("H5:H9").format.numberFormat = '"$"#,##0';
summary.getRange("A13:H14").merge();
summary.getRange("A13").values = [["Teaching note: all organizations, people, transactions, and results are synthetic. Raw files contain documented quality issues; clean files support reproducible demonstrations."]];
summary.getRange("A13:H14").format = { fill: "#FFF4CC", font: { color: "#5A4600" }, wrapText: true, verticalAlignment: "center" };
summary.freezePanes.freezeRows(3);
summary.getRange("A1:H14").format.font.name = "Aptos";
summary.getRange("A1:H14").format.autofitColumns();
summary.getRange("A:A").format.columnWidth = 24;
summary.getRange("D:D").format.columnWidth = 24;
summary.getRange("G:G").format.columnWidth = 24;

function populateTable(sheet, headers, rows, tableName, numberFormats = {}) {
  sheet.showGridLines = false;
  sheet.getRangeByIndexes(0, 0, 1, headers.length).values = [headers];
  sheet.getRangeByIndexes(0, 0, 1, headers.length).format = headerFormat;
  sheet.getRangeByIndexes(1, 0, rows.length, headers.length).values = rows;
  const table = sheet.tables.add(`A1:${String.fromCharCode(64 + headers.length)}${rows.length + 1}`, true, tableName);
  table.style = "TableStyleMedium2";
  for (const [col, fmt] of Object.entries(numberFormats)) sheet.getRange(`${col}2:${col}${rows.length + 1}`).format.numberFormat = fmt;
  sheet.freezePanes.freezeRows(1);
  sheet.getUsedRange().format.font.name = "Aptos";
  sheet.getUsedRange().format.autofitColumns();
}

populateTable(monthlySheet, ["Month", "Facility ID", "Visits"], monthlyVisits.map((r) => [r.month, r.facility_id, r.visits]), "MonthlyVisitsTable", { C: "#,##0" });
populateTable(retentionSheet, ["Facility ID", "Facility", "Eligible", "Retained", "Retention Rate"], retentionByFacility.map((r) => [r.facility_id, r.facility_name, r.eligible_members, r.retained_members, r.retention_rate]), "RetentionTable", { C: "#,##0", D: "#,##0", E: "0.0%" });
populateTable(clvSheet, ["Membership Type", "Eligible Periods", "Retention Rate", "Average Annual Margin", "Assumed CAC", "Discount Rate", "Horizon", "Estimated CLV"], clvByType.map((r) => [r.membership_type, r.eligible_periods, r.retention_rate, r.average_annual_margin, r.assumed_cac, r.discount_rate, r.horizon_years, r.estimated_clv]), "CLVTable", { B: "#,##0", C: "0.0%", D: '"$"#,##0.00', E: '"$"#,##0', F: "0.0%", G: "0", H: '"$"#,##0.00' });
populateTable(projectionSheet, ["Facility ID", "Facility", "Year", "Population", "Visits per 1,000", "Projected Visits"], utilizationProjection.map((r) => [r.facility_id, r.facility_name, r.year, r.population, r.visits_per_1000_2025, r.projected_visits_constant_rate]), "ProjectionTable", { C: "0", D: "#,##0", E: "0.00", F: "#,##0" });
populateTable(dictionarySheet, ["Dataset", "Variable", "Type", "Definition", "Allowed Values or Unit", "Known Quality Issue"], dictionaryRows.map((r) => [r.dataset, r.variable, r.type, r.definition, r.allowed_values_or_unit, r.known_quality_issue]), "DictionaryTable");
dictionarySheet.getRange("D:F").format.wrapText = true;
dictionarySheet.getRange("D:D").format.columnWidth = 42;
dictionarySheet.getRange("E:E").format.columnWidth = 40;

const retentionChart = summary.charts.add("bar", summary.getRange("D4:E8"));
retentionChart.title = "Retention differs by home facility";
retentionChart.hasLegend = false;
retentionChart.yAxis = { numberFormatCode: "0%", min: 0, max: 1 };
retentionChart.setPosition("A17", "D33");

const clvChart = summary.charts.add("bar", summary.getRange("G4:H9"));
clvChart.title = "Estimated four-year CLV by membership type";
clvChart.hasLegend = false;
clvChart.yAxis = { numberFormatCode: "$#,##0" };
clvChart.setPosition("E17", "H33");

const outputPath = path.join(packageRoot, "NVRW_Analysis_Examples.xlsx");
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
const preview = await workbook.render({ sheetName: "Summary", range: "A1:H33", scale: 1.5, format: "png" });
await fs.writeFile(path.join(figureDir, "nvrw_excel_summary.png"), new Uint8Array(await preview.arrayBuffer()));

console.log(JSON.stringify({
  outputPath,
  counts: { members: membersClean.length, membershipPeriods: membershipPeriods.length, visitsClean: visitsClean.length, visitsRaw: visitsRaw.length, programs: programs.length, registrations: registrations.length, transactions: transactions.length },
  retentionByFacility,
  clvByType,
  preview: path.join(figureDir, "nvrw_excel_summary.png"),
}, null, 2));
