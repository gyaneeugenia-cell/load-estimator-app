const SQRT_3 = Math.sqrt(3);
const RESIDENTIAL_GENERAL_TIER_KW = 10;
const RESIDENTIAL_GENERAL_TIER_KVA = 10;
const RESIDENTIAL_REMAINDER_FACTOR = 0.4;
const NON_RESIDENTIAL_DIVERSITY_FACTOR = 0.8;
const CONTINUOUS_LOAD_MULTIPLIER = 1.25;
const OVERBILLING_THRESHOLD_PERCENT = 20;
const UNSTABLE_COOLING_DUTY_MULTIPLIER = 1.3;
const VOLTAGE_DROP_RULES = {
  power: {
    percent: 5,
    label: "power / appliance / feeder circuit",
    note: "Use this for socket circuits, motor circuits, heating circuits and feeder screens in this app.",
  },
  lighting: {
    percent: 3,
    label: "lighting circuit",
    note: "Use this when the cable segment under review serves lighting loads.",
  },
  legacy: {
    percent: 4,
    label: "legacy whole-installation screen",
    note: "Use this only when a project specifically follows the older 4% whole-installation wording.",
  },
};
const CABLE_SCHEDULE = [
  { sizeMm2: 10, breakerA: 40, maxAmperage: 40, mvPerAmpPerM: { single: 4.4, three: 3.8 } },
  { sizeMm2: 16, breakerA: 60, maxAmperage: 60, mvPerAmpPerM: { single: 2.8, three: 2.4 } },
  { sizeMm2: 25, breakerA: 100, maxAmperage: 100, mvPerAmpPerM: { single: 1.75, three: 1.5 } },
  { sizeMm2: 35, breakerA: 125, maxAmperage: 125, mvPerAmpPerM: { single: 1.25, three: 1.1 } },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function toNumber(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === "") continue;
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return undefined;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    return ["1", "true", "yes", "y"].includes(value.trim().toLowerCase());
  }

  return false;
}

function rowText(item) {
  return `${item.name ?? ""} ${item.category ?? ""}`.toLowerCase();
}

