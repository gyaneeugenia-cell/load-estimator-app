export const APPLIANCE_LIBRARY = [
  { id: "led-lamp", name: "LED lamp", category: "Lighting", rating: 12, unit: "W", powerFactor: 0.95, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: true, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 6, daysPerMonth: 30 },
  { id: "ceiling-fan", name: "Ceiling fan", category: "HVAC", rating: 75, unit: "W", powerFactor: 0.9, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 10, daysPerMonth: 30 },
  { id: "television", name: "Television", category: "Plug loads", rating: 120, unit: "W", powerFactor: 0.95, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 5, daysPerMonth: 30 },
  { id: "refrigerator", name: "Refrigerator", category: "Kitchen", rating: 180, unit: "W", powerFactor: 0.87, efficiency: 1, dutyCycleBilling: 0.5, diversityFactorDesign: 1, isContinuous: false, isCooling: true, isHeating: false, isFixedMotor: false, hoursPerDay: 24, daysPerMonth: 30 },
  { id: "split-ac-1-5hp", name: "Split AC 1.5 hp", category: "HVAC", rating: 1.5, unit: "hp", powerFactor: 0.92, efficiency: 0.9, dutyCycleBilling: 0.5, diversityFactorDesign: 1, isContinuous: false, isCooling: true, isHeating: false, isFixedMotor: false, hoursPerDay: 8, daysPerMonth: 30 },
  { id: "water-heater", name: "Water heater", category: "Heating", rating: 3000, unit: "W", powerFactor: 1, efficiency: 1, dutyCycleBilling: 0.75, diversityFactorDesign: 1, billingDutyClass: "heating", isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 1, daysPerMonth: 30 },
  { id: "electric-kettle", name: "Electric kettle", category: "Kitchen", rating: 2000, unit: "W", powerFactor: 1, efficiency: 1, dutyCycleBilling: 0.75, diversityFactorDesign: 1, billingDutyClass: "heating", isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 0.5, daysPerMonth: 30 },
  { id: "microwave", name: "Microwave oven", category: "Kitchen", rating: 1500, unit: "W", powerFactor: 0.98, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 0.35, daysPerMonth: 30 },
  { id: "desktop-computer", name: "Desktop computer", category: "Office", rating: 180, unit: "W", powerFactor: 0.95, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 8, daysPerMonth: 22 },
  { id: "laptop", name: "Laptop", category: "Office", rating: 90, unit: "W", powerFactor: 0.95, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 8, daysPerMonth: 22 },
  { id: "laser-printer", name: "Laser printer", category: "Office", rating: 500, unit: "W", powerFactor: 0.9, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 1, daysPerMonth: 22 },
  { id: "server-rack", name: "Server rack", category: "IT", rating: 1200, unit: "W", powerFactor: 0.98, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: true, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 24, daysPerMonth: 30 },
  { id: "borehole-pump-2hp", name: "Borehole pump 2 hp", category: "Motors", rating: 2, unit: "hp", powerFactor: 0.86, efficiency: 0.88, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: true, hoursPerDay: 4, daysPerMonth: 30 },
  { id: "booster-pump-1hp", name: "Booster pump 1 hp", category: "Motors", rating: 1, unit: "hp", powerFactor: 0.85, efficiency: 0.87, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: true, hoursPerDay: 4, daysPerMonth: 30 },
  { id: "welding-set", name: "Welding set", category: "Workshop", rating: 5, unit: "kVA", powerFactor: 0.85, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: false, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 5, daysPerMonth: 22 },
  { id: "cold-room-compressor", name: "Cold room compressor 5 hp", category: "HVAC", rating: 5, unit: "hp", powerFactor: 0.88, efficiency: 0.9, dutyCycleBilling: 0.5, diversityFactorDesign: 1, isContinuous: false, isCooling: true, isHeating: false, isFixedMotor: false, hoursPerDay: 24, daysPerMonth: 30 },
  { id: "display-freezer", name: "Display freezer", category: "Commercial", rating: 450, unit: "W", powerFactor: 0.9, efficiency: 1, dutyCycleBilling: 0.5, diversityFactorDesign: 1, isContinuous: false, isCooling: true, isHeating: false, isFixedMotor: false, hoursPerDay: 24, daysPerMonth: 30 },
  { id: "ev-charger-7kw", name: "EV charger 7.2 kW", category: "Transport", rating: 7.2, unit: "kW", powerFactor: 0.99, efficiency: 1, dutyCycleBilling: 1, diversityFactorDesign: 1, isContinuous: true, isCooling: false, isHeating: false, isFixedMotor: false, hoursPerDay: 3, daysPerMonth: 30 }
];

export const SAMPLE_SCENARIOS = [
  {
    id: "residential-suite",
    label: "Two-bedroom residential suite",
    siteOverrides: { projectName: "Two-bedroom suite", customerCategory: "residential", premisesType: "residential", phasePreference: "auto", growthMargin: 0.15 },
    rows: [
      { applianceId: "led-lamp", quantity: 12 },
      { applianceId: "ceiling-fan", quantity: 4 },
      { applianceId: "television", quantity: 2 },
      { applianceId: "refrigerator", quantity: 1 },
      { applianceId: "split-ac-1-5hp", quantity: 2 },
      { applianceId: "water-heater", quantity: 1 },
      { applianceId: "electric-kettle", quantity: 1 },
      { applianceId: "laptop", quantity: 2 }
    ]
  },
  {
    id: "small-office",
    label: "Small office / service center",
    siteOverrides: { projectName: "Small office planning", customerCategory: "non_residential", premisesType: "commercial", phasePreference: "three", growthMargin: 0.18 },
    rows: [
      { applianceId: "led-lamp", quantity: 24 },
      { applianceId: "desktop-computer", quantity: 12 },
      { applianceId: "laser-printer", quantity: 2 },
      { applianceId: "split-ac-1-5hp", quantity: 6 },
      { applianceId: "server-rack", quantity: 1 },
      { applianceId: "water-heater", quantity: 1 }
    ]
  },
  {
    id: "retail-cold-store",
    label: "Mini-mart / cold store",
    siteOverrides: { projectName: "Retail cold-store study", customerCategory: "non_residential", premisesType: "commercial", phasePreference: "three", growthMargin: 0.2 },
    rows: [
      { applianceId: "led-lamp", quantity: 18 },
      { applianceId: "display-freezer", quantity: 6 },
      { applianceId: "cold-room-compressor", quantity: 1 },
      { applianceId: "split-ac-1-5hp", quantity: 3 },
      { applianceId: "desktop-computer", quantity: 2 }
    ]
  },
  {
    id: "fabrication-bay",
    label: "Fabrication / workshop bay",
    siteOverrides: { projectName: "Workshop bay study", customerCategory: "non_residential", premisesType: "industrial", phasePreference: "three", growthMargin: 0.25 },
    rows: [
      { applianceId: "led-lamp", quantity: 30 },
      { applianceId: "welding-set", quantity: 3 },
      { applianceId: "booster-pump-1hp", quantity: 1 },
      { applianceId: "borehole-pump-2hp", quantity: 1 },
      { applianceId: "desktop-computer", quantity: 2 },
      { applianceId: "split-ac-1-5hp", quantity: 2 }
    ]
  }
];
