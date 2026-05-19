import { APPLIANCE_LIBRARY } from "./data/appliances.js";
import {
  CATEGORIES,
  DEFAULT_SITE_PROFILE,
  POWER_UNITS,
  STORAGE_KEY,
  TARIFF_PROFILES,
  UTILITY_PROFILES,
} from "./data/config.js";
import { buildStudy, createCustomRow } from "./lib/calculator.js";

const DEFAULT_TARIFF_PROFILE = structuredClone(TARIFF_PROFILES[0]);

const state = {
  nextRowId: 1,
  activeTab: "loads",
  siteProfile: {
    ...structuredClone(DEFAULT_SITE_PROFILE),
    utilityProfile: "ecg",
    premisesType: "auto",
  },
  loadItems: [],
  tariffProfile: structuredClone(DEFAULT_TARIFF_PROFILE),
};

const elements = {
  siteForm: document.querySelector("#site-form"),
  phasePreference: document.querySelector("#phase-preference"),
  defaultPowerFactor: document.querySelector("#default-pf"),
  coincidenceFactor: document.querySelector("#coincidence-factor"),
  growthMargin: document.querySelector("#growth-margin"),
  defaultDaysPerMonth: document.querySelector("#default-days"),
  presetSelector: document.querySelector("#preset-selector"),
  loadList: document.querySelector("#load-list"),
  summaryCards: document.querySelector("#summary-cards"),
  demandExplanation: document.querySelector("#demand-explanation"),
  recommendationCard: document.querySelector("#recommendation-card"),
  breakdownBars: document.querySelector("#breakdown-bars"),
  tariffSummary: document.querySelector("#tariff-summary"),
  timestamp: document.querySelector("#timestamp"),
  saveStatus: document.querySelector("#save-status"),
  addPresetButton: document.querySelector("#add-preset-btn"),
  addRowButton: document.querySelector("#add-row-btn"),
  recalculateButton: document.querySelector("#recalculate-btn"),
  saveButton: document.querySelector("#save-btn"),
  printButton: document.querySelector("#print-btn"),
  tabButtons: [...document.querySelectorAll(".tab-button")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
};

let printRestore = null;

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

function applianceToRow(applianceId, quantity = 1) {
  const appliance = APPLIANCE_LIBRARY.find((item) => item.id === applianceId) ?? APPLIANCE_LIBRARY[0];
  return {
    ...appliance,
    quantity,
    rowId: `row-${state.nextRowId++}`,
  };
}

function deriveNextRowId(loadItems) {
  return loadItems.reduce((maxValue, item) => {
    const match = /row-(\d+)/.exec(item.rowId ?? "");
    return Math.max(maxValue, match ? Number.parseInt(match[1], 10) + 1 : maxValue);
  }, 1);
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
        utilityProfile: "ecg",
        premisesType: "auto",
      };
    }

    if (parsed?.loadItems) {
      state.loadItems = parsed.loadItems.map((item) => ({
        ...item,
        rowId: item.rowId ?? `row-${state.nextRowId++}`,
      }));
    }

    state.nextRowId = deriveNextRowId(state.loadItems);
    elements.saveStatus.textContent = "Restored last saved local draft.";
  } catch {
    elements.saveStatus.textContent = "Saved draft could not be restored.";
  }
}

function syncFormFromState() {
  elements.phasePreference.value = state.siteProfile.phasePreference ?? "auto";
  elements.defaultPowerFactor.value = state.siteProfile.defaultPowerFactor ?? 0.92;
  elements.coincidenceFactor.value = Math.round((state.siteProfile.coincidenceFactor ?? 0.82) * 100);
  elements.growthMargin.value = Math.round((state.siteProfile.growthMargin ?? 0.15) * 100);
  elements.defaultDaysPerMonth.value = state.siteProfile.defaultDaysPerMonth ?? 30;
}

