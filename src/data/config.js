import { APPLIANCE_LIBRARY } from "./appliances.js";

export const STORAGE_KEY = "gridledger-load-estimator-v2";

export const DEFAULT_SITE_PROFILE = {
  projectName: "",
  clientName: "",
  utilityProfile: "ecg",
  customerCategory: "auto",
  premisesType: "auto",
  phasePreference: "auto",
  voltageStability: "stable",
  voltageDropBasis: "power",
  defaultPowerFactor: 0.9,
  diversityFactor: 1,
  growthMargin: 0.15,
  mainRunLengthM: "",
  defaultDaysPerMonth: 30,
  tariffMultiplier: 1,
  siteNotes: ""
};

export const DEFAULT_LOAD_ITEMS = [
  { ...APPLIANCE_LIBRARY.find((item) => item.id === "led-lamp"), quantity: 8, rowId: "row-1" },
  { ...APPLIANCE_LIBRARY.find((item) => item.id === "ceiling-fan"), quantity: 2, rowId: "row-2" },
  { ...APPLIANCE_LIBRARY.find((item) => item.id === "refrigerator"), quantity: 1, rowId: "row-3" },
  { ...APPLIANCE_LIBRARY.find((item) => item.id === "split-ac-1-5hp"), quantity: 1, rowId: "row-4" }
];

export const POWER_UNITS = [
  { value: "W", label: "W" },
  { value: "kW", label: "kW" },
  { value: "VA", label: "VA" },
  { value: "kVA", label: "kVA" },
  { value: "hp", label: "hp" }
];

export const CATEGORIES = ["Lighting", "HVAC", "Kitchen", "Office", "IT", "Motors", "Workshop", "Commercial", "Transport", "Plug loads", "Heating", "Other"];

export const UTILITY_PROFILES = [
  {
    id: "ecg",
    label: "Electricity Company of Ghana (ECG)",
    singlePhaseVoltageV: 230,
    threePhaseVoltageV: 400,
    systemFrequencyHz: 50,
    ordinaryServiceLimitKva: 100,
    hvReviewThresholdKw: 800,
    singlePhaseAdvisoryLimitKva: 12,
    singlePhaseAdvisoryCurrentA: 60,
    lvPlanningCurrentLimitA: 400,
    mvPlanningCurrentLimitA: 250,
    notes: [
      "ECG standard LV supply is treated as 230 V single-phase or 400 V three-phase at 50 Hz.",
      "ECG notes that demands above 800 kW may be supplied at 11 kV or 33 kV.",
      "LV and MV current ceilings in this app are editable engineering defaults for pre-screening, not statutory limits."
    ]
  },
  {
    id: "enclave",
    label: "Enclave Power",
    singlePhaseVoltageV: 230,
    threePhaseVoltageV: 400,
    systemFrequencyHz: 50,
    ordinaryServiceLimitKva: 100,
    hvReviewThresholdKw: 800,
    singlePhaseAdvisoryLimitKva: 12,
    singlePhaseAdvisoryCurrentA: 60,
    lvPlanningCurrentLimitA: 400,
    mvPlanningCurrentLimitA: 250,
    notes: [
      "Enclave operates inside the same Ghanaian electricity market context, so this estimator starts from the same LV and tariff assumptions.",
      "Use Enclave-specific connection-study outcomes to refine feeder and protection details before final design."
    ]
  },
  {
    id: "custom",
    label: "Custom distribution profile",
    singlePhaseVoltageV: 230,
    threePhaseVoltageV: 400,
    systemFrequencyHz: 50,
    ordinaryServiceLimitKva: 100,
    hvReviewThresholdKw: 800,
    singlePhaseAdvisoryLimitKva: 12,
    singlePhaseAdvisoryCurrentA: 60,
    lvPlanningCurrentLimitA: 400,
    mvPlanningCurrentLimitA: 250,
    notes: ["Start with Ghana defaults, then validate with the serving utility, network studies and approved protection settings."]
  }
];

