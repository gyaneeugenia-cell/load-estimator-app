import { APPLIANCE_LIBRARY, SAMPLE_SCENARIOS } from "./data/appliances.js";
import {
  CATEGORIES,
  DEFAULT_LOAD_ITEMS,
  DEFAULT_SITE_PROFILE,
  ENGINEERING_NOTES,
  POWER_UNITS,
  STORAGE_KEY,
  TARIFF_PROFILES,
  UTILITY_PROFILES,
} from "./data/config.js";
import { buildStudy, createCustomRow } from "./lib/calculator.js";

const TARIFF_EDITOR_SECTIONS = [
  {
    title: "Profile details",
    fields: [
      { path: "lastUpdated", label: "Tariff effective date", type: "date" },
      { path: "sourceUrl", label: "Source URL", type: "url" },
    ],
  },
  {
    title: "Residential rates",
    fields: [
      { path: "rates.lifelineLimitKwh", label: "Lifeline limit (kWh)", type: "number", step: "0.1" },
      { path: "rates.residentialLifelineGhpPerKwh", label: "Lifeline rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.residentialLifelineServiceGhpPerMonth", label: "Lifeline service charge (GHp/month)", type: "number", step: "0.0001" },
      { path: "rates.residentialTierOneLimitKwh", label: "Tier 1 limit (kWh)", type: "number", step: "0.1" },
      { path: "rates.residentialTierOneGhpPerKwh", label: "Tier 1 rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.residentialTierTwoGhpPerKwh", label: "Tier 2 rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.residentialServiceGhpPerMonth", label: "Residential service charge (GHp/month)", type: "number", step: "0.0001" },
    ],
  },
  {
    title: "Commercial rates",
    fields: [
      { path: "rates.nonResidentialTierOneLimitKwh", label: "Commercial tier 1 limit (kWh)", type: "number", step: "0.1" },
      { path: "rates.nonResidentialTierOneGhpPerKwh", label: "Commercial tier 1 rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.nonResidentialTierTwoGhpPerKwh", label: "Commercial tier 2 rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.nonResidentialServiceGhpPerMonth", label: "Commercial service charge (GHp/month)", type: "number", step: "0.0001" },
    ],
  },
  {
    title: "SLT rates",
    fields: [
      { path: "rates.sltLvGhpPerKwh", label: "SLT-LV rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.sltLvServiceGhpPerMonth", label: "SLT-LV service charge (GHp/month)", type: "number", step: "0.0001" },
      { path: "rates.sltMvGhpPerKwh", label: "SLT-MV rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.sltMvServiceGhpPerMonth", label: "SLT-MV service charge (GHp/month)", type: "number", step: "0.0001" },
      { path: "rates.sltHvGhpPerKwh", label: "SLT-HV rate (GHp/kWh)", type: "number", step: "0.0001" },
      { path: "rates.sltHvServiceGhpPerMonth", label: "SLT-HV service charge (GHp/month)", type: "number", step: "0.0001" },
    ],
  },
];

const state = {
  nextRowId: 5,
  activeTab: "setup",
  siteProfile: structuredClone(DEFAULT_SITE_PROFILE),
  loadItems: structuredClone(DEFAULT_LOAD_ITEMS),
  tariffProfileId: TARIFF_PROFILES[0].id,
  tariffProfile: structuredClone(TARIFF_PROFILES[0]),
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
  loadList: document.querySelector("#load-list"),
  summaryCards: document.querySelector("#summary-cards"),
  recommendationCard: document.querySelector("#recommendation-card"),
  breakdownBars: document.querySelector("#breakdown-bars"),
  tariffSummary: document.querySelector("#tariff-summary"),
  tariffEditor: document.querySelector("#tariff-editor"),
  notesList: document.querySelector("#notes-list"),
  headerSummary: document.querySelector("#header-summary"),
  saveStatus: document.querySelector("#save-status"),
  timestamp: document.querySelector("#timestamp"),
  addPresetButton: document.querySelector("#add-preset-btn"),
  addRowButton: document.querySelector("#add-row-btn"),
  applyScenarioButton: document.querySelector("#apply-scenario-btn"),
  saveButton: document.querySelector("#save-btn"),
  exportButton: document.querySelector("#export-btn"),
  printButton: document.querySelector("#print-btn"),
  recalculateButton: document.querySelector("#recalculate-btn"),
  resetTariffButton: document.querySelector("#reset-tariff-btn"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
};

function numberFormat(value, digits = 2) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

function currencyFormat(value) {
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    maximumFractionDigits: 2,
  }).format(value);
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