function includesAny(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function explicitFlag(item, camelName, snakeName) {
  if (item[camelName] !== undefined) return toBoolean(item[camelName]);
  if (item[snakeName] !== undefined) return toBoolean(item[snakeName]);
  return undefined;
}

function isCoolingLoad(item) {
  const explicit = explicitFlag(item, "isCooling", "is_cooling");
  if (explicit !== undefined) return explicit;

  return includesAny(rowText(item), [
    /\bac\b/,
    /air\s*condition/,
    /cold\s*room/,
    /compressor/,
    /freezer/,
    /fridge/,
    /refrigerator/,
  ]);
}

function isClimateHeatingLoad(item) {
  const explicit = explicitFlag(item, "isHeating", "is_heating");
  if (explicit !== undefined) return explicit;

  const text = rowText(item);
  if (/water\s*heater/.test(text)) return false;
  return includesAny(text, [/space\s*heater/, /heat\s*pump/, /electric\s*heater/, /furnace/, /heater\s*coil/]);
}

function isThermalBillingLoad(item) {
  const dutyClass = String(item.billingDutyClass ?? item.billing_duty_class ?? "").toLowerCase();
  if (dutyClass === "heating" || dutyClass === "thermal") return true;

  return includesAny(rowText(item), [/water\s*heater/, /\biron\b/, /kettle/, /space\s*heater/, /electric\s*heater/]);
}

function isFixedMotorLoad(item) {
  const explicit = explicitFlag(item, "isFixedMotor", "is_fixed_motor");
  if (explicit !== undefined) return explicit;

  return includesAny(rowText(item), [/pump/, /motor/]);
}

function isContinuousLoad(item) {
  const explicit = explicitFlag(item, "isContinuous", "is_continuous");
  if (explicit !== undefined) return explicit;

  const text = rowText(item);
  if (includesAny(text, [/server/, /security/, /emergency/, /data\s*center/])) return true;
  return toNumber(item.hoursPerDay, 0) >= 20;
}

function normalizedVoltageStability(siteProfile) {
  return String(siteProfile?.voltageStability ?? "stable").trim().toLowerCase() === "unstable"
    ? "unstable"
    : "stable";
}

function normalizedVoltageDropBasis(siteProfile) {
  const basis = String(siteProfile?.voltageDropBasis ?? "power").trim().toLowerCase();
  return Object.hasOwn(VOLTAGE_DROP_RULES, basis) ? basis : "power";
}

function voltageDropRuleFor(siteProfile) {
  return VOLTAGE_DROP_RULES[normalizedVoltageDropBasis(siteProfile)];
}

function billingDutyCycleFor(item, siteProfile) {
  const explicitStable = toOptionalNumber(
    item.dutyCycleBilling,
    item.duty_cycle_billing,
    item.dutyCycle,
    item.duty_cycle,
  );
  const explicitUnstable = toOptionalNumber(
    item.dutyCycleBillingUnstable,
    item.duty_cycle_billing_unstable,
  );

  let dutyCycle = explicitStable;

  if (dutyCycle === undefined) {
    if (isCoolingLoad(item)) {
      dutyCycle = 0.5;
    } else if (isThermalBillingLoad(item)) {
      dutyCycle = 0.75;
    } else {
      dutyCycle = 1;
    }
  }

  if (normalizedVoltageStability(siteProfile) === "unstable" && isCoolingLoad(item)) {
    dutyCycle = explicitUnstable ?? dutyCycle * UNSTABLE_COOLING_DUTY_MULTIPLIER;
  }

  return clamp(dutyCycle, 0, 1);
}

function designDiversityFactorFor(item) {
  const explicit = toOptionalNumber(
    item.diversityFactorDesign,
    item.diversity_factor_design,
    item.diversityFactor,
    item.diversity_factor,
    item.demandFactor,
  );

  return clamp(explicit ?? 1, 0, 1);
}

function toRealPowerKw({ rating, unit, powerFactor, efficiency }) {
  const safeRating = Math.max(toNumber(rating), 0);
  const safePf = clamp(toNumber(powerFactor, 0.9), 0.4, 1);
  const safeEfficiency = clamp(toNumber(efficiency, 1), 0.5, 1);

  switch (unit) {
    case "W":
      return safeRating / 1000;
    case "kW":
      return safeRating;
    case "VA":
      return (safeRating * safePf) / 1000;
    case "kVA":
      return safeRating * safePf;
    case "hp":
      return (safeRating * 0.746) / safeEfficiency;
    default:
      return safeRating / 1000;
  }
}

function currentSinglePhase(kva, voltage) {
  return voltage > 0 ? (kva * 1000) / voltage : 0;
}

function currentThreePhase(kva, lineVoltage) {
  return lineVoltage > 0 ? (kva * 1000) / (SQRT_3 * lineVoltage) : 0;
}

function currentSet(kva, utilityProfile) {
  return {
    singlePhase230A: currentSinglePhase(kva, utilityProfile.singlePhaseVoltageV),
    threePhase400A: currentThreePhase(kva, utilityProfile.threePhaseVoltageV),
    feeder11kVA: currentThreePhase(kva, 11000),
    feeder33kVA: currentThreePhase(kva, 33000),
  };
}

function demandReducedLoad(value, firstTier, remainderFactor) {
  return Math.min(value, firstTier) + Math.max(value - firstTier, 0) * remainderFactor;
}

function getRecommendedCurrent(summary, recommendation, utilityProfile) {
  if (recommendation.planningClass === "SLT-MV") {
    return {
      amperage: summary.currents.feeder11kVA,
      peakAmperage: summary.peakCurrents.feeder11kVA,
      formulaMode: "three-phase",
      voltageV: 11000,
      phaseLabel: "3-phase",
    };
  }

  if (recommendation.planningClass === "SLT-HV") {
    return {
      amperage: summary.currents.feeder33kVA,
      peakAmperage: summary.peakCurrents.feeder33kVA,
      formulaMode: "three-phase",
      voltageV: 33000,
      phaseLabel: "3-phase",
    };
  }

  if (recommendation.meterSetup === "Single-phase LV meter") {
    return {
      amperage: summary.currents.singlePhase230A,
      peakAmperage: summary.peakCurrents.singlePhase230A,
      formulaMode: "single-phase",
      voltageV: utilityProfile.singlePhaseVoltageV,
      phaseLabel: "1-phase",
    };
  }

  return {
    amperage: summary.currents.threePhase400A,
    peakAmperage: summary.peakCurrents.threePhase400A,
    formulaMode: "three-phase",
    voltageV: utilityProfile.threePhaseVoltageV,
    phaseLabel: "3-phase",
  };
}

function phaseModeFor(formulaMode) {
  return formulaMode === "single-phase" ? "single" : "three";
}

function breakerSizeFor(amperage) {
  const candidate = CABLE_SCHEDULE.find((option) => amperage <= option.breakerA);
  return candidate ? `${candidate.breakerA}A` : "Utility-designed breaker size";
}

function voltageDropFor(cable, amperage, runLengthM, phaseMode) {
  const mvPerAmpPerM = cable.mvPerAmpPerM[phaseMode];
  return (mvPerAmpPerM * amperage * runLengthM) / 1000;
}

function recommendedBreakerAndCable({ amperage, runLengthM, voltageV, formulaMode, voltageDropLimitPercent, voltageDropBasisLabel }) {
  const phaseMode = phaseModeFor(formulaMode);
  const safeAmperage = Math.max(toNumber(amperage, 0), 0);
  const safeRunLengthM = Math.max(toNumber(runLengthM, 0), 0);
  const safeVoltageV = Math.max(toNumber(voltageV, 0), 0);

  if (safeVoltageV > 1000) {
    return {
      mainBreakerSize: "Utility-designed breaker size",
      recommendedCable: "Utility-approved MV/HV cable schedule required",
      cableSizeMm2: null,
      voltageDropChecked: false,
      estimatedVoltageDropV: null,
      estimatedVoltageDropPercent: null,
      voltageDropLimitPercent,
      voltageDropBasisLabel,
      cableUpgradeReason: "mv-hv utility study required",
    };
  }

  const baseIndex = CABLE_SCHEDULE.findIndex((option) => safeAmperage <= option.maxAmperage);

  if (baseIndex === -1) {
    return {
      mainBreakerSize: "Utility-designed breaker size",
      recommendedCable: "Utility-approved cable schedule required",
      cableSizeMm2: null,
      voltageDropChecked: false,
      estimatedVoltageDropV: null,
      estimatedVoltageDropPercent: null,
      voltageDropLimitPercent,
      voltageDropBasisLabel,
      cableUpgradeReason: "outside standard low-voltage screen",
    };
  }

  let cableIndex = baseIndex;
  let selectedCable = CABLE_SCHEDULE[cableIndex];
  let estimatedVoltageDropV = null;
  let estimatedVoltageDropPercent = null;
  let cableUpgradeReason = "selected from current rating";
  let voltageDropFactorMvPerAmpPerM = selectedCable.mvPerAmpPerM[phaseMode];

  if (safeRunLengthM > 0 && safeVoltageV > 0) {
    estimatedVoltageDropV = voltageDropFor(selectedCable, safeAmperage, safeRunLengthM, phaseMode);
    estimatedVoltageDropPercent = safeVoltageV > 0 ? (estimatedVoltageDropV / safeVoltageV) * 100 : null;

    while (
      estimatedVoltageDropPercent !== null &&
      estimatedVoltageDropPercent > voltageDropLimitPercent &&
      cableIndex < CABLE_SCHEDULE.length - 1
    ) {
      cableIndex += 1;
      selectedCable = CABLE_SCHEDULE[cableIndex];
      voltageDropFactorMvPerAmpPerM = selectedCable.mvPerAmpPerM[phaseMode];
      estimatedVoltageDropV = voltageDropFor(selectedCable, safeAmperage, safeRunLengthM, phaseMode);
      estimatedVoltageDropPercent = (estimatedVoltageDropV / safeVoltageV) * 100;
      cableUpgradeReason = "upgraded to satisfy voltage-drop check";
    }
  }

  return {
    mainBreakerSize: breakerSizeFor(safeAmperage),
    recommendedCable: `${selectedCable.sizeMm2} mm2 copper cable`,
    cableSizeMm2: selectedCable.sizeMm2,
    voltageDropChecked: safeRunLengthM > 0 && safeVoltageV > 0,
    estimatedVoltageDropV,
    estimatedVoltageDropPercent,
    voltageDropFactorMvPerAmpPerM,
    voltageDropLimitPercent,
    voltageDropBasisLabel,
    cableUpgradeReason,
  };
}

export function createCustomRow(rowId, defaultDaysPerMonth = 30) {
  return {
    rowId,
    id: `custom-${rowId}`,
    name: "Custom load",
    category: "Other",
    quantity: 1,
    rating: 0,
    unit: "W",
    powerFactor: 0.9,
    efficiency: 1,
    dutyCycleBilling: 1,
    diversityFactorDesign: 1,
    demandFactor: 1,
    isCooling: false,
    isHeating: false,
    isContinuous: false,
    isFixedMotor: false,
    hoursPerDay: 1,
    daysPerMonth: defaultDaysPerMonth,
  };
}

export function calculateRowMetrics(item, siteProfile) {
  const quantity = Math.max(toNumber(item.quantity, 1), 0);
  const powerFactor = clamp(toNumber(item.powerFactor, siteProfile.defaultPowerFactor ?? 0.9), 0.4, 1);
  const efficiency = item.unit === "hp" ? clamp(toNumber(item.efficiency, 0.9), 0.5, 1) : 1;
  const dutyCycleBilling = billingDutyCycleFor(item, siteProfile);
  const diversityFactorDesign = designDiversityFactorFor(item);
  const hoursPerDay = Math.max(toNumber(item.hoursPerDay), 0);
  const daysPerMonth = Math.max(toNumber(item.daysPerMonth, siteProfile.defaultDaysPerMonth ?? 30), 0);
  const realKwPerUnit = toRealPowerKw({ rating: item.rating, unit: item.unit, powerFactor, efficiency });
  const apparentKvaPerUnit = powerFactor > 0 ? realKwPerUnit / powerFactor : realKwPerUnit;
  const connectedKw = realKwPerUnit * quantity;
  const connectedKva = apparentKvaPerUnit * quantity;
  const billingKw = connectedKw * dutyCycleBilling;
  const dailyEnergyKwh = billingKw * hoursPerDay;
  const monthlyEnergyKwh = dailyEnergyKwh * daysPerMonth;
  const cooling = isCoolingLoad(item);
  const heating = isClimateHeatingLoad(item);
  const continuous = isContinuousLoad(item);
  const fixedMotor = isFixedMotorLoad(item);

  return {
    ...item,
    quantity,
    powerFactor,
    efficiency,
    dutyCycleBilling,
    diversityFactorDesign,
    demandFactor: diversityFactorDesign,
    hoursPerDay,
    daysPerMonth,
    realKwPerUnit,
    apparentKvaPerUnit,
    connectedKw,
    connectedKva,
    billingKw,
    dailyEnergyKwh,
    diversifiedKw: connectedKw,
    diversifiedKva: connectedKva,
    monthlyEnergyKwh,
    isCooling: cooling,
    isHeating: heating,
    isContinuous: continuous,
    isFixedMotor: fixedMotor,
  };
}

function groupBreakdown(rows) {
  const totals = new Map();

  for (const row of rows) {
    const bucket = totals.get(row.category) ?? {
      category: row.category,
      connectedKw: 0,
      diversifiedKw: 0,
      monthlyEnergyKwh: 0,
    };
    bucket.connectedKw += row.connectedKw;
    bucket.diversifiedKw += row.diversifiedKw;
    bucket.monthlyEnergyKwh += row.monthlyEnergyKwh;
    totals.set(row.category, bucket);
  }

  return [...totals.values()].sort((left, right) => right.connectedKw - left.connectedKw);
}

function requestedCustomerCategory(siteProfile, rows) {
  const requested = String(siteProfile.customerCategory ?? siteProfile.premisesType ?? "auto")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_");

  if (requested === "slt" || requested === "special_load_tariff") return "slt";
  if (requested === "residential") return "residential";
  if (["commercial", "industrial", "mixed", "non_residential", "nonresidential", "non_resi"].includes(requested)) {
    return "non_residential";
  }

  const nonResidentialCategories = new Set(["Office", "IT", "Motors", "Workshop", "Commercial"]);
  const nonResidentialKw = rows.reduce((total, row) => total + (nonResidentialCategories.has(row.category) ? row.connectedKw : 0), 0);
  const totalKw = rows.reduce((total, row) => total + row.connectedKw, 0);
  return totalKw > 0 && nonResidentialKw > totalKw * 0.35 ? "non_residential" : "residential";
}

function rowSizingEntry(row, kw, kva, note) {
  return [row.rowId, { kw, kva, note }];
}

function computeResidentialSizing(rows) {
  const rowDemand = new Map();
  const coolingRows = rows.filter((row) => row.isCooling);
  const heatingRows = rows.filter((row) => row.isHeating);
  const fixedMotorRows = rows.filter((row) => row.isFixedMotor && !row.isCooling && !row.isHeating);
  const generalRows = rows.filter((row) => !row.isCooling && !row.isHeating && !row.isFixedMotor);

  const generalKw = generalRows.reduce((total, row) => total + row.connectedKw, 0);
  const generalKva = generalRows.reduce((total, row) => total + row.connectedKva, 0);
  const coolingKw = coolingRows.reduce((total, row) => total + row.connectedKw, 0);
  const coolingKva = coolingRows.reduce((total, row) => total + row.connectedKva, 0);
  const heatingKw = heatingRows.reduce((total, row) => total + row.connectedKw, 0);
  const heatingKva = heatingRows.reduce((total, row) => total + row.connectedKva, 0);
  const fixedMotorKw = fixedMotorRows.reduce((total, row) => total + row.connectedKw, 0);
  const fixedMotorKva = fixedMotorRows.reduce((total, row) => total + row.connectedKva, 0);

  const generalDemandKw = demandReducedLoad(generalKw, RESIDENTIAL_GENERAL_TIER_KW, RESIDENTIAL_REMAINDER_FACTOR);
  const generalDemandKva = demandReducedLoad(generalKva, RESIDENTIAL_GENERAL_TIER_KVA, RESIDENTIAL_REMAINDER_FACTOR);
  const useCooling = coolingKva >= heatingKva;
  const climateKw = useCooling ? coolingKw : heatingKw;
  const climateKva = useCooling ? coolingKva : heatingKva;
  const generalKwRatio = generalKw > 0 ? generalDemandKw / generalKw : 0;
  const generalKvaRatio = generalKva > 0 ? generalDemandKva / generalKva : 0;

  for (const row of generalRows) {
    rowDemand.set(...rowSizingEntry(row, row.connectedKw * generalKwRatio, row.connectedKva * generalKvaRatio, "Residential general load demand factor"));
  }

  for (const row of fixedMotorRows) {
    rowDemand.set(...rowSizingEntry(row, row.connectedKw, row.connectedKva, "Residential fixed motor at 100%"));
  }

  for (const row of coolingRows) {
    rowDemand.set(...rowSizingEntry(row, useCooling ? row.connectedKw : 0, useCooling ? row.connectedKva : 0, useCooling ? "Larger cooling load at 100%" : "Excluded by heating/cooling comparison"));
  }

  for (const row of heatingRows) {
    rowDemand.set(...rowSizingEntry(row, useCooling ? 0 : row.connectedKw, useCooling ? 0 : row.connectedKva, useCooling ? "Excluded by heating/cooling comparison" : "Larger heating load at 100%"));
  }

  return {
    customerCategory: "residential",
    methodLabel: "Ghana residential practical demand method",
    peakRealKw: generalDemandKw + fixedMotorKw + climateKw,
    peakApparentKva: generalDemandKva + fixedMotorKva + climateKva,
    appliedDiversityFactor: 1,
    rowDemand,
    sizingBreakdown: [
      `General load: first ${RESIDENTIAL_GENERAL_TIER_KW.toFixed(0)} kW at 100%, remainder at ${(RESIDENTIAL_REMAINDER_FACTOR * 100).toFixed(0)}% = ${generalDemandKw.toFixed(2)} kW.`,
      `Cooling load ${coolingKw.toFixed(2)} kW vs heating load ${heatingKw.toFixed(2)} kW: added ${Math.max(coolingKw, heatingKw).toFixed(2)} kW.`,
      `Fixed motors and pumps added at 100% = ${fixedMotorKw.toFixed(2)} kW.`,
    ],
  };
}

function computeNonResidentialSizing(rows) {
  const rowDemand = new Map();
  let peakRealKw = 0;
  let peakApparentKva = 0;
  let continuousKw = 0;
  let nonContinuousKw = 0;

  for (const row of rows) {
    const factor = row.isContinuous ? CONTINUOUS_LOAD_MULTIPLIER : NON_RESIDENTIAL_DIVERSITY_FACTOR;
    const kw = row.connectedKw * factor;
    const kva = row.connectedKva * factor;
    rowDemand.set(...rowSizingEntry(row, kw, kva, row.isContinuous ? "Continuous load at 125%" : "Non-residential diversified load at 80%"));
    peakRealKw += kw;
    peakApparentKva += kva;
    if (row.isContinuous) {
      continuousKw += row.connectedKw;
    } else {
      nonContinuousKw += row.connectedKw;
    }
  }

  return {
    customerCategory: "non_residential",
    methodLabel: "Non-Residential schedule method",
    peakRealKw,
    peakApparentKva,
    appliedDiversityFactor: NON_RESIDENTIAL_DIVERSITY_FACTOR,
    rowDemand,
    sizingBreakdown: [
      `Continuous loads: ${continuousKw.toFixed(2)} kW at 125%.`,
      `Other non-residential loads: ${nonContinuousKw.toFixed(2)} kW at 80% diversity.`,
    ],
  };
}

function computeSltSizing(rows) {
  const rowDemand = new Map();
  let peakRealKw = 0;
  let peakApparentKva = 0;

  for (const row of rows) {
    rowDemand.set(...rowSizingEntry(row, row.connectedKw, row.connectedKva, "SLT full connected load at 100%"));
    peakRealKw += row.connectedKw;
    peakApparentKva += row.connectedKva;
  }

  return {
    customerCategory: "slt",
    methodLabel: "SLT full-capacity demand method",
    peakRealKw,
    peakApparentKva,
    appliedDiversityFactor: 1,
    rowDemand,
    sizingBreakdown: ["SLT sizing uses 1.0 diversity: all connected load is treated as available at peak demand."],
  };
}

function computeSizing(rows, customerCategory) {
  if (customerCategory === "slt") return computeSltSizing(rows);
  if (customerCategory === "non_residential") return computeNonResidentialSizing(rows);
  return computeResidentialSizing(rows);
}

function applySizingToRows(rows, rowDemand) {
  return rows.map((row) => {
    const demand = rowDemand.get(row.rowId) ?? { kw: row.connectedKw, kva: row.connectedKva, note: "Connected load" };
    return {
      ...row,
      diversifiedKw: demand.kw,
      diversifiedKva: demand.kva,
      sizingDemandKw: demand.kw,
      sizingDemandKva: demand.kva,
      sizingNote: demand.note,
    };
  });
}

export function recommendMeter(summary, siteProfile, utilityProfile) {
  const isResidential = summary.customerCategory === "residential";
  const isSlt = summary.customerCategory === "slt" || summary.peakApparentKva >= utilityProfile.ordinaryServiceLimitKva;
  const reasons = [];
  const warnings = [];
  let meterClass = isResidential ? "Residential" : "Non-Residential";
  let planningClass = isResidential ? "Residential LV" : "Non-Residential LV";
  let feeder = `${utilityProfile.threePhaseVoltageV} V, 50 Hz, three-phase 4-wire LV service`;
  let meterSetup = "Three-phase LV meter";
  let serviceVoltage = `${utilityProfile.threePhaseVoltageV} V, 50 Hz`;
  let confidence = "Engineering calculation + utility planning screen";

  if (!isSlt) {
    if (
      siteProfile.phasePreference === "single" ||
      (siteProfile.phasePreference === "auto" &&
        isResidential &&
        summary.designApparentKva <= utilityProfile.singlePhaseAdvisoryLimitKva &&
        summary.currents.singlePhase230A <= utilityProfile.singlePhaseAdvisoryCurrentA)
    ) {
      meterSetup = "Single-phase LV meter";
      serviceVoltage = `${utilityProfile.singlePhaseVoltageV} V, 50 Hz`;
      feeder = `${utilityProfile.singlePhaseVoltageV} V, 50 Hz, single-phase 2-wire LV service`;
    }

    reasons.push(`${summary.sizingMethodLabel} produced a peak demand of ${summary.peakRealKw.toFixed(2)} kW / ${summary.peakApparentKva.toFixed(2)} kVA.`);
    reasons.push(`Peak apparent demand is below the ${utilityProfile.ordinaryServiceLimitKva} kVA SLT demand threshold used for large industrial-type customers.`);

    return { meterClass, planningClass, feeder, meterSetup, serviceVoltage, confidence, reasons, warnings };
  }

  meterClass = "SLT";
  meterSetup = "Special Load Tariff metering";
  reasons.push(`Peak apparent demand ${summary.peakApparentKva.toFixed(2)} kVA is handled under the SLT full-capacity demand method.`);
  reasons.push("SLT contract demand uses apparent power in kVA, so power factor is included through the row kVA calculation.");

  if (summary.currents.threePhase400A <= utilityProfile.lvPlanningCurrentLimitA && summary.designRealKw < utilityProfile.hvReviewThresholdKw) {
    planningClass = "SLT-LV";
    feeder = `${utilityProfile.threePhaseVoltageV} V, 50 Hz, three-phase 4-wire LV service feeder`;
    serviceVoltage = `${utilityProfile.threePhaseVoltageV} V, 50 Hz`;
    reasons.push(`LV service current is ${summary.currents.threePhase400A.toFixed(1)} A, inside the ${utilityProfile.lvPlanningCurrentLimitA} A planning screen.`);
    warnings.push("Final LV intake capacity, breaker frame and service arrangement still depend on utility approval.");
    return { meterClass, planningClass, feeder, meterSetup, serviceVoltage, confidence, reasons, warnings };
  }

  if (summary.designRealKw < utilityProfile.hvReviewThresholdKw || summary.currents.feeder11kVA <= utilityProfile.mvPlanningCurrentLimitA) {
    planningClass = "SLT-MV";
    feeder = "11 kV, 50 Hz, three-phase medium-voltage feeder";
    serviceVoltage = "11 kV, 50 Hz";
    reasons.push(`Direct LV current would be ${summary.currents.threePhase400A.toFixed(1)} A, so the study promotes the intake to MV.`);
    if (summary.designRealKw >= utilityProfile.hvReviewThresholdKw) {
      warnings.push(`ECG states demands above ${utilityProfile.hvReviewThresholdKw} kW may be supplied at 11 kV or 33 kV. Treat 11 kV here as provisional pending utility studies.`);
    }
    return { meterClass, planningClass, feeder, meterSetup, serviceVoltage, confidence, reasons, warnings };
  }

  planningClass = "SLT-HV";
  feeder = "33 kV, 50 Hz, three-phase high-voltage feeder";
  serviceVoltage = "33 kV, 50 Hz";
  confidence = "Utility-backed threshold + engineering escalation";
  reasons.push(`11 kV feeder current would be ${summary.currents.feeder11kVA.toFixed(1)} A, above the ${utilityProfile.mvPlanningCurrentLimitA} A planning screen.`);
  warnings.push("Use this as an engineering pre-screen only. Final 33 kV assignment requires protection coordination, fault-level checks and the serving utility's connection study.");

  return { meterClass, planningClass, feeder, meterSetup, serviceVoltage, confidence, reasons, warnings };
}

function ghpToGhs(value) {
  return value / 100;
}

function sltDemandRateGhp(recommendation, rates) {
  if (recommendation.planningClass === "SLT-LV") return toNumber(rates.sltLvDemandGhpPerKvaPerMonth, 0);
  if (recommendation.planningClass === "SLT-MV") return toNumber(rates.sltMvDemandGhpPerKvaPerMonth, 0);
  return toNumber(rates.sltHvDemandGhpPerKvaPerMonth, 0);
}

export function estimateMonthlyBill(summary, recommendation, tariffProfile, siteProfile) {
  if (!tariffProfile) {
    return null;
  }

  const multiplier = Math.max(toNumber(siteProfile.tariffMultiplier, 1), 0);
  const energyKwh = summary.monthlyEnergyKwh;
  const { rates } = tariffProfile;
  const taxes = tariffProfile.taxes ?? {
    levyRate: 0.05,
    taxRate: 0.2,
    levyLabel: "Levy",
    taxLabel: "Tax",
    basisLabel: "energy charge + service charge + demand charge",
  };
  let energyChargeGhp = 0;
  let serviceChargeGhp = 0;
  let bandLabel = recommendation.meterClass;
  const energyBlocks = [];

  if (recommendation.meterClass === "Residential") {
    if (energyKwh <= rates.lifelineLimitKwh) {
      energyChargeGhp = energyKwh * rates.residentialLifelineGhpPerKwh;
      serviceChargeGhp = rates.residentialLifelineServiceGhpPerMonth;
      bandLabel = "Residential lifeline";
      energyBlocks.push({
        unitsKwh: energyKwh,
        rateGhpPerKwh: rates.residentialLifelineGhpPerKwh,
      });
    } else if (energyKwh <= rates.residentialTierOneLimitKwh) {
      energyChargeGhp = energyKwh * rates.residentialTierOneGhpPerKwh;
      serviceChargeGhp = rates.residentialServiceGhpPerMonth;
      bandLabel = "Residential 0-300 kWh";
      energyBlocks.push({
        unitsKwh: energyKwh,
        rateGhpPerKwh: rates.residentialTierOneGhpPerKwh,
      });
    } else {
      const upperBandKwh = Math.max(energyKwh - rates.residentialTierOneLimitKwh, 0);
      energyChargeGhp = rates.residentialTierOneLimitKwh * rates.residentialTierOneGhpPerKwh + upperBandKwh * rates.residentialTierTwoGhpPerKwh;
      serviceChargeGhp = rates.residentialServiceGhpPerMonth;
      bandLabel = "Residential 300+ kWh";
      energyBlocks.push({
        unitsKwh: rates.residentialTierOneLimitKwh,
        rateGhpPerKwh: rates.residentialTierOneGhpPerKwh,
      });
      energyBlocks.push({
        unitsKwh: upperBandKwh,
        rateGhpPerKwh: rates.residentialTierTwoGhpPerKwh,
      });
    }
  } else if (recommendation.meterClass === "Non-Residential" || recommendation.meterClass === "Commercial") {
    if (energyKwh <= rates.nonResidentialTierOneLimitKwh) {
      energyChargeGhp = energyKwh * rates.nonResidentialTierOneGhpPerKwh;
      bandLabel = "Non-residential 0-300 kWh";
      energyBlocks.push({
        unitsKwh: energyKwh,
        rateGhpPerKwh: rates.nonResidentialTierOneGhpPerKwh,
      });
    } else {
      const upperBandKwh = Math.max(energyKwh - rates.nonResidentialTierOneLimitKwh, 0);
      energyChargeGhp = rates.nonResidentialTierOneLimitKwh * rates.nonResidentialTierOneGhpPerKwh + upperBandKwh * rates.nonResidentialTierTwoGhpPerKwh;
      bandLabel = "Non-residential 301+ kWh";
      energyBlocks.push({
        unitsKwh: rates.nonResidentialTierOneLimitKwh,
        rateGhpPerKwh: rates.nonResidentialTierOneGhpPerKwh,
      });
      energyBlocks.push({
        unitsKwh: upperBandKwh,
        rateGhpPerKwh: rates.nonResidentialTierTwoGhpPerKwh,
      });
    }
    serviceChargeGhp = rates.nonResidentialServiceGhpPerMonth;
  } else {
    if (recommendation.planningClass === "SLT-LV") {
      energyChargeGhp = energyKwh * rates.sltLvGhpPerKwh;
      serviceChargeGhp = rates.sltLvServiceGhpPerMonth;
      bandLabel = "SLT-LV";
      energyBlocks.push({
        unitsKwh: energyKwh,
        rateGhpPerKwh: rates.sltLvGhpPerKwh,
      });
    } else if (recommendation.planningClass === "SLT-MV") {
      energyChargeGhp = energyKwh * rates.sltMvGhpPerKwh;
      serviceChargeGhp = rates.sltMvServiceGhpPerMonth;
      bandLabel = "SLT-MV";
      energyBlocks.push({
        unitsKwh: energyKwh,
        rateGhpPerKwh: rates.sltMvGhpPerKwh,
      });
    } else {
      energyChargeGhp = energyKwh * rates.sltHvGhpPerKwh;
      serviceChargeGhp = rates.sltHvServiceGhpPerMonth;
      bandLabel = "SLT-HV";
      energyBlocks.push({
        unitsKwh: energyKwh,
        rateGhpPerKwh: rates.sltHvGhpPerKwh,
      });
    }
  }

  const demandRateGhpPerKva = recommendation.meterClass === "SLT" ? sltDemandRateGhp(recommendation, rates) : 0;
  const demandQuantityKva = recommendation.meterClass === "SLT" ? summary.peakApparentKva : 0;
  const demandChargeGhp = demandQuantityKva * demandRateGhpPerKva;
  const scaledEnergyGhp = energyChargeGhp * multiplier;
  const scaledServiceGhp = serviceChargeGhp * multiplier;
  const scaledDemandGhp = demandChargeGhp * multiplier;
  const energyChargeGhs = ghpToGhs(scaledEnergyGhp);
  const serviceChargeGhs = ghpToGhs(scaledServiceGhp);
  const demandChargeGhs = ghpToGhs(scaledDemandGhp);
  const subtotalBeforeTaxesGhs = energyChargeGhs + serviceChargeGhs + demandChargeGhs;
  const isResidential = recommendation.meterClass === "Residential";
  const levyGhs = energyChargeGhs * taxes.levyRate;
  const taxGhs = isResidential ? 0 : subtotalBeforeTaxesGhs * taxes.taxRate;
  const taxesAndLeviesGhs = levyGhs + taxGhs;
  const totalGhs = subtotalBeforeTaxesGhs + taxesAndLeviesGhs;

  const scaledEnergyBlocks = energyBlocks.map((block) => {
    const scaledRateGhpPerKwh = block.rateGhpPerKwh * multiplier;
    const chargeGhs = ghpToGhs(block.unitsKwh * scaledRateGhpPerKwh);
    return {
      unitsKwh: block.unitsKwh,
      rateGhpPerKwh: scaledRateGhpPerKwh,
      chargeGhs,
    };
  });

  const breakdown = scaledEnergyBlocks.map(
    (block) => `${block.unitsKwh.toFixed(2)} kWh at ${(block.rateGhpPerKwh / 100).toFixed(4)} GHS/kWh`,
  );
  if (recommendation.meterClass === "SLT") {
    breakdown.push(`${demandQuantityKva.toFixed(2)} kVA maximum demand at ${(demandRateGhpPerKva / 100).toFixed(4)} GHS/kVA/month`);
  }

  return {
    bandLabel,
    multiplier,
    energyChargeGhs,
    serviceChargeGhs,
    demandChargeGhs,
    demandRateGhpPerKva,
    demandQuantityKva,
    subtotalBeforeTaxesGhs,
    levyGhs,
    taxGhs,
    taxesAndLeviesGhs,
    totalGhs,
    isResidentialTaxExempt: isResidential,
    taxRates: {
      levyRate: taxes.levyRate,
      taxRate: taxes.taxRate,
    },
    taxBasisLabels: {
      levyLabel: taxes.levyLabel,
      taxLabel: taxes.taxLabel,
      basisLabel: taxes.basisLabel,
    },
    energyBlocks: scaledEnergyBlocks,
    breakdown,
  };
}

function buildBillingDiagnostic(summary, siteProfile) {
  const actualKwh = toOptionalNumber(
    siteProfile.actualMeterReadingKwh,
    siteProfile.userMeterReadingKwh,
    siteProfile.meterReadingKwh,
  );

  if (actualKwh === undefined || actualKwh <= 0) return null;

  const expectedKwh = summary.monthlyEnergyKwh;
  const differenceKwh = actualKwh - expectedKwh;
  const differencePercentage = expectedKwh > 0 ? (differenceKwh / expectedKwh) * 100 : null;
  let flag = "Within expected range";
  let tone = "ok";

  if (differencePercentage === null) {
    flag = "Meter shows usage but no expected load was calculated";
    tone = "warning";
  } else if (differencePercentage > OVERBILLING_THRESHOLD_PERCENT) {
    flag = "Faulty meter or earth leakage";
    tone = "warning";
  } else if (differencePercentage < -OVERBILLING_THRESHOLD_PERCENT) {
    flag = "Inventory estimate is higher than the meter reading";
    tone = "info";
  }

  return {
    expectedKwh,
    actualKwh,
    differenceKwh,
    differencePercentage,
    thresholdPercentage: OVERBILLING_THRESHOLD_PERCENT,
    flag,
    tone,
  };
}

export function buildStudy(items, siteProfile, utilityProfile, tariffProfile) {
  const initialRows = items
    .filter((item) => item && toNumber(item.quantity, 0) > 0)
    .map((item) => calculateRowMetrics(item, siteProfile));

  const requestedCategory = requestedCustomerCategory(siteProfile, initialRows);
  const preliminarySizing = computeSizing(initialRows, requestedCategory);
  const customerCategory =
    requestedCategory === "slt" || preliminarySizing.peakApparentKva >= utilityProfile.ordinaryServiceLimitKva
      ? "slt"
      : requestedCategory;
  const sizing = customerCategory === preliminarySizing.customerCategory ? preliminarySizing : computeSltSizing(initialRows);
  const rows = applySizingToRows(initialRows, sizing.rowDemand);

  const totals = rows.reduce(
    (accumulator, row) => {
      accumulator.connectedKw += row.connectedKw;
      accumulator.connectedKva += row.connectedKva;
      accumulator.rawDemandKw += row.diversifiedKw;
      accumulator.rawDemandKva += row.diversifiedKva;
      accumulator.monthlyEnergyKwh += row.monthlyEnergyKwh;
      accumulator.dailyEnergyKwh += row.dailyEnergyKwh;
      return accumulator;
    },
    { connectedKw: 0, connectedKva: 0, rawDemandKw: 0, rawDemandKva: 0, monthlyEnergyKwh: 0, dailyEnergyKwh: 0 },
  );

  const growthMargin = Math.max(toNumber(siteProfile.growthMargin, 0), 0);
  const voltageDropRule = voltageDropRuleFor(siteProfile);
  const peakRealKw = sizing.peakRealKw;
  const peakApparentKva = sizing.peakApparentKva;
  const designRealKw = peakRealKw * (1 + growthMargin);
  const designApparentKva = peakApparentKva * (1 + growthMargin);
  const effectivePowerFactor = designApparentKva > 0 ? clamp(designRealKw / designApparentKva, 0.4, 1) : toNumber(siteProfile.defaultPowerFactor, 0.9);
  const diversityFactor = peakRealKw > 0 ? totals.connectedKw / peakRealKw : 1;

  const summary = {
    ...totals,
    customerCategory,
    requestedCustomerCategory: requestedCategory,
    sizingMethodLabel: sizing.methodLabel,
    sizingBreakdown: sizing.sizingBreakdown,
    appliedDiversityFactor: sizing.appliedDiversityFactor,
    diversityFactor,
    growthMargin,
    peakRealKw,
    peakApparentKva,
    peakKva: peakApparentKva,
    simultaneousRealKw: peakRealKw,
    simultaneousApparentKva: peakApparentKva,
    designRealKw,
    designApparentKva,
    effectivePowerFactor,
    mainRunLengthM: toOptionalNumber(siteProfile.mainRunLengthM) ?? null,
    voltageStability: normalizedVoltageStability(siteProfile),
    voltageDropBasis: normalizedVoltageDropBasis(siteProfile),
    voltageDropBasisLabel: voltageDropRule.label,
    voltageDropLimitPercent: voltageDropRule.percent,
    peakCurrents: currentSet(peakApparentKva, utilityProfile),
    currents: currentSet(designApparentKva, utilityProfile),
  };

  const recommendation = recommendMeter(summary, siteProfile, utilityProfile);
  const recommendedCurrent = getRecommendedCurrent(summary, recommendation, utilityProfile);
  recommendation.recommendedCurrentA = recommendedCurrent.amperage;
  recommendation.peakCurrentA = recommendedCurrent.peakAmperage;
  recommendation.currentFormulaMode = recommendedCurrent.formulaMode;
  recommendation.currentVoltageV = recommendedCurrent.voltageV;
  recommendation.currentPhaseLabel = recommendedCurrent.phaseLabel;
  Object.assign(recommendation, recommendedBreakerAndCable({
    amperage: recommendedCurrent.amperage,
    runLengthM: siteProfile.mainRunLengthM,
    voltageV: recommendedCurrent.voltageV,
    formulaMode: recommendedCurrent.formulaMode,
    voltageDropLimitPercent: voltageDropRule.percent,
    voltageDropBasisLabel: voltageDropRule.label,
  }));
  if (!recommendation.voltageDropChecked && recommendation.cableSizeMm2 !== null) {
    recommendation.warnings.push("Enter the main cable run length under Load Study Settings so the app can check voltage drop. If the selected cable size causes voltage drop above the chosen limit, the app will recommend a larger cable.");
  } else if (
    recommendation.voltageDropChecked &&
    recommendation.estimatedVoltageDropPercent !== null &&
    recommendation.estimatedVoltageDropPercent > recommendation.voltageDropLimitPercent
  ) {
    recommendation.warnings.push(`Estimated voltage drop is still above ${recommendation.voltageDropLimitPercent}% with the largest screened cable size. A detailed cable study is required.`);
  } else if (recommendation.cableUpgradeReason === "upgraded to satisfy voltage-drop check") {
    recommendation.reasons.push(`Cable size was increased after checking the selected ${recommendation.voltageDropLimitPercent}% ${recommendation.voltageDropBasisLabel} limit over the entered run length.`);
  }
  const tariffEstimate = estimateMonthlyBill(summary, recommendation, tariffProfile, siteProfile);
  const billingDiagnostic = buildBillingDiagnostic(summary, siteProfile);

  return {
    rows,
    summary,
    recommendation,
    tariffEstimate,
    billingDiagnostic,
    breakdown: groupBreakdown(rows),
  };
}
