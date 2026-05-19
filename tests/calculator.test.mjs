import assert from "node:assert/strict";

import { DEFAULT_SITE_PROFILE, TARIFF_PROFILES, UTILITY_PROFILES } from "../src/data/config.js";
import { buildStudy } from "../src/lib/calculator.js";

const utility = UTILITY_PROFILES[0];
const tariff = TARIFF_PROFILES[0];

function run(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function nearlyEqual(left, right, tolerance = 1e-9) {
  assert.ok(Math.abs(left - right) <= tolerance, `Expected ${left} to be within ${tolerance} of ${right}`);
}

run("uses duty cycle for billing and not diversity for a 24-hour fridge", () => {
  const study = buildStudy(
    [
      {
        rowId: "fridge",
        name: "Refrigerator",
        category: "Kitchen",
        quantity: 1,
        rating: 180,
        unit: "W",
        powerFactor: 0.9,
        efficiency: 1,
        demandFactor: 0.2,
        dutyCycleBilling: 0.5,
        isCooling: true,
        hoursPerDay: 24,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", growthMargin: 0 },
    utility,
    tariff,
  );

  nearlyEqual(study.rows[0].monthlyEnergyKwh, 64.8);
  nearlyEqual(study.summary.monthlyEnergyKwh, 64.8);
  nearlyEqual(study.summary.peakRealKw, 0.18);
  assert.equal(study.recommendation.meterClass, "Residential");
});

run("applies residential NEC-style sizing separately from billing", () => {
  const study = buildStudy(
    [
      {
        rowId: "general",
        name: "Lighting and sockets",
        category: "Lighting",
        quantity: 1,
        rating: 12000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 1,
        hoursPerDay: 1,
        daysPerMonth: 30,
      },
      {
        rowId: "cooling",
        name: "Air conditioner",
        category: "HVAC",
        quantity: 1,
        rating: 4000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 0.5,
        isCooling: true,
        hoursPerDay: 8,
        daysPerMonth: 30,
      },
      {
        rowId: "heating",
        name: "Space heater",
        category: "HVAC",
        quantity: 1,
        rating: 3000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 0.75,
        isHeating: true,
        hoursPerDay: 2,
        daysPerMonth: 30,
      },
      {
        rowId: "pump",
        name: "Booster pump",
        category: "Motors",
        quantity: 1,
        rating: 1000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 1,
        isFixedMotor: true,
        hoursPerDay: 1,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", growthMargin: 0 },
    utility,
    tariff,
  );

  nearlyEqual(study.summary.peakRealKw, 15.8);
  nearlyEqual(study.summary.peakApparentKva, 15.8);
  nearlyEqual(study.rows.find((row) => row.rowId === "heating").sizingDemandKw, 0);
  nearlyEqual(study.summary.monthlyEnergyKwh, 12 * 1 * 30 + 4 * 8 * 30 * 0.5 + 3 * 2 * 30 * 0.75 + 1 * 1 * 30);
});

run("uses schedule hours for billing and continuous-load sizing for non-residential users", () => {
  const study = buildStudy(
    [
      {
        rowId: "office",
        name: "Office equipment",
        category: "Office",
        quantity: 1,
        rating: 10000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 1,
        isContinuous: false,
        hoursPerDay: 8,
        daysPerMonth: 22,
      },
      {
        rowId: "server",
        name: "Server room",
        category: "IT",
        quantity: 1,
        rating: 2000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 1,
        isContinuous: true,
        hoursPerDay: 24,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "non_residential", premisesType: "non_residential", growthMargin: 0, phasePreference: "three" },
    utility,
    tariff,
  );

  nearlyEqual(study.summary.peakRealKw, 10.5);
  nearlyEqual(study.rows.find((row) => row.rowId === "office").sizingDemandKw, 8);
  nearlyEqual(study.rows.find((row) => row.rowId === "server").sizingDemandKw, 2.5);
  nearlyEqual(study.summary.monthlyEnergyKwh, 3200);
  assert.equal(study.recommendation.meterClass, "Non-Residential");
});

run("uses full connected kVA and optional demand charge for SLT", () => {
  const sltTariff = structuredClone(tariff);
  sltTariff.rates.sltLvDemandGhpPerKvaPerMonth = 100;
  const study = buildStudy(
    [
      {
        rowId: "process",
        name: "Process load",
        category: "Workshop",
        quantity: 1,
        rating: 120,
        unit: "kW",
        powerFactor: 0.8,
        dutyCycleBilling: 1,
        hoursPerDay: 1,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "slt", premisesType: "slt", growthMargin: 0, phasePreference: "three" },
    utility,
    sltTariff,
  );

  nearlyEqual(study.summary.peakRealKw, 120);
  nearlyEqual(study.summary.peakApparentKva, 150);
  nearlyEqual(study.tariffEstimate.demandChargeGhs, 150);
  nearlyEqual(study.recommendation.peakCurrentA, (150 * 1000) / (Math.sqrt(3) * 400));
  assert.equal(study.recommendation.meterClass, "SLT");
});

run("matches the required AC and iron sizing versus billing example", () => {
  const study = buildStudy(
    [
      {
        rowId: "acs",
        name: "5 ACs",
        category: "HVAC",
        quantity: 5,
        rating: 1500,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 0.5,
        isCooling: true,
        hoursPerDay: 5,
        daysPerMonth: 30,
      },
      {
        rowId: "iron",
        name: "Iron",
        category: "Heating",
        quantity: 1,
        rating: 1500,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 0.75,
        hoursPerDay: 0.33,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", growthMargin: 0, phasePreference: "auto" },
    utility,
    tariff,
  );

  nearlyEqual(study.summary.connectedKw, 9);
  nearlyEqual(study.summary.peakRealKw, 9);
  nearlyEqual(study.summary.peakCurrents.singlePhase230A, 9000 / 230);
  nearlyEqual(study.summary.monthlyEnergyKwh, 573.6375);
  assert.equal(study.recommendation.mainBreakerSize, "40A");
  assert.equal(study.recommendation.recommendedCable, "10 mm2 copper cable");
});

run("includes power factor and sizing reserve in the final breaker current", () => {
  const study = buildStudy(
    [
      {
        rowId: "acs",
        name: "5 ACs",
        category: "HVAC",
        quantity: 5,
        rating: 1500,
        unit: "W",
        powerFactor: 0.85,
        dutyCycleBilling: 0.5,
        isCooling: true,
        hoursPerDay: 5,
        daysPerMonth: 30,
      },
      {
        rowId: "iron",
        name: "Iron",
        category: "Heating",
        quantity: 1,
        rating: 1500,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 0.75,
        hoursPerDay: 0.333,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", growthMargin: 0.25, phasePreference: "single" },
    utility,
    tariff,
  );

  nearlyEqual(study.summary.peakRealKw, 9);
  nearlyEqual(study.summary.designRealKw, 11.25);
  nearlyEqual(study.recommendation.recommendedCurrentA, (study.summary.designApparentKva * 1000) / 230);
  assert.equal(study.recommendation.mainBreakerSize, "60A");
  assert.equal(study.recommendation.recommendedCable, "16 mm2 copper cable");
});

run("increases cooling billing duty cycle when supply is unstable", () => {
  const stableStudy = buildStudy(
    [
      {
        rowId: "ac",
        name: "Split AC",
        category: "HVAC",
        quantity: 1,
        rating: 1500,
        unit: "W",
        powerFactor: 0.9,
        dutyCycleBilling: 0.5,
        isCooling: true,
        hoursPerDay: 10,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", voltageStability: "stable", growthMargin: 0 },
    utility,
    tariff,
  );
  const unstableStudy = buildStudy(
    [
      {
        rowId: "ac",
        name: "Split AC",
        category: "HVAC",
        quantity: 1,
        rating: 1500,
        unit: "W",
        powerFactor: 0.9,
        dutyCycleBilling: 0.5,
        isCooling: true,
        hoursPerDay: 10,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", voltageStability: "unstable", growthMargin: 0 },
    utility,
    tariff,
  );

  nearlyEqual(stableStudy.summary.monthlyEnergyKwh, 225);
  nearlyEqual(unstableStudy.summary.monthlyEnergyKwh, 292.5);
});

run("keeps the current-rated cable when the selected power-circuit screen is within 5 percent", () => {
  const study = buildStudy(
    [
      {
        rowId: "load",
        name: "Main load",
        category: "Lighting",
        quantity: 1,
        rating: 9000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 1,
        hoursPerDay: 1,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", phasePreference: "single", growthMargin: 0, mainRunLengthM: 60, voltageDropBasis: "power" },
    utility,
    tariff,
  );

  assert.equal(study.recommendation.mainBreakerSize, "40A");
  assert.equal(study.recommendation.recommendedCable, "10 mm2 copper cable");
  assert.equal(study.recommendation.cableUpgradeReason, "selected from current rating");
  assert.ok(study.recommendation.estimatedVoltageDropPercent < 5);
});

run("upgrades the cable when a lighting circuit would exceed the 3 percent voltage-drop limit", () => {
  const study = buildStudy(
    [
      {
        rowId: "load",
        name: "Main load",
        category: "Lighting",
        quantity: 1,
        rating: 9000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 1,
        hoursPerDay: 1,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", phasePreference: "single", growthMargin: 0, mainRunLengthM: 60, voltageDropBasis: "lighting" },
    utility,
    tariff,
  );

  assert.equal(study.recommendation.mainBreakerSize, "40A");
  assert.equal(study.recommendation.recommendedCable, "16 mm2 copper cable");
  assert.equal(study.recommendation.cableUpgradeReason, "upgraded to satisfy voltage-drop check");
  assert.ok(study.recommendation.estimatedVoltageDropPercent < 3);
});

run("flags possible leakage when the meter reading is more than 20 percent above expected kWh", () => {
  const study = buildStudy(
    [
      {
        rowId: "lamp",
        name: "Test load",
        category: "Lighting",
        quantity: 1,
        rating: 1000,
        unit: "W",
        powerFactor: 1,
        dutyCycleBilling: 1,
        hoursPerDay: 1,
        daysPerMonth: 30,
      },
    ],
    { ...DEFAULT_SITE_PROFILE, customerCategory: "residential", premisesType: "residential", growthMargin: 0, actualMeterReadingKwh: 40 },
    utility,
    tariff,
  );

  nearlyEqual(study.summary.monthlyEnergyKwh, 30);
  nearlyEqual(study.billingDiagnostic.differencePercentage, 100 / 3);
  assert.equal(study.billingDiagnostic.flag, "Faulty meter or earth leakage");
});

console.log("All calculator checks passed.");