function getDefaultTariffProfile(id) {
  return structuredClone(TARIFF_PROFILES.find((profile) => profile.id === id) ?? TARIFF_PROFILES[0]);
}

function findUtilityProfile(id) {
  return UTILITY_PROFILES.find((profile) => profile.id === id) ?? UTILITY_PROFILES[0];
}

function applianceToRow(applianceId, quantity = 1) {
  const appliance = APPLIANCE_LIBRARY.find((item) => item.id === applianceId) ?? APPLIANCE_LIBRARY[0];
  return {
    ...appliance,
    quantity,
    rowId: `row-${state.nextRowId++}`,
  };
}

function getNested(target, path) {
  return path.split(".").reduce((current, part) => current?.[part], target);
}

function setNested(target, path, value) {
  const parts = path.split(".");
  const last = parts.pop();
  const container = parts.reduce((current, part) => current[part], target);
  container[last] = value;
}

function deriveNextRowId(loadItems) {
  return loadItems.reduce((maxValue, item) => {
    const match = /row-(\d+)/.exec(item.rowId ?? "");
    return Math.max(maxValue, match ? Number.parseInt(match[1], 10) + 1 : maxValue);
  }, 5);
}

function setActiveTab(tabId) {
  state.activeTab = tabId;

  elements.tabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tabId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", String(isActive));
  });

  elements.tabPanels.forEach((panel) => {
    panel.hidden = panel.dataset.panel !== tabId;
  });
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (parsed?.siteProfile) {
      state.siteProfile = {
        ...structuredClone(DEFAULT_SITE_PROFILE),
        ...parsed.siteProfile,
      };
    }

    if (parsed?.loadItems?.length) {
      state.loadItems = parsed.loadItems.map((item) => ({
        ...item,
        rowId: item.rowId ?? `row-${state.nextRowId++}`,
      }));
    }

    if (parsed?.tariffProfileId) {
      state.tariffProfileId = parsed.tariffProfileId;
    }

    if (parsed?.tariffProfile) {
      state.tariffProfile = parsed.tariffProfile;
    } else {
      state.tariffProfile = getDefaultTariffProfile(state.tariffProfileId);
    }

    if (parsed?.activeTab) {
      state.activeTab = parsed.activeTab;
    }

    state.nextRowId = deriveNextRowId(state.loadItems);
    elements.saveStatus.textContent = "Restored last saved local draft.";
  } catch {
    elements.saveStatus.textContent = "Saved draft could not be restored.";
  }
}

function syncFormFromState() {
  const form = elements.siteForm;
  form.querySelector("#project-name").value = state.siteProfile.projectName ?? "";
  form.querySelector("#client-name").value = state.siteProfile.clientName ?? "";
  elements.utilityProfile.value = state.siteProfile.utilityProfile ?? "ecg";
  elements.premisesType.value = state.siteProfile.premisesType ?? "residential";
  elements.phasePreference.value = state.siteProfile.phasePreference ?? "auto";
  form.querySelector("#default-pf").value = state.siteProfile.defaultPowerFactor ?? 0.92;
  form.querySelector("#coincidence-factor").value = Math.round((state.siteProfile.coincidenceFactor ?? 0.82) * 100);
  form.querySelector("#growth-margin").value = Math.round((state.siteProfile.growthMargin ?? 0.15) * 100);
  form.querySelector("#default-days").value = state.siteProfile.defaultDaysPerMonth ?? 30;
  form.querySelector("#site-notes").value = state.siteProfile.siteNotes ?? "";
  elements.tariffMultiplier.value = Math.round((state.siteProfile.tariffMultiplier ?? 1) * 100);
  elements.tariffProfile.value = state.tariffProfileId;
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
    siteNotes: form.querySelector("#site-notes").value.trim(),
  };
}