function collectFormState() {
  state.siteProfile = {
    ...state.siteProfile,
    utilityProfile: "ecg",
    premisesType: "auto",
    phasePreference: elements.phasePreference.value,
    defaultPowerFactor: Number.parseFloat(elements.defaultPowerFactor.value) || 0.92,
    coincidenceFactor: (Number.parseFloat(elements.coincidenceFactor.value) || 82) / 100,
    growthMargin: (Number.parseFloat(elements.growthMargin.value) || 15) / 100,
    defaultDaysPerMonth: Number.parseInt(elements.defaultDaysPerMonth.value, 10) || 30,
    tariffMultiplier: 1,
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
            Connected ${numberFormat(metrics?.connectedKw ?? 0, 2)} kW | Demand ${numberFormat(metrics?.diversifiedKw ?? 0, 2)} kW |
            Energy ${numberFormat(metrics?.monthlyEnergyKwh ?? 0, 1)} kWh/month
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

function renderLoadList(study) {
  if (!state.loadItems.length) {
    elements.loadList.innerHTML = `
      <div class="empty-state">
        No load has been added yet. Start by selecting a library item or by creating a custom load.
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
      hint: `${numberFormat(summary.connectedKva, 2)} kVA total installed load`,
    },
    {
      label: "Estimated demand load",
      value: `${numberFormat(summary.rawDemandKw, 2)} kW`,
      hint: `${numberFormat(summary.rawDemandKva, 2)} kVA after item demand factors`,
    },
    {
      label: "Design load",
      value: `${numberFormat(summary.designRealKw, 2)} kW`,
      hint: `${numberFormat(summary.designApparentKva, 2)} kVA after diversity and margin`,
    },
    {
      label: "Estimated monthly energy",
      value: `${numberFormat(summary.monthlyEnergyKwh, 1)} kWh`,
      hint: `${numberFormat(summary.monthlyEnergyKwh / 30, 1)} kWh/day average`,
    },
    {
      label: "Meter",
      value: recommendation.meterSetup,
      hint: recommendation.meterClass,
    },
    {
      label: "Feeder",
      value: recommendation.feeder,
      hint: recommendation.serviceVoltage,
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

function renderDemandExplanation(study) {
  const { summary } = study;
  elements.demandExplanation.innerHTML = `
    <article class="note-card">
      <h3>Demand load basis</h3>
      <p>
        Demand load is shown because engineers do not usually size a meter or feeder from the full installed load alone.
        We first reduce each item by its demand factor to estimate what is likely to operate in practice.
      </p>
    </article>
    <article class="note-card">
      <h3>Step 1</h3>
      <p>Connected load = sum of all entered loads = <strong>${numberFormat(summary.connectedKw, 2)} kW</strong></p>
    </article>
    <article class="note-card">
      <h3>Step 2</h3>
      <p>
        Estimated demand load = sum of each item load × item demand factor = <strong>${numberFormat(summary.rawDemandKw, 2)} kW</strong>
      </p>
    </article>
    <article class="note-card">
      <h3>Step 3</h3>
      <p>
        Simultaneous load = estimated demand load × coincidence factor (${numberFormat(summary.coincidenceFactor * 100, 0)}%) =
        <strong>${numberFormat(summary.simultaneousRealKw, 2)} kW</strong>
      </p>
    </article>
    <article class="note-card">
      <h3>Step 4</h3>
      <p>
        Design load = simultaneous load × (1 + growth margin ${numberFormat(summary.growthMargin * 100, 0)}%) =
        <strong>${numberFormat(summary.designRealKw, 2)} kW</strong>
      </p>
    </article>
  `;
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
      <p>Design load: ${numberFormat(summary.designRealKw, 2)} kW / ${numberFormat(summary.designApparentKva, 2)} kVA</p>
      <p>Recommended supply basis: ${recommendation.serviceVoltage}</p>
    </section>

    <div class="recommendation-card__grid">
      <article class="recommendation-card__section">
        <h3>Why this recommendation</h3>
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
        <h3>Important note</h3>
        <ul class="list-tight">
          ${
            recommendation.warnings.length
              ? recommendation.warnings.map((item) => `<li>${item}</li>`).join("")
              : "<li>No extra warning for the current calculation.</li>"
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
            <span>${numberFormat(item.connectedKw, 2)} kW | ${numberFormat(item.monthlyEnergyKwh, 1)} kWh/month</span>
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
      <p class="panel__microcopy">${tariffEstimate.bandLabel} tariff basis</p>
    </section>
    <article class="tariff-box">
      <h3>Charge breakdown</h3>
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
      <h3>Tariff reference</h3>
      <ul class="list-tight">
        <li>${state.tariffProfile.label}</li>
        <li>Effective date: ${state.tariffProfile.lastUpdated}</li>
      </ul>
    </article>
  `;
}

function renderTimestamp() {
  elements.timestamp.textContent = `Updated ${new Date().toLocaleString()}`;
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

function render() {
  collectFormState();
  const utilityProfile = UTILITY_PROFILES[0];
  const study = buildStudy(state.loadItems, state.siteProfile, utilityProfile, state.tariffProfile);

  renderLoadList(study);
  renderSummary(study);
  renderDemandExplanation(study);
  renderRecommendation(study);
  renderBreakdown(study);
  renderTariffSummary(study);
  renderTimestamp();
}

function saveLocally() {
  collectFormState();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      activeTab: state.activeTab,
      siteProfile: state.siteProfile,
      loadItems: state.loadItems,
    }),
  );
  elements.saveStatus.textContent = `Saved locally at ${new Date().toLocaleTimeString()}.`;
}

function preparePrint() {
  const panelStates = elements.tabPanels.map((panel) => ({ panel, hidden: panel.hidden }));
  const detailsStates = [...document.querySelectorAll("details")].map((detail) => ({ detail, open: detail.open }));

  elements.tabPanels.forEach((panel) => {
    panel.hidden = false;
  });

  document.querySelectorAll("details").forEach((detail) => {
    detail.open = true;
  });

  printRestore = () => {
    panelStates.forEach(({ panel, hidden }) => {
      panel.hidden = hidden;
    });
    detailsStates.forEach(({ detail, open }) => {
      detail.open = open;
    });
    setActiveTab(state.activeTab);
  };

  window.print();
}

function restoreAfterPrint() {
  if (!printRestore) return;
  printRestore();
  printRestore = null;
}

function bindEvents() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  elements.siteForm.addEventListener("change", render);

  elements.addPresetButton.addEventListener("click", () => {
    state.loadItems.push(applianceToRow(elements.presetSelector.value, 1));
    render();
  });

  elements.addRowButton.addEventListener("click", () => {
    state.loadItems.push(createCustomRow(`row-${state.nextRowId++}`, state.siteProfile.defaultDaysPerMonth));
    render();
  });

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
    const removeButton = target.closest("[data-action='remove']");
    if (!removeButton) return;
    const rowElement = removeButton.closest("[data-row-id]");
    if (!rowElement) return;
    state.loadItems = state.loadItems.filter((row) => row.rowId !== rowElement.dataset.rowId);
    render();
  });

  elements.recalculateButton.addEventListener("click", render);
  elements.saveButton.addEventListener("click", saveLocally);
  elements.printButton.addEventListener("click", preparePrint);
  window.addEventListener("afterprint", restoreAfterPrint);
}

function populateStaticControls() {
  elements.presetSelector.innerHTML = optionMarkup(
    APPLIANCE_LIBRARY.map((item) => ({ value: item.id, label: item.name })),
    APPLIANCE_LIBRARY[0]?.id,
  );
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
setActiveTab(state.activeTab === "results" || state.activeTab === "tariff" ? state.activeTab : "loads");
bindEvents();
render();
registerServiceWorker();
