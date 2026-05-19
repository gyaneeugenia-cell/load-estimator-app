import { APPLIANCE_LIBRARY, SAMPLE_SCENARIOS } from "./data/appliances.js";
import {
  CATEGORIES,
  DEFAULT_LOAD_ITEMS,
  DEFAULT_SITE_PROFILE,
  ENGINEERING_NOTES,
  POWER_UNITS,
  STORAGE_KEY,
  TARIFF_PROFILES,
  UTILITY_PROFILES
} from "./data/config.js";
import { buildStudy, createCustomRow } from "./lib/calculator.js";

const state = {
  nextRowId: 5,
  siteProfile: structuredClone(DEFAULT_SITE_PROFILE),
  loadItems: structuredClone(DEFAULT_LOAD_ITEMS)
};

const elements = {
  siteForm: document.querySelector("#site-form"),
  utilityProfile: document.querySelector("#utility-profile"),
  premisesType: document.querySelector("#premises-type"),
  phasePreference: document.querySelector("#phase-preference"),
  presetSelector: document.querySelector("#preset-selector"),
  scenarioSelector: document.querySelector("#scenario-selector"),
  tariffProfile: document.querySelector("#tariff-profile"),
  tariffMultiplier: document.querySelector("#tariff-multiplier"),
  loadRows: document.querySelector("#load-rows"),
  summaryCards: document.querySelector("#summary-cards"),
  recommendationCard: document.querySelector("#recommendation-card"),
  breakdownBars: document.querySelector("#breakdown-bars"),
  tariffSummary: document.querySelector("#tariff-summary"),
  notesList: document.querySelector("#notes-list"),
  saveStatus: document.querySelector("#save-status"),
  timestamp: document.querySelector("#timestamp"),
  addPresetButton: document.querySelector("#add-preset-btn"),
  addRowButton: document.querySelector("#add-row-btn"),
  applyScenarioButton: document.querySelector("#apply-scenario-btn"),
  saveButton: document.querySelector("#save-btn"),
  exportButton: document.querySelector("#export-btn"),
  printButton: document.querySelector("#print-btn")
};

function numberFormat(value, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  }).format(value);
}

function currencyFormat(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2
  }).format(value);
}

function findUtilityProfile(id) {
  return UTILITY_PROFILES.find((profile) => profile.id === id) ?? UTILITY_PROFILES[0];
}

function findTariffProfile(id) {
  return TARIFF_PROFILES.find((profile) => profile.id === id) ?? TARIFF_PROFILES[0];
}

function optionMarkup(options, selectedValue) {
  return options
    .map((option) => {
      const value = option.value ?? option.id ?? option;
      const label = option.label ?? option.name ?? option;
      const selected = value === selectedValue ? " selected" : "";
      return `<option value="${value}"${selected}>${label}</option>`;
    })
    .join("");
}

function applianceToRow(applianceId, quantity = 1) {
  const appliance = APPLIANCE_LIBRARY.find((item) => item.id === applianceId) ?? APPLIANCE_LIBRARY[0];
  return { ...appliance, quantity, rowId: `row-${state.nextRowId++}` };
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed?.siteProfile && parsed?.loadItems?.length) {
      state.siteProfile = { ...structuredClone(DEFAULT_SITE_PROFILE), ...parsed.siteProfile };
      state.loadItems = parsed.loadItems.map((item) => ({ ...item, rowId: item.rowId ?? `row-${state.nextRowId++}` }));
      state.nextRowId = Math.max(state.nextRowId, state.loadItems.length + 2);
      elements.saveStatus.textContent = "Restored last saved local draft.";
    }
  } catch {
    elements.saveStatus.textContent = "Saved draft could not be restored.";
  }
}