function loadCardMarkup(row, metrics) {
  return `
    <article class="load-card" data-row-id="${row.rowId}">
      <div class="load-card__header">
        <div class="load-card__title">
          <label>
            <span>Load name</span>
            <input class="load-card__name" data-field="name" type="text" value="${row.name ?? ""}" />
          </label>
          <p class="load-card__sub">
            Category: ${row.category ?? "Other"} | Connected: ${numberFormat(metrics?.connectedKw ?? 0, 2)} kW | Demand:
            ${numberFormat(metrics?.diversifiedKw ?? 0, 2)} kW | Energy: ${numberFormat(metrics?.monthlyEnergyKwh ?? 0, 1)} kWh/mo
          </p>
        </div>
        <button class="button button--ghost" type="button" data-action="remove">Remove</button>
      </div>

      <div class="load-card__grid">
        <label>
          <span>Quantity</span>
          <input data-field="quantity" type="number" min="0" step="1" value="${row.quantity ?? 1}" />
        </label>
        <label>
          <span>Rating</span>
          <input data-field="rating" type="number" min="0" step="0.01" value="${row.rating ?? 0}" />
        </label>
        <label>
          <span>Unit</span>
          <select data-field="unit">${optionMarkup(POWER_UNITS, row.unit ?? "W")}</select>
        </label>
        <label>
          <span>Hours / day</span>
          <input data-field="hoursPerDay" type="number" min="0" max="24" step="0.1" value="${row.hoursPerDay ?? 1}" />
        </label>
      </div>

      <div class="load-card__metrics">
        <article class="metric-pill">
          <p class="metric-pill__label">Connected load</p>
          <p class="metric-pill__value">${numberFormat(metrics?.connectedKw ?? 0, 2)} kW</p>
        </article>
        <article class="metric-pill">
          <p class="metric-pill__label">Demand load</p>
          <p class="metric-pill__value">${numberFormat(metrics?.diversifiedKw ?? 0, 2)} kW</p>
        </article>
        <article class="metric-pill">
          <p class="metric-pill__label">Estimated monthly energy</p>
          <p class="metric-pill__value">${numberFormat(metrics?.monthlyEnergyKwh ?? 0, 1)} kWh</p>
        </article>
      </div>

      <details class="details-card details-card--soft">
        <summary>Advanced row settings</summary>
        <div class="load-card__grid field-grid--nested">
          <label>
            <span>Category</span>
            <select data-field="category">${optionMarkup(CATEGORIES, row.category ?? "Other")}</select>
          </label>
          <label>
            <span>Power factor</span>
            <input data-field="powerFactor" type="number" min="0.4" max="1" step="0.01" value="${row.powerFactor ?? 0.92}" />
          </label>
          <label>
            <span>Demand factor (%)</span>
            <input data-field="demandFactor" type="number" min="0" max="100" step="1" value="${Math.round((row.demandFactor ?? 1) * 100)}" />
          </label>
          <label>
            <span>Days / month</span>
            <input data-field="daysPerMonth" type="number" min="0" max="31" step="1" value="${row.daysPerMonth ?? state.siteProfile.defaultDaysPerMonth}" />
          </label>
        </div>
      </details>
    </article>
  `;
}

function renderHeaderSummary(study) {
  const { summary, recommendation, tariffEstimate } = study;
  const items = [
    { label: "Design load", value: `${numberFormat(summary.designRealKw, 2)} kW` },
    { label: "Recommended meter", value: recommendation.meterSetup },
    { label: "Feeder", value: recommendation.feeder },
    { label: "Monthly bill", value: tariffEstimate ? currencyFormat(tariffEstimate.totalGhs) : "Not available" },
  ];

  elements.headerSummary.innerHTML = items
    .map(
      (item) => `
        <article class="mini-card">
          <p class="mini-card__label">${item.label}</p>
          <p class="mini-card__value">${item.value}</p>
        </article>
      `,
    )
    .join("");
}

function renderLoadList(study) {
  if (!state.loadItems.length) {
    elements.loadList.innerHTML = `
      <div class="empty-state">
        No load has been added yet. Use “Add item”, “Load sample”, or “Add custom load” to begin.
      </div>
    `;
    return;
  }

  const metricsById = new Map(study.rows.map((row) => [row.rowId, row]));
  elements.loadList.innerHTML = state.loadItems
    .map((row) => loadCardMarkup(row, metricsById.get(row.rowId)))
    .join("");
}