export const TARIFF_PROFILES = [
  {
    id: "purc-q2-2026",
    label: "PURC Ghana electricity tariffs (effective April 1, 2026)",
    lastUpdated: "2026-04-01",
    currency: "GHS",
    sourceUrl: "https://www.purc.com.gh/categ/tariffs/subcategories/tariff-reckoner",
    notes: [
      "The tariff values in this profile follow the effective April 1, 2026 PURC schedule used for this project.",
      "PURC revises tariffs quarterly, so update this profile when a newer gazette or reckoner is released."
    ],
    taxes: {
      levyRate: 0.05,
      taxRate: 0.2,
      levyLabel: "Levy",
      taxLabel: "Tax",
      basisLabel: "energy charge + service charge + demand charge"
    },
    rates: {
      lifelineLimitKwh: 30,
      residentialTierOneLimitKwh: 300,
      residentialLifelineGhpPerKwh: 86.9,
      residentialTierOneGhpPerKwh: 196.8825,
      residentialTierTwoGhpPerKwh: 260.1481,
      residentialLifelineServiceGhpPerMonth: 213,
      residentialServiceGhpPerMonth: 1073.0886,
      nonResidentialTierOneLimitKwh: 300,
      nonResidentialTierOneGhpPerKwh: 177.7539,
      nonResidentialTierTwoGhpPerKwh: 216.4873,
      nonResidentialServiceGhpPerMonth: 1242.8245,
      sltLvDemandGhpPerKvaPerMonth: 0,
      sltLvGhpPerKwh: 232.113,
      sltLvServiceGhpPerMonth: 50000,
      sltMvDemandGhpPerKvaPerMonth: 0,
      sltMvGhpPerKwh: 201.6,
      sltMvServiceGhpPerMonth: 50000,
      sltMv2GhpPerKwh: 132.0448,
      sltMv2ServiceGhpPerMonth: 50000,
      sltHvDemandGhpPerKvaPerMonth: 0,
      sltHvGhpPerKwh: 182.1228,
      sltHvServiceGhpPerMonth: 50000,
      sltHvMinesGhpPerKwh: 508.0854,
      sltHvMinesServiceGhpPerMonth: 50000
    }
  }
];

export const ENGINEERING_NOTES = [
  {
    title: "ECG supply basis",
    body: "Electricity Company of Ghana lists its standard supply as 230 V single-phase and 400 V three-phase at 50 Hz, and states that demands above 800 kW may be supplied at 11 kV or 33 kV.",
    url: "https://www.ecg.com.gh/index.php/en/history/technical-information-tariff"
  },
  {
    title: "Service class threshold",
    body: "PURC's distribution and supply rate-setting guidance uses 100 kVA as the dividing line between ordinary residential or non-residential service and Special Load Tariff planning.",
    url: "https://www.purc.com.gh/categ/tariffs/subcategories/rate-setting-guidelines"
  },
  {
    title: "Official tariff rates",
    body: "The tariff module currently uses the April 1, 2026 PURC electricity schedule configured for this project. SLT maximum demand rates are configurable because some published summary schedules list energy and service charges only.",
    url: "https://www.purc.com.gh/categ/tariffs/subcategories/tariff-reckoner"
  },
  {
    title: "Billing and sizing separation",
    body: "Monthly kWh uses connected watts, usage hours and appliance duty cycle. Breaker and feeder sizing uses the customer-category maximum demand method, so diversity is never used to reduce a billing estimate.",
    url: "https://www.ecg.com.gh/index.php/en/history/technical-information-tariff"
  },
  {
    title: "Lifeline definition",
    body: "PURC public materials describe 0-30 kWh consumers as lifeline customers. The calculator applies this block when a residential monthly estimate remains at or below 30 kWh.",
    url: "https://www.purc.com.gh/news-det/309725164"
  }
];