function syncFormFromState() {
  const form = elements.siteForm;
  form.querySelector("#project-name").value = state.siteProfile.projectName ?? "";
  form.querySelector("#client-name").value = state.siteProfile.clientName ?? "";
  form.querySelector("#premises-type").value = state.siteProfile.premisesType ?? "residential";
  form.querySelector("#phase-preference").value = state.siteProfile.phasePreference ?? "auto";
  form.querySelector("#default-pf").value = state.siteProfile.defaultPowerFactor ?? 0.92;
  form.querySelector("#coincidence-factor").value = Math.round((state.siteProfile.coincidenceFactor ?? 0.82) * 100);
  form.querySelector("#growth-margin").value = Math.round((state.siteProfile.growthMargin ?? 0.15) * 100);
  form.querySelector("#default-days").value = state.siteProfile.defaultDaysPerMonth ?? 30;
  form.querySelector("#site-notes").value = state.siteProfile.siteNotes ?? "";
  elements.utilityProfile.value = state.siteProfile.utilityProfile;
  elements.tariffMultiplier.value = Math.round((state.siteProfile.tariffMultiplier ?? 1) * 100);
}

function collectFormState() {
  const form = elements.siteForm;
  state.siteProfile = {
    ...state.siteProfile,
    projectName: form.querySelector("#project-name").value.trim(),
    clientName: form.querySelector("#client-name").value.trim(),
    utilityProfile: elements.utilityProfile.value,
    premisesType: elements.premisesType.value,
    phasePreference: elements.phasePreference.value,
    defaultPowerFactor: Number.parseFloat(form.querySelector("#default-pf").value) || 0.92,
    coincidenceFactor: (Number.parseFloat(form.querySelector("#coincidence-factor").value) || 82) / 100,
    growthMargin: (Number.parseFloat(form.querySelector("#growth-margin").value) || 15) / 100,
    defaultDaysPerMonth: Number.parseInt(form.querySelector("#default-days").value, 10) || 30,
    tariffMultiplier: (Number.parseFloat(elements.tariffMultiplier.value) || 100) / 100,
    siteNotes: form.querySelector("#site-notes").value.trim()
  };
}

function rowMarkup(row, metrics) {
  return `
    <tr data-row-id="${row.rowId}">
      <td><input data-field="name" type="text" value="${row.name ?? ""}" /></td>
      <td><select data-field="category">${optionMarkup(CATEGORIES, row.category ?? "Other")}</select></td>
      <td><input data-field="quantity" type="number" min="0" step="1" value="${row.quantity ?? 1}" /></td>
      <td><input data-field="rating" type="number" min="0" step="0.01" value="${row.rating ?? 0}" /></td>
      <td><select data-field="unit">${optionMarkup(POWER_UNITS, row.unit ?? "W")}</select></td>
      <td><input data-field="powerFactor" type="number" min="0.4" max="1" step="0.01" value="${row.powerFactor ?? 0.92}" /></td>
      <td><input data-field="demandFactor" type="number" min="0" max="100" step="1" value="${Math.round((row.demandFactor ?? 1) * 100)}" /></td>
      <td><input data-field="hoursPerDay" type="number" min="0" max="24" step="0.1" value="${row.hoursPerDay ?? 1}" /></td>
      <td><input data-field="daysPerMonth" type="number" min="0" max="31" step="1" value="${row.daysPerMonth ?? state.siteProfile.defaultDaysPerMonth}" /></td>
      <td class="load-table__metric">${numberFormat(metrics?.connectedKw ?? 0, 2)}</td>
      <td class="load-table__metric">${numberFormat(metrics?.diversifiedKw ?? 0, 2)}</td>
      <td class="load-table__metric">${numberFormat(metrics?.monthlyEnergyKwh ?? 0, 1)}</td>
      <td><button class="load-table__delete" type="button" data-action="remove" aria-label="Remove row">x</button></td>
    </tr>
  `;
}

function saveLocally() {
  collectFormState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ siteProfile: state.siteProfile, loadItems: state.loadItems }));
  elements.saveStatus.textContent = `Saved locally at ${new Date().toLocaleTimeString()}.`;
}