function renderSummary(study) {
  const { summary, recommendation } = study;
  const cards = [
    {
      label: "Connected load",
      value: `${numberFormat(summary.connectedKw, 2)} kW`,
      hint: `${numberFormat(summary.connectedKva, 2)} kVA nameplate total`,
    },
    {
      label: "Design load",
      value: `${numberFormat(summary.designRealKw, 2)} kW`,
      hint: `${numberFormat(summary.designApparentKva, 2)} kVA after demand and margin`,
    },
    {
      label: "Estimated monthly energy",
      value: `${numberFormat(summary.monthlyEnergyKwh, 1)} kWh`,
      hint: `${numberFormat(summary.monthlyEnergyKwh / 30, 1)} kWh/day average`,
    },
    {
      label: "Meter class",
      value: recommendation.meterClass,
      hint: recommendation.planningClass,
    },
    {
      label: "Feeder",
      value: recommendation.feeder,
      hint: recommendation.serviceVoltage,
    },
    {
      label: "Power factor",
      value: numberFormat(summary.effectivePowerFactor, 2),
      hint: "Weighted operating PF",
    },
  ];

  elements.summaryCards.innerHTML = cards
    .map(
      (card) => `
        <article class="summary-card">
          <p class="summary-card__label">${card.label}</p>
          <p class="summary-card__value">${card.value}</p>
          <p class="summary-card__hint">${card.hint}</p>
        </article>
      `,
    )
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
      <h3 class="recommendation-card__title">${recommendation.meterSetup}</h3>
      <p>This study currently fits ${recommendation.planningClass} on ${recommendation.serviceVoltage}.</p>
      <p>Design load: ${numberFormat(summary.designRealKw, 2)} kW / ${numberFormat(summary.designApparentKva, 2)} kVA.</p>
    </section>

    <div class="recommendation-card__grid">
      <article class="recommendation-card__section">
        <h3>What the app is saying</h3>
        <ul class="list-tight">
          <li>Meter class: ${recommendation.meterClass}</li>
          <li>Meter setup: ${recommendation.meterSetup}</li>
          <li>Recommended feeder level: ${recommendation.feeder}</li>
          <li>Service basis: ${recommendation.serviceVoltage}</li>
        </ul>
      </article>

      <article class="recommendation-card__section">
        <h3>Why it chose this</h3>
        <ul class="list-tight">
          ${recommendation.reasons.map((item) => `<li>${item}</li>`).join("")}
        </ul>
      </article>

      <article class="recommendation-card__section">
        <h3>Current checks</h3>
        <ul class="list-tight">
          <li>230 V 1-phase: ${numberFormat(summary.currents.singlePhase230A, 1)} A</li>
          <li>400 V 3-phase: ${numberFormat(summary.currents.threePhase400A, 1)} A</li>
          <li>11 kV feeder: ${numberFormat(summary.currents.feeder11kVA, 1)} A</li>
          <li>33 kV feeder: ${numberFormat(summary.currents.feeder33kVA, 2)} A</li>
        </ul>
      </article>

      <article class="recommendation-card__section">
        <h3>Warnings / next step</h3>
        <ul class="list-tight">
          ${
            recommendation.warnings.length
              ? recommendation.warnings.map((item) => `<li>${item}</li>`).join("")
              : "<li>No special warning at the current planning level.</li>"
          }
        </ul>
      </article>
    </div>
  `;
}

function renderBreakdown(study) {
  if (!study.breakdown.length) {
    elements.breakdownBars.innerHTML = "<div class='empty-state'>Add loads to see the category breakdown.</div>";
    return;
  }

  const maxConnected = Math.max(...study.breakdown.map((item) => item.connectedKw), 0);
  elements.breakdownBars.innerHTML = study.breakdown
    .map(
      (item) => `
        <article class="breakdown-row">
          <div class="breakdown-row__head">
            <strong>${item.category}</strong>
            <span>${numberFormat(item.connectedKw, 2)} kW | ${numberFormat(item.monthlyEnergyKwh, 1)} kWh/mo</span>
          </div>
          <div class="breakdown-track">
            <div class="breakdown-track__fill" style="width: ${maxConnected ? (item.connectedKw / maxConnected) * 100 : 0}%"></div>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderTariffSummary(study) {
  const tariffEstimate = study.tariffEstimate;
  if (!tariffEstimate) {
    elements.tariffSummary.innerHTML = "<div class='empty-state'>Tariff estimate is not available.</div>";
    return;
  }

  elements.tariffSummary.innerHTML = `
    <section class="tariff-summary__hero">
      <p class="panel__eyebrow">Estimated Monthly Bill</p>
      <p class="tariff-summary__value">${currencyFormat(tariffEstimate.totalGhs)}</p>
      <p class="panel__microcopy">${tariffEstimate.bandLabel} using ${state.tariffProfile.label}</p>
      <div class="chip-row">
        <span class="chip chip--info">Multiplier ${numberFormat(tariffEstimate.multiplier * 100, 0)}%</span>
        <span class="chip chip--warning">Update when PURC changes tariffs</span>
      </div>
    </section>

    <article class="tariff-box">
      <h3>Charges</h3>
      <ul class="list-tight">
        <li>Energy charge: ${currencyFormat(tariffEstimate.energyChargeGhs)}</li>
        <li>Service charge: ${currencyFormat(tariffEstimate.serviceChargeGhs)}</li>
      </ul>
    </article>

    <article class="tariff-box">
      <h3>Billing basis</h3>
      <ul class="list-tight">
        ${tariffEstimate.breakdown.map((line) => `<li>${line}</li>`).join("")}
      </ul>
    </article>

    <article class="tariff-box">
      <h3>Current tariff profile</h3>
      <ul class="list-tight">
        <li>Profile: ${state.tariffProfile.label}</li>
        <li>Effective date: ${state.tariffProfile.lastUpdated}</li>
        <li>Source: ${state.tariffProfile.sourceUrl || "Not entered"}</li>
      </ul>
    </article>
  `;
}

function renderTariffEditor() {
  elements.tariffEditor.innerHTML = `
    <article class="editor-section">
      <h3>${state.tariffProfile.label}</h3>
      <p class="panel__microcopy">
        If PURC releases a new tariff, update the values below, then click “Save locally”.
      </p>
    </article>
    ${TARIFF_EDITOR_SECTIONS.map(
      (section) => `
        <details class="details-card details-card--soft" open>
          <summary>${section.title}</summary>
          <div class="editor-grid field-grid--nested">
            ${section.fields
              .map((field) => {
                const value = getNested(state.tariffProfile, field.path) ?? "";
                return `
                  <label class="editor-field">
                    <span>${field.label}</span>
                    <input
                      data-tariff-path="${field.path}"
                      type="${field.type}"
                      step="${field.step ?? "any"}"
                      value="${value}"
                    />
                  </label>
                `;
              })
              .join("")}
          </div>
        </details>
      `,
    ).join("")}
  `;
}

function renderNotes(utilityProfile) {
  const siteNote = state.siteProfile.siteNotes
    ? `<article class="note-card"><h3>Project notes</h3><p>${state.siteProfile.siteNotes}</p></article>`
    : "";

  elements.notesList.innerHTML = `
    <article class="note-card">
      <h3>Utility profile assumptions</h3>
      <ul class="list-tight">
        ${utilityProfile.notes.map((note) => `<li>${note}</li>`).join("")}
      </ul>
    </article>

    <article class="note-card">
      <h3>Tariff update note</h3>
      <p>
        This app now keeps tariff values on a separate tab so they do not clutter the load estimation flow.
        When you have a new PURC schedule, update the tariff fields and save locally.
      </p>
    </article>

    ${ENGINEERING_NOTES.map(
      (note) => `
        <article class="note-card">
          <h3>${note.title}</h3>
          <p>${note.body}</p>
          <a href="${note.url}" target="_blank" rel="noreferrer">Open source</a>
        </article>
      `,
    ).join("")}

    ${siteNote}
  `;
}

function renderTimestamp() {
  elements.timestamp.textContent = `Updated ${new Date().toLocaleString()}`;
}

function render() {
  collectFormState();
  const utilityProfile = findUtilityProfile(state.siteProfile.utilityProfile);
  const study = buildStudy(state.loadItems, state.siteProfile, utilityProfile, state.tariffProfile);

  renderHeaderSummary(study);
  renderLoadList(study);
  renderSummary(study);
  renderRecommendation(study);
  renderBreakdown(study);
  renderTariffSummary(study);
  renderTariffEditor();
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

function updateTariffValue(path, rawValue) {
  const currentValue = getNested(state.tariffProfile, path);
  if (typeof currentValue === "number") {
    setNested(state.tariffProfile, path, Number.parseFloat(rawValue) || 0);
    return;
  }

  setNested(state.tariffProfile, path, rawValue);
}

function saveLocally() {
  collectFormState();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeTab: state.activeTab,
      siteProfile: state.siteProfile,
      loadItems: state.loadItems,
      tariffProfileId: state.tariffProfileId,
      tariffProfile: state.tariffProfile,
    }),
  );
  elements.saveStatus.textContent = `Saved locally at ${new Date().toLocaleTimeString()}.`;
}

function exportJson(study) {
  const payload = {
    exportedAt: new Date().toISOString(),
    activeTab: state.activeTab,
    siteProfile: state.siteProfile,
    loadItems: state.loadItems,
    tariffProfileId: state.tariffProfileId,
    tariffProfile: state.tariffProfile,
    study,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gridledger-study.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function applyScenario() {
  const scenario = SAMPLE_SCENARIOS.find((item) => item.id === elements.scenarioSelector.value);
  if (!scenario) return;

  state.siteProfile = {
    ...state.siteProfile,
    ...scenario.siteOverrides,
  };
  state.loadItems = scenario.rows.map((row) => applianceToRow(row.applianceId, row.quantity));
  syncFormFromState();
  setActiveTab("loads");
  render();
  elements.saveStatus.textContent = `${scenario.label} loaded into the workspace.`;
}

function populateStaticControls() {
  elements.utilityProfile.innerHTML = optionMarkup(UTILITY_PROFILES, state.siteProfile.utilityProfile);
  elements.presetSelector.innerHTML = optionMarkup(
    APPLIANCE_LIBRARY.map((item) => ({ value: item.id, label: item.name })),
    APPLIANCE_LIBRARY[0].id,
  );
  elements.scenarioSelector.innerHTML = optionMarkup(
    SAMPLE_SCENARIOS.map((scenario) => ({ value: scenario.id, label: scenario.label })),
    SAMPLE_SCENARIOS[0].id,
  );
  elements.tariffProfile.innerHTML = optionMarkup(TARIFF_PROFILES, state.tariffProfileId);
}

function bindEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  document.body.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const jumpButton = target.closest("[data-jump-tab]");
    if (!jumpButton) return;
    setActiveTab(jumpButton.dataset.jumpTab);
  });

  elements.siteForm.addEventListener("change", () => {
    collectFormState();
    render();
  });

  elements.tariffMultiplier.addEventListener("change", () => {
    collectFormState();
    render();
  });

  elements.tariffProfile.addEventListener("change", () => {
    state.tariffProfileId = elements.tariffProfile.value;
    state.tariffProfile = getDefaultTariffProfile(state.tariffProfileId);
    render();
  });

  elements.addPresetButton.addEventListener("click", () => {
    state.loadItems.push(applianceToRow(elements.presetSelector.value, 1));
    setActiveTab("loads");
    render();
  });

  elements.addRowButton.addEventListener("click", () => {
    state.loadItems.push(createCustomRow(`row-${state.nextRowId++}`, state.siteProfile.defaultDaysPerMonth));
    setActiveTab("loads");
    render();
  });

  elements.applyScenarioButton.addEventListener("click", applyScenario);

  elements.loadList.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    const rowElement = target.closest("[data-row-id]");
    if (!rowElement) return;
    updateRow(rowElement.dataset.rowId, target.dataset.field, target.value);
    render();
  });

  elements.loadList.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest("[data-action='remove']");
    if (!button) return;
    const rowElement = target.closest("[data-row-id]");
    if (!rowElement) return;
    state.loadItems = state.loadItems.filter((row) => row.rowId !== rowElement.dataset.rowId);
    render();
  });

  elements.tariffEditor.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const path = target.dataset.tariffPath;
    if (!path) return;
    updateTariffValue(path, target.value);
    render();
  });

  elements.resetTariffButton.addEventListener("click", () => {
    state.tariffProfile = getDefaultTariffProfile(state.tariffProfileId);
    render();
    elements.saveStatus.textContent = "Tariff values reset to the selected default profile.";
  });

  elements.recalculateButton.addEventListener("click", render);
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
setActiveTab(state.activeTab);
bindEvents();
render();
registerServiceWorker();