function exportJson(study) {
  const payload = { exportedAt: new Date().toISOString(), siteProfile: state.siteProfile, loadItems: state.loadItems, study };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gridledger-study.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function renderSummary(study, utilityProfile) {
  const { summary, recommendation } = study;
  const currentLookup = {
    "230 V, 50 Hz": `${numberFormat(summary.currents.singlePhase230A, 1)} A @ 230 V`,
    [`${utilityProfile.threePhaseVoltageV} V, 50 Hz`]: `${numberFormat(summary.currents.threePhase400A, 1)} A @ 400 V`,
    "11 kV, 50 Hz": `${numberFormat(summary.currents.feeder11kVA, 1)} A @ 11 kV`,
    "33 kV, 50 Hz": `${numberFormat(summary.currents.feeder33kVA, 2)} A @ 33 kV`
  };

  const cards = [
    { label: "Connected Load", value: `${numberFormat(summary.connectedKw, 2)} kW`, hint: `${numberFormat(summary.connectedKva, 2)} kVA nameplate total` },
    { label: "Raw Demand", value: `${numberFormat(summary.rawDemandKw, 2)} kW`, hint: "After item demand factors" },
    { label: "Design Demand", value: `${numberFormat(summary.designRealKw, 2)} kW`, hint: `${numberFormat(summary.designApparentKva, 2)} kVA after coincidence and growth` },
    { label: "Power Factor", value: numberFormat(summary.effectivePowerFactor, 2), hint: "Weighted operating PF" },
  { label: "Estimated Monthly Energy", value: `${numberFormat(summary.monthlyEnergyKwh, 1)} kWh`, hint: `${numberFormat(summary.monthlyEnergyKwh / 30, 1)} kWh/day average` },
    { label: "Recommended Current", value: currentLookup[recommendation.serviceVoltage] ?? `${numberFormat(summary.currents.threePhase400A, 1)} A`, hint: `${recommendation.serviceVoltage} service basis` }
  ];

  elements.summaryCards.innerHTML = cards
    .map((card) => `
      <article class="summary-card">
        <p class="summary-card__label">${card.label}</p>
        <p class="summary-card__value">${card.value}</p>
        <p class="summary-card__hint">${card.hint}</p>
      </article>
    `)
    .join("");
}

function renderRecommendation(study) {
  const { recommendation, summary } = study;
  elements.recommendationCard.innerHTML = `
    <section class="recommendation-card__hero">
      <div class="chip-row">
        <span class="chip chip--accent">${recommendation.meterClass}</span>
        <span class="chip chip--surface">${recommendation.planningClass}</span>
        <span class="chip chip--surface">${recommendation.feeder}</span>
      </div>
      <div>
        <h3 class="recommendation-card__title">${recommendation.meterSetup}</h3>
        <p class="recommendation-card__subtitle">Recommended service basis: ${recommendation.serviceVoltage}. Confidence: ${recommendation.confidence}.</p>
        <p class="recommendation-card__meta">Design load is ${numberFormat(summary.designRealKw, 2)} kW / ${numberFormat(summary.designApparentKva, 2)} kVA.</p>
      </div>
    </section>
    <div class="recommendation-card__grid">
      <article class="recommendation-card__block">
        <h3>Why this recommendation</h3>
        <ul class="list-tight">${recommendation.reasons.map((item) => `<li>${item}</li>`).join("")}</ul>
      </article>
      <article class="recommendation-card__block">
        <h3>Current checks</h3>
        <ul class="list-tight">
          <li>230 V 1-phase: ${numberFormat(summary.currents.singlePhase230A, 1)} A</li>
          <li>400 V 3-phase: ${numberFormat(summary.currents.threePhase400A, 1)} A</li>
          <li>11 kV feeder: ${numberFormat(summary.currents.feeder11kVA, 1)} A</li>
          <li>33 kV feeder: ${numberFormat(summary.currents.feeder33kVA, 2)} A</li>
        </ul>
      </article>
      <article class="recommendation-card__block">
        <h3>Warnings / next action</h3>
        <ul class="list-tight">${recommendation.warnings.length ? recommendation.warnings.map((item) => `<li>${item}</li>`).join("") : "<li>No special warning for the current planning screen.</li>"}</ul>
      </article>
    </div>
  `;
}

function renderBreakdown(study) {
  const maxConnected = Math.max(...study.breakdown.map((item) => item.connectedKw), 0);
  elements.breakdownBars.innerHTML = study.breakdown.length
    ? study.breakdown
        .map((item) => `
          <article class="breakdown-row">
            <div class="breakdown-row__head">
              <strong>${item.category}</strong>
              <span>${numberFormat(item.connectedKw, 2)} kW • ${numberFormat(item.monthlyEnergyKwh, 1)} kWh/mo</span>
            </div>
            <div class="breakdown-track">
              <div class="breakdown-track__fill" style="width: ${maxConnected ? (item.connectedKw / maxConnected) * 100 : 0}%"></div>
            </div>
          </article>
        `)
        .join("")
    : "<p class='panel__microcopy'>No active loads in the schedule yet.</p>";
}

function renderTariff(study, tariffProfile) {
  const tariffEstimate = study.tariffEstimate;
  if (!tariffEstimate) {
    elements.tariffSummary.innerHTML = "<p class='panel__microcopy'>Tariff profile not available.</p>";
    return;
  }

  elements.tariffSummary.innerHTML = `
    <div class="tariff-summary__hero">
      <div>
        <p class="panel__eyebrow">Estimated Monthly Bill</p>
        <p class="tariff-summary__value">${currencyFormat(tariffEstimate.totalGhs)}</p>
        <p class="tariff-summary__meta">${tariffEstimate.bandLabel} using ${tariffProfile.label}</p>
      </div>
      <div class="chip-row">
        <span class="chip chip--surface">Rate multiplier ${numberFormat(tariffEstimate.multiplier * 100, 0)}%</span>
        <span class="chip chip--warning">PURC updates tariffs quarterly</span>
      </div>
    </div>
    <div class="tariff-breakdown">
      <article class="tariff-box">
        <h3>Charges</h3>
        <ul class="list-tight">
          <li>Energy charge: ${currencyFormat(tariffEstimate.energyChargeGhs)}</li>
          <li>Service charge: ${currencyFormat(tariffEstimate.serviceChargeGhs)}</li>
        </ul>
      </article>
      <article class="tariff-box">
        <h3>Billing basis</h3>
        <ul class="list-tight">${tariffEstimate.breakdown.map((line) => `<li>${line}</li>`).join("")}</ul>
      </article>
      <article class="tariff-box">
        <h3>Tariff note</h3>
        <ul class="list-tight">${tariffProfile.notes.map((line) => `<li>${line}</li>`).join("")}</ul>
      </article>
    </div>
  `;
}

function renderNotes(utilityProfile) {
  const utilityNotes = utilityProfile.notes.map((note) => `<li>${note}</li>`).join("");
  const siteNote = state.siteProfile.siteNotes ? `<article class="note-card"><h3>Project notes</h3><p>${state.siteProfile.siteNotes}</p></article>` : "";

  elements.notesList.innerHTML = `
    <article class="note-card">
      <h3>Utility profile assumptions</h3>
      <ul class="list-tight">${utilityNotes}</ul>
    </article>
    ${ENGINEERING_NOTES.map((note) => `
      <article class="note-card">
        <h3>${note.title}</h3>
        <p>${note.body}</p>
        <a href="${note.url}" target="_blank" rel="noreferrer">Open source</a>
      </article>
    `).join("")}
    ${siteNote}
  `;
}

function renderLoadTable(study) {
  const metricsById = new Map(study.rows.map((row) => [row.rowId, row]));
  elements.loadRows.innerHTML = state.loadItems.map((row) => rowMarkup(row, metricsById.get(row.rowId))).join("");
}

function renderTimestamp() {
  elements.timestamp.textContent = `Updated ${new Date().toLocaleString()}`;
}

function render() {
  collectFormState();
  const utilityProfile = findUtilityProfile(state.siteProfile.utilityProfile);
  const tariffProfile = findTariffProfile(elements.tariffProfile.value);
  const study = buildStudy(state.loadItems, state.siteProfile, utilityProfile, tariffProfile);

  renderLoadTable(study);
  renderSummary(study, utilityProfile);
  renderRecommendation(study);
  renderBreakdown(study);
  renderTariff(study, tariffProfile);
  renderNotes(utilityProfile);
  renderTimestamp();
  elements.exportButton.onclick = () => exportJson(study);
}

function updateRow(rowId, field, value) {
  state.loadItems = state.loadItems.map((row) => {
    if (row.rowId !== rowId) return row;
    const next = { ...row };

    if (["quantity", "rating", "powerFactor", "efficiency", "hoursPerDay", "daysPerMonth"].includes(field)) {
      next[field] = Number.parseFloat(value) || 0;
    } else if (field === "demandFactor") {
      next[field] = (Number.parseFloat(value) || 0) / 100;
    } else {
      next[field] = value;
    }

    return next;
  });
}

function applyScenario() {
  const scenario = SAMPLE_SCENARIOS.find((item) => item.id === elements.scenarioSelector.value);
  if (!scenario) return;

  state.siteProfile = { ...state.siteProfile, ...scenario.siteOverrides };
  state.loadItems = scenario.rows.map((row) => applianceToRow(row.applianceId, row.quantity));
  syncFormFromState();
  render();
  elements.saveStatus.textContent = `${scenario.label} loaded into the workspace.`;
}

function populateStaticControls() {
  elements.utilityProfile.innerHTML = optionMarkup(UTILITY_PROFILES, state.siteProfile.utilityProfile);
  elements.presetSelector.innerHTML = optionMarkup(APPLIANCE_LIBRARY.map((item) => ({ value: item.id, label: item.name })), APPLIANCE_LIBRARY[0].id);
  elements.scenarioSelector.innerHTML = optionMarkup(SAMPLE_SCENARIOS.map((scenario) => ({ value: scenario.id, label: scenario.label })), SAMPLE_SCENARIOS[0].id);
  elements.tariffProfile.innerHTML = optionMarkup(TARIFF_PROFILES, TARIFF_PROFILES[0].id);
}

function bindEvents() {
  elements.siteForm.addEventListener("input", render);
  elements.utilityProfile.addEventListener("change", render);
  elements.tariffProfile.addEventListener("change", render);
  elements.tariffMultiplier.addEventListener("input", render);

  elements.addPresetButton.addEventListener("click", () => {
    state.loadItems.push(applianceToRow(elements.presetSelector.value, 1));
    render();
  });

  elements.addRowButton.addEventListener("click", () => {
    state.loadItems.push(createCustomRow(`row-${state.nextRowId++}`, state.siteProfile.defaultDaysPerMonth));
    render();
  });

  elements.applyScenarioButton.addEventListener("click", applyScenario);

  elements.loadRows.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const rowElement = target.closest("tr[data-row-id]");
    if (!rowElement) return;
    updateRow(rowElement.dataset.rowId, target.dataset.field, target.value);
    render();
  });

  elements.loadRows.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement) || target.dataset.action !== "remove") return;
    const rowElement = target.closest("tr[data-row-id]");
    if (!rowElement) return;
    state.loadItems = state.loadItems.filter((row) => row.rowId !== rowElement.dataset.rowId);
    render();
  });

  elements.saveButton.addEventListener("click", saveLocally);
  elements.printButton.addEventListener("click", () => window.print());
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      elements.saveStatus.textContent = "Service worker registration skipped.";
    });
  }
}

populateStaticControls();
loadPersistedState();
syncFormFromState();
bindEvents();
render();
registerServiceWorker();
