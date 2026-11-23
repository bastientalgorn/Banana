const DB_NAME = "bananaTrackerDB";
const DB_VERSION = 3;
const STORE_TEMPLATES = "templates";
const STORE_CAL_ENTRIES = "calEntries";
const STORE_WEIGHT_ENTRIES = "weightEntries";
const STORE_SETTINGS = "settings";
const APP_TIME_ZONE = "America/Toronto";
const SETTING_DAILY_CALORIE_TARGET = "dailyCalorieTarget";
const SETTING_WEIGHT_TARGET = "weightTarget";
const DEFAULT_DAILY_CALORIE_TARGET = 2000;
const DEFAULT_WEIGHT_TARGET = 150;
const APP_CHANGELOG = [
  {
    version: "1.19.2",
    date: "2026-11-23",
    summary: "Added a full-screen loading overlay on startup so the app isn't interactive (e.g. New entry suggestions, existing entries) until templates and history finish loading from the database.",
  },
  {
    version: "1.19.1",
    date: "2026-11-23",
    summary: "Fixed the Type field's suggestion dropdown not appearing/staying open on mobile (Android Chrome) by closing it on outside-tap instead of relying on blur+mousedown timing.",
  },
  {
    version: "1.19.0",
    date: "2026-11-23",
    summary: "New entry \"Type\" field now has a custom dropdown (works on mobile): shows previously-used matches first, then names starting with your text, then other matches by increasing name length. Data tab Maintenance now has a \"fewer than N words\" filter to trim the Templates list.",
  },
  {
    version: "1.18.0",
    date: "2026-11-22",
    summary: "Predefined templates now generated from USDA SR Legacy (7,800+ foods, incl. butter/oils previously missing), each tagged with a simple category (Meat, Dairy, Fish, etc.); common whole-unit foods like \"1 egg\"/\"1 apple\" are kept alongside gram-based entries; Data tab now requires a search once the template list is large.",
  },
  {
    version: "1.17.0",
    date: "2026-11-22",
    summary: "Seed data is no longer capped/trimmed (accuracy over brevity); stale incorrectly-named seed templates from older versions (e.g. \"1g Egg\"/\"1g Eggs\") are now cleaned up automatically; fixed extra empty space below the Maintenance card when collapsed.",
  },
  {
    version: "1.16.0",
    date: "2026-11-22",
    summary: "Fixed inconsistent/incorrect predefined food templates: different foods (e.g. egg white/yolk/whole, distinct beef cuts, cheeses) were being averaged together into one entry; each is now kept distinct with accurate calories.",
  },
  {
    version: "1.15.2",
    date: "2026-11-22",
    summary: "Clear all history: the \"press N more times\" countdown now shows directly on the button itself.",
  },
  {
    version: "1.15.1",
    date: "2026-11-22",
    summary: "Cal entry rows: calorie total column is 25% wider and sits closer to the time column.",
  },
  {
    version: "1.15.0",
    date: "2026-11-22",
    summary: "Maintenance: added a \"Clear all history\" button (requires 10 presses to confirm) that wipes calorie and weight entries; renamed the IndexedDB store to \"templates\" (no backward compatibility needed).",
  },
  {
    version: "1.14.0",
    date: "2026-11-22",
    summary: "Renamed \"item type\" to \"template\" everywhere (GUI, code, docs); behavior is unchanged.",
  },
  {
    version: "1.13.1",
    date: "2026-11-22",
    summary: "Removed the \"Version history\" heading above the changelog in the Maintenance card.",
  },
  {
    version: "1.13.0",
    date: "2026-11-22",
    summary: "Changelog is now one flat text line per version (no boxes), and version number is no longer shown separately since it's implied by the top entry.",
  },
  {
    version: "1.12.0",
    date: "2026-11-22",
    summary: "Moved version/changelog into the Maintenance card (under Deep refresh) and added a Hide/Show toggle for the whole Maintenance box.",
  },
  {
    version: "1.11.0",
    date: "2026-11-22",
    summary: "Data tab now shows the app version and a changelog of the 5 most recent updates.",
  },
  {
    version: "1.10.0",
    date: "2026-11-22",
    summary: "Entries now snapshot their own name, calories, and color instead of referencing the template live, so editing/copying an entry never changes the template or other entries.",
  },
  {
    version: "1.9.0",
    date: "2026-11-22",
    summary: "Data tab: Deep refresh moved to the top, custom templates now reliably sort before predefined ones, and the template edit form has a color picker.",
  },
  {
    version: "1.8.0",
    date: "2026-11-22",
    summary: "Data tab: custom templates are listed before predefined ones, each with a color dot.",
  },
];
const APP_VERSION = APP_CHANGELOG[0]?.version || "0.0.0";
const TEMPLATE_COLOR_PALETTE = [
  "#ff6b6b",
  "#ffa94d",
  "#ffd166",
  "#a9e34b",
  "#51cf66",
  "#38d9a9",
  "#6ea8fe",
  "#748ffc",
  "#cc5de8",
  "#f783ac",
];
const DEFAULT_TEMPLATE_COLOR = TEMPLATE_COLOR_PALETTE[0];

const TORONTO_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TORONTO_TIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  hourCycle: "h23",
});

const state = {
  db: null,
  templates: [],
  selectedDate: todayString(),
  calColorManuallySet: false,
  templateUsage: new Map(),
  calDropdownSuggestions: [],
  calDropdownActiveIndex: -1,
};

const ui = {
  appLoadingOverlay: document.getElementById("app-loading-overlay"),
  tabButtons: document.querySelectorAll(".tab-button"),
  tabSections: {
    cal: document.getElementById("tab-cal"),
    weight: document.getElementById("tab-weight"),
    data: document.getElementById("tab-data"),
  },
  dailyTotal: document.getElementById("daily-total"),
  caloriesLeft: document.getElementById("calories-left"),
  showCalAddBtn: document.getElementById("show-cal-add-btn"),
  calEntryModal: document.getElementById("cal-entry-modal"),
  calEntryModalBackdrop: document.getElementById("cal-entry-modal-backdrop"),
  calEntryForm: document.getElementById("cal-entry-form"),
  calEntryId: document.getElementById("cal-entry-id"),
  calEntrySubmitBtn: document.getElementById("cal-entry-submit-btn"),
  calEntryCancelBtn: document.getElementById("cal-entry-cancel-btn"),
  calEntryDeleteBtn: document.getElementById("cal-entry-delete-btn"),
  calTemplateText: document.getElementById("cal-template-text"),
  calTemplateDropdown: document.getElementById("cal-template-dropdown"),
  calItemCal: document.getElementById("cal-item-cal"),
  calItemCalSignBtn: document.getElementById("cal-item-cal-sign-btn"),
  calQuantity: document.getElementById("cal-quantity"),
  calTotalCalories: document.getElementById("cal-total-calories"),
  calEntryDate: document.getElementById("cal-entry-date"),
  calEntryTime: document.getElementById("cal-entry-time"),
  calColorPickerRow: document.getElementById("cal-color-picker-row"),
  qtyPlusBtn: document.getElementById("qty-plus-btn"),
  qtyMinusBtn: document.getElementById("qty-minus-btn"),
  calEntryList: document.getElementById("cal-entry-list"),
  weightTodayForm: document.getElementById("weight-today-form"),
  weightDateDisplay: document.getElementById("weight-date-display"),
  weightTodayDate: document.getElementById("weight-today-date"),
  weightDatePickerBtn: document.getElementById("weight-date-picker-btn"),
  weightTodayInput: document.getElementById("weight-today-input"),
  weightHistoryList: document.getElementById("weight-history-list"),
  weightChart: document.getElementById("weight-chart"),
  progressEditModal: document.getElementById("progress-edit-modal"),
  progressEditModalBackdrop: document.getElementById("progress-edit-modal-backdrop"),
  progressEditForm: document.getElementById("progress-edit-form"),
  progressEditOriginalDate: document.getElementById("progress-edit-original-date"),
  progressEditDateDisplay: document.getElementById("progress-edit-date-display"),
  progressEditDate: document.getElementById("progress-edit-date"),
  progressEditDatePickerBtn: document.getElementById("progress-edit-date-picker-btn"),
  progressEditWeight: document.getElementById("progress-edit-weight"),
  progressEditPlusBtn: document.getElementById("progress-edit-plus-btn"),
  progressEditMinusBtn: document.getElementById("progress-edit-minus-btn"),
  progressEditCancelBtn: document.getElementById("progress-edit-cancel-btn"),
  progressEditDeleteBtn: document.getElementById("progress-edit-delete-btn"),
  templateForm: document.getElementById("template-form"),
  templateName: document.getElementById("template-name"),
  templateCal: document.getElementById("template-cal"),
  templateCalSignBtn: document.getElementById("template-cal-sign-btn"),
  targetsForm: document.getElementById("targets-form"),
  dailyCalorieTarget: document.getElementById("daily-calorie-target"),
  weightTarget: document.getElementById("weight-target"),
  templateSearch: document.getElementById("template-search"),
  templateMaxWords: document.getElementById("template-max-words"),
  templateList: document.getElementById("template-list"),
  templateModal: document.getElementById("template-modal"),
  templateModalBackdrop: document.getElementById("template-modal-backdrop"),
  templateEditForm: document.getElementById("template-edit-form"),
  templateEditId: document.getElementById("template-edit-id"),
  templateEditName: document.getElementById("template-edit-name"),
  templateEditCal: document.getElementById("template-edit-cal"),
  templateCalPlusBtn: document.getElementById("template-cal-plus-btn"),
  templateCalMinusBtn: document.getElementById("template-cal-minus-btn"),
  templateEditCalSignBtn: document.getElementById("template-edit-cal-sign-btn"),
  templateEditCancelBtn: document.getElementById("template-edit-cancel-btn"),
  templateEditDeleteBtn: document.getElementById("template-edit-delete-btn"),
  templateEditColorPickerRow: document.getElementById("template-edit-color-picker-row"),
  deepRefreshBtn: document.getElementById("deep-refresh-btn"),
  deepRefreshStatus: document.getElementById("deep-refresh-status"),
  clearAllHistoryBtn: document.getElementById("clear-all-history-btn"),
  clearAllHistoryStatus: document.getElementById("clear-all-history-status"),
  changelogList: document.getElementById("changelog-list"),
  maintenanceBody: document.getElementById("maintenance-body"),
  maintenanceToggleBtn: document.getElementById("maintenance-toggle-btn"),
  listTemplate: document.getElementById("simple-list-item-template"),
};

document.addEventListener("DOMContentLoaded", async () => {
  try {
    bindUiEvents();
    buildColorSwatches(ui.calColorPickerRow);
    buildColorSwatches(ui.templateEditColorPickerRow);
    renderVersionInfo();
    state.db = await openDatabase();
    await ensureDefaultSettings();
    await migrateLegacy100gTemplates();
    await ensureSeedData();
    await migrateFlagExistingSeedTemplates();
    await pruneStaleSeedTemplates();
    await simplifyAndPruneTemplates();
    state.templates = await listTemplates();
    ui.weightTodayDate.value = state.selectedDate;

    await refreshTemplateUsage();
    await refreshCalView();
    await refreshWeightView();
    await refreshDataView();
    await loadTargetsIntoForm();

    if (ui.appLoadingOverlay) {
      ui.appLoadingOverlay.classList.add("hidden");
    }
  } catch (error) {
    console.error("Initial app load failed", error);
    if (ui.appLoadingOverlay) {
      ui.appLoadingOverlay.innerHTML = "<p>Failed to load app data. Please reload the page.</p>";
    }
  }
});

function bindUiEvents() {
  ui.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

  ui.showCalAddBtn.addEventListener("click", () => {
    openCalEntryModalForCreate();
  });

  ui.calEntryCancelBtn.addEventListener("click", () => closeCalEntryModal());
  ui.calEntryModalBackdrop.addEventListener("click", () => closeCalEntryModal());

  ui.calTemplateText.addEventListener("input", async () => {
    updateCalTemplateDropdown();
    await syncCalModalTypeFields({ autoSuggestQuantity: true });
  });

  ui.calTemplateText.addEventListener("focus", () => {
    updateCalTemplateDropdown();
  });

  document.addEventListener("pointerdown", (event) => {
    if (ui.calTemplateDropdown.classList.contains("hidden")) {
      return;
    }
    const wrap = ui.calTemplateText.closest(".autocomplete-wrap");
    if (wrap && !wrap.contains(event.target)) {
      hideCalTemplateDropdown();
    }
  });

  ui.calTemplateText.addEventListener("keydown", (event) => {
    if (ui.calTemplateDropdown.classList.contains("hidden")) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveCalTemplateDropdownSelection(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveCalTemplateDropdownSelection(-1);
    } else if (event.key === "Enter") {
      if (state.calDropdownActiveIndex >= 0) {
        event.preventDefault();
        selectCalTemplateDropdownItem(state.calDropdownActiveIndex);
      }
    } else if (event.key === "Escape") {
      hideCalTemplateDropdown();
    }
  });

  if (ui.templateMaxWords) {
    ui.templateMaxWords.addEventListener("input", async () => {
      await refreshDataView();
    });
  }

  ui.calItemCal.addEventListener("input", () => {
    refreshCalModalComputedFields();
  });

  ui.calItemCal.addEventListener("change", () => {
    refreshCalModalComputedFields();
  });

  ui.calEntryForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const result = await saveCalEntryFromModal();
      if (!result) {
        return;
      }
      closeCalEntryModal();
      await reloadTemplatesAndRefresh();
    } catch (error) {
      alert(error.message);
    }
  });

  ui.qtyPlusBtn.addEventListener("click", () => {
    const current = Number.parseInt(ui.calQuantity.value || "1", 10);
    const safeValue = Number.isInteger(current) && current > 0 ? current : 1;
    ui.calQuantity.value = String(safeValue + 1);
    refreshCalModalComputedFields();
  });

  ui.qtyMinusBtn.addEventListener("click", () => {
    const current = Number.parseInt(ui.calQuantity.value || "1", 10);
    const safeValue = Number.isInteger(current) && current > 0 ? current : 1;
    ui.calQuantity.value = String(Math.max(1, safeValue - 1));
    refreshCalModalComputedFields();
  });

  ui.calQuantity.addEventListener("input", () => {
    refreshCalModalComputedFields();
  });

  ui.calQuantity.addEventListener("change", () => {
    refreshCalModalComputedFields();
  });

  ui.calEntryDate.addEventListener("change", () => {
    refreshCalModalComputedFields();
  });

  ui.calEntryTime.addEventListener("change", () => {
    refreshCalModalComputedFields();
  });

  ui.calEntryDeleteBtn.addEventListener("click", async () => {
    const entryId = Number(ui.calEntryId.value);
    if (!entryId) {
      closeCalEntryModal();
      return;
    }

    await handleDoubleTapDelete(ui.calEntryDeleteBtn, async () => {
      await deleteRecord(STORE_CAL_ENTRIES, entryId);
      closeCalEntryModal();
      await refreshCalView();
    });
  });

  ui.weightTodayForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const date = ui.weightTodayDate.value || todayString();
    const weight = Number(ui.weightTodayInput.value);

    if (!Number.isFinite(weight) || weight <= 0) {
      alert("Weight must be a positive number.");
      return;
    }

    const existingRecord = await getRecord(STORE_WEIGHT_ENTRIES, date);

    await updateRecord(STORE_WEIGHT_ENTRIES, {
      date,
      weightKg: round1(weight),
      createdAt: existingRecord?.createdAt || currentTimeString(),
    });

    await refreshWeightView();
  });

  ui.weightDatePickerBtn.addEventListener("click", () => {
    if (typeof ui.weightTodayDate.showPicker === "function") {
      ui.weightTodayDate.showPicker();
    } else {
      ui.weightTodayDate.click();
    }
  });

  ui.weightTodayDate.addEventListener("change", async () => {
    const date = ui.weightTodayDate.value || todayString();
    ui.weightTodayDate.value = date;
    ui.weightDateDisplay.textContent = date;
    await refreshWeightView();
  });

  ui.progressEditModalBackdrop.addEventListener("click", () => {
    closeProgressEditModal();
  });

  ui.progressEditCancelBtn.addEventListener("click", () => {
    closeProgressEditModal();
  });

  ui.progressEditDatePickerBtn.addEventListener("click", () => {
    if (typeof ui.progressEditDate.showPicker === "function") {
      ui.progressEditDate.showPicker();
    } else {
      ui.progressEditDate.click();
    }
  });

  ui.progressEditDate.addEventListener("change", () => {
    const date = ui.progressEditDate.value || todayString();
    ui.progressEditDate.value = date;
    ui.progressEditDateDisplay.textContent = formatProgressDate(date);
  });

  ui.progressEditPlusBtn.addEventListener("click", () => {
    const current = Number(ui.progressEditWeight.value || "0");
    const safeValue = Number.isFinite(current) ? current : 0;
    ui.progressEditWeight.value = String(round1(safeValue + 0.1));
  });

  ui.progressEditMinusBtn.addEventListener("click", () => {
    const current = Number(ui.progressEditWeight.value || "0");
    const safeValue = Number.isFinite(current) ? current : 0;
    ui.progressEditWeight.value = String(Math.max(0, round1(safeValue - 0.1)));
  });

  ui.progressEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const originalDate = ui.progressEditOriginalDate.value;
    const nextDate = ui.progressEditDate.value || todayString();
    const nextWeight = Number(ui.progressEditWeight.value);

    if (!originalDate) {
      alert("Entry not found.");
      return;
    }
    if (!Number.isFinite(nextWeight) || nextWeight <= 0) {
      alert("Weight must be a positive number.");
      return;
    }

    const originalRecord = await getRecord(STORE_WEIGHT_ENTRIES, originalDate);
    if (!originalRecord) {
      alert("Entry no longer exists.");
      closeProgressEditModal();
      await refreshWeightView();
      return;
    }

    if (nextDate !== originalDate) {
      const targetRecord = await getRecord(STORE_WEIGHT_ENTRIES, nextDate);
      if (targetRecord) {
        alert("There is already a progress entry for this date.");
        return;
      }
      await deleteRecord(STORE_WEIGHT_ENTRIES, originalDate);
    }

    await updateRecord(STORE_WEIGHT_ENTRIES, {
      date: nextDate,
      weightKg: round1(nextWeight),
      createdAt: originalRecord.createdAt || currentTimeString(),
    });

    closeProgressEditModal();
    await refreshWeightView();
  });

  ui.progressEditDeleteBtn.addEventListener("click", async () => {
    await handleDoubleTapDelete(ui.progressEditDeleteBtn, async () => {
      const originalDate = ui.progressEditOriginalDate.value;
      if (!originalDate) {
        return;
      }
      await deleteRecord(STORE_WEIGHT_ENTRIES, originalDate);
      closeProgressEditModal();
      await refreshWeightView();
    });
  });

  ui.templateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await createTemplate(ui.templateName.value, ui.templateCal.value);
      ui.templateForm.reset();
      await reloadTemplatesAndRefresh();
    } catch (error) {
      alert(error.message);
    }
  });

  ui.targetsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveAllTargetsFromForm();
  });

  ui.dailyCalorieTarget.addEventListener("change", async () => {
    await autoSaveTargetField({
      input: ui.dailyCalorieTarget,
      key: SETTING_DAILY_CALORIE_TARGET,
      fallback: DEFAULT_DAILY_CALORIE_TARGET,
      label: "Daily calory target",
      onSaved: refreshCalView,
    });
  });

  ui.weightTarget.addEventListener("change", async () => {
    await autoSaveTargetField({
      input: ui.weightTarget,
      key: SETTING_WEIGHT_TARGET,
      fallback: DEFAULT_WEIGHT_TARGET,
      label: "Weight target",
      onSaved: refreshWeightView,
    });
  });

  ui.dailyCalorieTarget.addEventListener("blur", async () => {
    await normalizeTargetFieldDisplay({
      input: ui.dailyCalorieTarget,
      key: SETTING_DAILY_CALORIE_TARGET,
      fallback: DEFAULT_DAILY_CALORIE_TARGET,
      label: "Daily calory target",
      onSaved: refreshCalView,
    });
  });

  ui.weightTarget.addEventListener("blur", async () => {
    await normalizeTargetFieldDisplay({
      input: ui.weightTarget,
      key: SETTING_WEIGHT_TARGET,
      fallback: DEFAULT_WEIGHT_TARGET,
      label: "Weight target",
      onSaved: refreshWeightView,
    });
  });

  ui.templateSearch.addEventListener("input", async () => {
    await refreshDataView();
  });

  ui.deepRefreshBtn.addEventListener("click", () => {
    void performDeepRefresh();
  });

  ui.clearAllHistoryBtn.addEventListener("click", () => {
    void handleClearAllHistoryClick();
  });

  ui.maintenanceToggleBtn.addEventListener("click", () => {
    const isHidden = ui.maintenanceBody.classList.toggle("hidden");
    ui.maintenanceToggleBtn.textContent = isHidden ? "Show" : "Hide";
    ui.maintenanceToggleBtn.setAttribute("aria-expanded", String(!isHidden));
    ui.maintenanceToggleBtn.closest(".card-header-row")?.classList.toggle("header-row-collapsed", isHidden);
  });

  ui.templateModalBackdrop.addEventListener("click", () => {
    closeTemplateModal();
  });

  ui.templateEditCancelBtn.addEventListener("click", () => {
    closeTemplateModal();
  });

  ui.templateEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = Number(ui.templateEditId.value);
    const name = ui.templateEditName.value.trim();
    const calPerUnit = Number(ui.templateEditCal.value);

    if (!id) {
      alert("Template not found.");
      return;
    }
    if (!name) {
      alert("Name cannot be empty.");
      return;
    }
    if (!Number.isFinite(calPerUnit)) {
      alert("Calories must be numeric.");
      return;
    }

    const existingTemplate = state.templates.find((candidate) => candidate.id === id) || {};

    await updateRecord(STORE_TEMPLATES, {
      ...existingTemplate,
      id,
      name,
      calPerUnit: roundTo(calPerUnit, 3),
      color: getSelectedColor(ui.templateEditColorPickerRow),
    });

    closeTemplateModal();
    await reloadTemplatesAndRefresh();
  });

  ui.templateEditDeleteBtn.addEventListener("click", async () => {
    await handleDoubleTapDelete(ui.templateEditDeleteBtn, async () => {
      const id = Number(ui.templateEditId.value);
      if (!id) {
        return;
      }

      const usages = await countCalEntriesForTemplate(id);
      if (usages > 0) {
        alert("Cannot delete an template used by calorie entries.");
        return;
      }

      await deleteRecord(STORE_TEMPLATES, id);
      closeTemplateModal();
      await reloadTemplatesAndRefresh();
    });
  });

  ui.templateCalPlusBtn.addEventListener("click", () => {
    const current = Number(ui.templateEditCal.value || "0");
    const safeValue = Number.isFinite(current) ? current : 0;
    ui.templateEditCal.value = String(roundTo(safeValue + 1, 3));
  });

  ui.templateCalMinusBtn.addEventListener("click", () => {
    const current = Number(ui.templateEditCal.value || "0");
    const safeValue = Number.isFinite(current) ? current : 0;
    ui.templateEditCal.value = String(roundTo(safeValue - 1, 3));
  });

  ui.templateEditCalSignBtn.addEventListener("click", () => {
    toggleInputSign(ui.templateEditCal);
  });

  ui.templateCalSignBtn.addEventListener("click", () => {
    toggleInputSign(ui.templateCal);
  });

  ui.calItemCalSignBtn.addEventListener("click", () => {
    toggleInputSign(ui.calItemCal);
    refreshCalModalComputedFields();
  });
}

function switchTab(tabName) {
  ui.tabButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });

  Object.entries(ui.tabSections).forEach(([name, section]) => {
    section.classList.toggle("active", name === tabName);
  });
}

function renderVersionInfo() {
  ui.changelogList.innerHTML = "";

  const recentEntries = APP_CHANGELOG.slice(0, 5);
  for (const change of recentEntries) {
    const node = document.createElement("li");
    node.className = "changelog-line";
    node.textContent = `v${change.version} (${change.date}) \u2014 ${change.summary}`;
    ui.changelogList.appendChild(node);
  }

  if (recentEntries.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.className = "changelog-line";
    emptyNode.textContent = "No changelog entries yet.";
    ui.changelogList.appendChild(emptyNode);
  }
}

async function reloadTemplatesAndRefresh() {
  state.templates = await listTemplates();
  await refreshTemplateUsage();
  await refreshCalView();
  await refreshWeightView();
  await refreshDataView();
}

async function performDeepRefresh() {
  const statusNode = ui.deepRefreshStatus;
  const button = ui.deepRefreshBtn;
  button.disabled = true;
  if (statusNode) {
    statusNode.textContent = "Clearing caches...";
  }

  try {
    if (window.caches && typeof caches.keys === "function") {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
    }

    if (navigator.serviceWorker && typeof navigator.serviceWorker.getRegistrations === "function") {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch (error) {
    console.error("Deep refresh cleanup failed", error);
  }

  if (statusNode) {
    statusNode.textContent = "Reloading...";
  }

  const bustedUrl = new URL(window.location.href);
  bustedUrl.searchParams.set("_deepRefresh", String(Date.now()));
  window.location.replace(bustedUrl.toString());
}

const CLEAR_ALL_HISTORY_PRESSES_REQUIRED = 10;
const CLEAR_ALL_HISTORY_RESET_DELAY_MS = 4000;

async function handleClearAllHistoryClick() {
  const button = ui.clearAllHistoryBtn;
  const statusNode = ui.clearAllHistoryStatus;

  if (!button.dataset.originalLabel) {
    button.dataset.originalLabel = button.textContent;
  }
  const originalLabel = button.dataset.originalLabel;

  const pressCount = (Number(button.dataset.pressCount) || 0) + 1;
  button.dataset.pressCount = String(pressCount);

  if (button._clearHistoryResetTimer) {
    clearTimeout(button._clearHistoryResetTimer);
  }

  if (pressCount >= CLEAR_ALL_HISTORY_PRESSES_REQUIRED) {
    button.dataset.pressCount = "0";
    button.disabled = true;
    button.textContent = "Clearing all history...";

    try {
      await clearAllHistory();
      if (statusNode) {
        statusNode.textContent = "All history cleared.";
      }
    } catch (error) {
      console.error("Clear all history failed", error);
      if (statusNode) {
        statusNode.textContent = "Failed to clear history.";
      }
    } finally {
      button.disabled = false;
      button.textContent = originalLabel;
    }
    return;
  }

  const remaining = CLEAR_ALL_HISTORY_PRESSES_REQUIRED - pressCount;
  button.textContent = `Press ${remaining} more time${remaining === 1 ? "" : "s"} to confirm.`;

  button._clearHistoryResetTimer = setTimeout(() => {
    button.dataset.pressCount = "0";
    button.textContent = originalLabel;
  }, CLEAR_ALL_HISTORY_RESET_DELAY_MS);
}

async function clearAllHistory() {
  await clearStore(STORE_CAL_ENTRIES);
  await clearStore(STORE_WEIGHT_ENTRIES);
  await refreshCalView();
  await refreshWeightView();
  await refreshDataView();
}

async function refreshTemplateUsage() {
  const entries = await listAll(STORE_CAL_ENTRIES);
  const usage = new Map();
  for (const entry of entries) {
    if (!entry.templateId) {
      continue;
    }
    const timestamp = String(entry.createdAt || entry.date || "");
    const existing = usage.get(entry.templateId);
    if (!existing || timestamp > existing) {
      usage.set(entry.templateId, timestamp);
    }
  }
  state.templateUsage = usage;
}

function countNameWords(name) {
  const matches = String(name || "").match(/[A-Za-z]+/g);
  return matches ? matches.length : 0;
}

function stripLeadingUnitPrefix(name) {
  // Strips a leading "1g " or "1 " unit-count prefix used by generated seed
  // names, so "starts with S" matching feels natural (e.g. typing "egg"
  // should count "1g Egg" as starting with "egg").
  return String(name || "").replace(/^1g?\s+/i, "");
}

function splitSearchWords(query) {
  return String(query || "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
}

function nameMatchesAllWords(lowerName, words) {
  return words.every((word) => lowerName.includes(word));
}

function buildCalTemplateSuggestions(query) {
  const trimmedQuery = String(query || "").trim().toLowerCase();
  const searchWords = splitSearchWords(query);
  if (searchWords.length === 0) {
    return [];
  }

  const MAX_SUGGESTIONS = 50;
  const previouslyUsed = [];
  const startsWith = [];
  const others = [];

  for (const template of state.templates) {
    const name = String(template.name || "");
    const lowerName = name.toLowerCase();
    if (!nameMatchesAllWords(lowerName, searchWords)) {
      continue;
    }

    const lastUsedAt = state.templateUsage.get(template.id);
    if (lastUsedAt) {
      previouslyUsed.push({ template, lastUsedAt });
      continue;
    }

    const strippedName = stripLeadingUnitPrefix(name).toLowerCase();
    if (strippedName.startsWith(trimmedQuery)) {
      startsWith.push(template);
    } else {
      others.push(template);
    }
  }

  previouslyUsed.sort((left, right) => String(right.lastUsedAt).localeCompare(String(left.lastUsedAt)));
  const byLengthThenName = (left, right) =>
    String(left.name || "").length - String(right.name || "").length ||
    String(left.name || "").localeCompare(String(right.name || ""));
  startsWith.sort(byLengthThenName);
  others.sort(byLengthThenName);

  const ranked = [...previouslyUsed.map((entry) => entry.template), ...startsWith, ...others];
  return ranked.slice(0, MAX_SUGGESTIONS);
}

function hideCalTemplateDropdown() {
  state.calDropdownSuggestions = [];
  state.calDropdownActiveIndex = -1;
  ui.calTemplateDropdown.innerHTML = "";
  ui.calTemplateDropdown.classList.add("hidden");
}

function selectCalTemplateDropdownItem(index) {
  const template = state.calDropdownSuggestions[index];
  if (!template) {
    return;
  }
  ui.calTemplateText.value = template.name;
  hideCalTemplateDropdown();
  void syncCalModalTypeFields({ autoSuggestQuantity: true });
}

function renderCalTemplateDropdown(suggestions) {
  state.calDropdownSuggestions = suggestions;
  state.calDropdownActiveIndex = -1;
  ui.calTemplateDropdown.innerHTML = "";

  if (suggestions.length === 0) {
    ui.calTemplateDropdown.classList.add("hidden");
    return;
  }

  suggestions.forEach((template, index) => {
    const item = document.createElement("div");
    item.className = "autocomplete-item";
    item.textContent = `${template.name} (${formatCal(template.calPerUnit)} kcal)`;
    item.addEventListener("click", () => {
      selectCalTemplateDropdownItem(index);
    });
    ui.calTemplateDropdown.appendChild(item);
  });

  ui.calTemplateDropdown.classList.remove("hidden");
}

function updateCalTemplateDropdown() {
  const suggestions = buildCalTemplateSuggestions(ui.calTemplateText.value);
  renderCalTemplateDropdown(suggestions);
}

function moveCalTemplateDropdownSelection(delta) {
  const items = Array.from(ui.calTemplateDropdown.querySelectorAll(".autocomplete-item"));
  if (items.length === 0) {
    return;
  }

  items.forEach((item) => item.classList.remove("active"));
  const current = state.calDropdownActiveIndex;
  const nextIndex = ((current < 0 ? -1 : current) + delta + items.length) % items.length;
  state.calDropdownActiveIndex = nextIndex;
  items[nextIndex].classList.add("active");
  items[nextIndex].scrollIntoView({ block: "nearest" });
}

async function refreshCalView() {
  const entries = await listAll(STORE_CAL_ENTRIES);
  const templateMap = indexById(state.templates);
  const today = todayString();
  const yesterday = offsetDateString(today, -1);
  const dailyTarget = await readSettingNumber(SETTING_DAILY_CALORIE_TARGET, DEFAULT_DAILY_CALORIE_TARGET);

  let total = 0;
  ui.calEntryList.innerHTML = "";

  const sortedEntries = [...entries].sort((left, right) => {
    const dateCompare = String(right.date || "").localeCompare(String(left.date || ""));
    if (dateCompare !== 0) {
      return dateCompare;
    }

    const timeCompare = String(right.createdAt || "").localeCompare(String(left.createdAt || ""));
    if (timeCompare !== 0) {
      return timeCompare;
    }

    return Number(right.id || 0) - Number(left.id || 0);
  });

  let currentDateGroup = "";
  let renderedRows = 0;

  for (const entry of sortedEntries) {
    const template = templateMap[entry.templateId];
    if (!template) {
      continue;
    }

    const lineTotal = getEntryCalPerItem(entry, template) * entry.quantity;
    if (entry.date === today) {
      total += lineTotal;
    }

    if (entry.date !== currentDateGroup) {
      currentDateGroup = entry.date;
      const headerNode = document.createElement("li");
      headerNode.className = "cal-day-header";
      headerNode.textContent = formatCalGroupHeader(entry.date, today, yesterday);
      ui.calEntryList.appendChild(headerNode);
    }

    const displayName = entry.customName || template.name;
    const createdTime = entry.createdAt || "--:--";

    const itemNode = document.createElement("li");
    itemNode.className = "list-item cal-entry-row cal-entry-data-row cal-entry-columns";

    const quantityNode = document.createElement("span");
    quantityNode.className = "cal-col cal-col-qty";
    const quantityValueNode = document.createElement("span");
    quantityValueNode.className = "cal-qty-value";
    quantityValueNode.textContent = String(entry.quantity);
    const quantityXNode = document.createElement("span");
    quantityXNode.className = "cal-qty-x";
    quantityXNode.textContent = "x";
    quantityNode.appendChild(quantityValueNode);
    quantityNode.appendChild(quantityXNode);

    const nameNode = document.createElement("span");
    nameNode.className = "cal-col cal-col-name";
    const colorDot = document.createElement("span");
    colorDot.className = "entry-color-dot";
    colorDot.style.backgroundColor = getEntryColor(entry, template);
    const nameText = document.createElement("span");
    nameText.textContent = displayName;
    nameNode.appendChild(colorDot);
    nameNode.appendChild(nameText);

    const totalNode = document.createElement("span");
    totalNode.className = "cal-col cal-col-total";
    totalNode.textContent = `${Math.round(lineTotal)}`;

    const timeNode = document.createElement("span");
    timeNode.className = "cal-col cal-col-time";
    timeNode.textContent = createdTime;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "icon-edit-button icon-copy-button";
    copyButton.title = "Copy entry";
    copyButton.setAttribute("aria-label", "Copy entry");
    copyButton.textContent = "⧉";
    copyButton.addEventListener("click", () => {
      openCalEntryModalForCreate({
        typeName: displayName,
        quantity: entry.quantity,
        date: todayString(),
        time: currentTimeString(),
        calPerItem: getEntryCalPerItem(entry, template),
        color: getEntryColor(entry, template),
      });
    });

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-edit-button";
    editButton.title = "Edit entry";
    editButton.setAttribute("aria-label", "Edit entry");
    editButton.textContent = "✎";
    editButton.addEventListener("click", () => openCalEntryModalForEdit(entry));

    itemNode.appendChild(quantityNode);
    itemNode.appendChild(nameNode);
    itemNode.appendChild(totalNode);
    itemNode.appendChild(timeNode);
    itemNode.appendChild(copyButton);
    itemNode.appendChild(editButton);
    ui.calEntryList.appendChild(itemNode);
    renderedRows += 1;
  }

  if (renderedRows === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.className = "list-item";
    emptyNode.textContent = "No entries for this day yet.";
    ui.calEntryList.appendChild(emptyNode);
  }

  const roundedTotal = Math.round(total);
  const caloriesLeft = dailyTarget - roundedTotal;
  ui.dailyTotal.textContent = String(roundedTotal);
  ui.caloriesLeft.textContent = String(caloriesLeft);
}

async function refreshWeightView() {
  const date = ui.weightTodayDate.value || todayString();
  ui.weightTodayDate.value = date;
  ui.weightDateDisplay.textContent = formatProgressDate(date);
  const weightTarget = await readSettingNumber(SETTING_WEIGHT_TARGET, DEFAULT_WEIGHT_TARGET);

  const weightRecord = await getRecord(STORE_WEIGHT_ENTRIES, date);
  ui.weightTodayInput.value = weightRecord ? String(weightRecord.weightKg) : "";

  const allWeights = await listAll(STORE_WEIGHT_ENTRIES);
  allWeights.sort((left, right) => left.date.localeCompare(right.date));

  ui.weightHistoryList.innerHTML = "";
  for (const record of [...allWeights].reverse()) {
    const node = document.createElement("li");
    node.className = "list-item cal-entry-row";

    const label = document.createElement("span");
    label.className = "cal-entry-label progress-history-label";
    const dateSpan = document.createElement("span");
    dateSpan.textContent = formatProgressDate(record.date);
    const weightSpan = document.createElement("span");
    weightSpan.textContent = String(record.weightKg);
    label.appendChild(dateSpan);
    label.appendChild(weightSpan);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-edit-button";
    editButton.title = "Edit data point";
    editButton.setAttribute("aria-label", "Edit data point");
    editButton.textContent = "✎";
    editButton.addEventListener("click", () => openProgressEditModal(record));

    node.appendChild(label);
    node.appendChild(editButton);

    ui.weightHistoryList.appendChild(node);
  }

  if (allWeights.length === 0) {
    const empty = document.createElement("li");
    empty.className = "list-item";
    empty.textContent = "No weight records yet.";
    ui.weightHistoryList.appendChild(empty);
  }

  drawWeightChart(allWeights, weightTarget);
}

function drawWeightChart(records, targetWeight) {
  const canvas = ui.weightChart;
  const context = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const padding = 90;

  context.clearRect(0, 0, width, height);
  context.fillStyle = "#0f1723";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "#30363d";
  context.lineWidth = 1;
  context.beginPath();
  context.moveTo(padding, padding);
  context.lineTo(padding, height - padding);
  context.lineTo(width - padding, height - padding);
  context.stroke();

  if (records.length === 0) {
    context.fillStyle = "#8b949e";
    context.font = "48px Segoe UI";
    context.fillText("No data yet", padding + 10, padding + 50);
    return;
  }

  const weights = records.map((entry) => entry.weightKg);
  const hasValidTarget = Number.isFinite(targetWeight) && targetWeight > 0;
  const minWeight = hasValidTarget ? Math.min(...weights, targetWeight) : Math.min(...weights);
  const maxWeight = hasValidTarget ? Math.max(...weights, targetWeight) : Math.max(...weights);
  const spread = Math.max(maxWeight - minWeight, 1);

  const xStep = records.length === 1 ? 0 : (width - padding * 2) / (records.length - 1);

  context.strokeStyle = "#ffd166";
  context.lineWidth = 2;
  context.beginPath();

  records.forEach((record, index) => {
    const x = padding + index * xStep;
    const normalized = (record.weightKg - minWeight) / spread;
    const y = height - padding - normalized * (height - padding * 2);

    if (index === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  });

  context.stroke();

  if (hasValidTarget) {
    const normalizedTarget = (targetWeight - minWeight) / spread;
    const targetY = height - padding - normalizedTarget * (height - padding * 2);
    context.save();
    context.setLineDash([8, 6]);
    context.strokeStyle = "#6ea8fe";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(padding, targetY);
    context.lineTo(width - padding, targetY);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = "#6ea8fe";
    context.font = "42px Segoe UI";
    context.fillText(`Target ${targetWeight}`, padding + 8, Math.max(padding + 42, targetY - 10));
    context.restore();
  }

  context.fillStyle = "#e6edf3";
  context.font = "42px Segoe UI";
  context.fillText(`${minWeight.toFixed(1)}`, 8, height - padding);
  context.fillText(`${maxWeight.toFixed(1)}`, 8, padding + 18);

  const first = records[0];
  const last = records[records.length - 1];
  context.fillText(first.date, padding, height - 20);
  const lastLabelWidth = context.measureText(last.date).width;
  context.fillText(last.date, width - padding - lastLabelWidth, height - 20);
}

async function refreshDataView() {
  ui.templateList.innerHTML = "";
  const query = String(ui.templateSearch.value || "").trim().toLowerCase();
  const searchWords = splitSearchWords(query);
  const maxWordsRaw = ui.templateMaxWords ? Number(ui.templateMaxWords.value) : NaN;
  const maxWords = Number.isInteger(maxWordsRaw) && maxWordsRaw > 0 ? maxWordsRaw : null;

  let filteredTemplates = query
    ? state.templates.filter((template) => nameMatchesAllWords(String(template.name || "").toLowerCase(), searchWords))
    : state.templates;

  if (maxWords !== null) {
    filteredTemplates = filteredTemplates.filter((template) => countNameWords(template.name) < maxWords);
  }

  // With thousands of seeded templates now available, rendering the full
  // unfiltered list into the DOM would be slow and overwhelming. Require a
  // search term (or a word-count trim) once the list grows large;
  // small/custom lists still show everything by default like before.
  const UNFILTERED_DISPLAY_LIMIT = 150;
  if (!query && maxWords === null && state.templates.length > UNFILTERED_DISPLAY_LIMIT) {
    const promptNode = document.createElement("li");
    promptNode.className = "list-item";
    promptNode.textContent = `Type to search ${state.templates.length} templates...`;
    ui.templateList.appendChild(promptNode);
    return;
  }

  const sortedTemplates = [...filteredTemplates].sort((left, right) => {
    const leftIsSeed = left.isSeed ? 1 : 0;
    const rightIsSeed = right.isSeed ? 1 : 0;
    if (leftIsSeed !== rightIsSeed) {
      return leftIsSeed - rightIsSeed;
    }
    return String(left.name || "").localeCompare(String(right.name || ""));
  });

  const MAX_RENDERED_RESULTS = 200;
  const truncatedCount = sortedTemplates.length - MAX_RENDERED_RESULTS;
  const templatesToRender = sortedTemplates.slice(0, MAX_RENDERED_RESULTS);

  for (const template of templatesToRender) {
    const node = document.createElement("li");
    node.className = "list-item cal-entry-row";

    const label = document.createElement("span");
    label.className = "cal-entry-label";
    const colorDot = document.createElement("span");
    colorDot.className = "entry-color-dot";
    colorDot.style.backgroundColor = getTemplateColor(template);
    const labelText = document.createElement("span");
    labelText.textContent = `${template.name} (${formatCal(template.calPerUnit)} kcal)`;
    label.appendChild(colorDot);
    label.appendChild(labelText);

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-edit-button";
    editButton.title = "Edit template";
    editButton.setAttribute("aria-label", "Edit template");
    editButton.textContent = "✎";
    editButton.addEventListener("click", () => openTemplateModal(template));

    node.appendChild(label);
    node.appendChild(editButton);

    ui.templateList.appendChild(node);
  }

  if (sortedTemplates.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.className = "list-item";
    emptyNode.textContent = "No templates match your search.";
    ui.templateList.appendChild(emptyNode);
  } else if (truncatedCount > 0) {
    const moreNode = document.createElement("li");
    moreNode.className = "list-item";
    moreNode.textContent = `+${truncatedCount} more match\u2014refine your search to see them.`;
    ui.templateList.appendChild(moreNode);
  }
}

async function saveCalEntryFromModal() {
  const typeName = ui.calTemplateText.value.trim();
  if (!typeName) {
    throw new Error("Type is required.");
  }

  const selectedDate = String(ui.calEntryDate.value || "").trim();
  if (!selectedDate) {
    throw new Error("Date is required.");
  }

  const selectedTime = normalizeTimeString(ui.calEntryTime.value);
  if (!selectedTime) {
    throw new Error("Time is required (HH:MM).");
  }

  const quantity = Number(ui.calQuantity.value);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be a positive integer.");
  }

  const caloriesPerItem = parseCaloryPerItemInput(ui.calItemCal.value);

  const roundedCalories = roundTo(caloriesPerItem, 3);
  const selectedColor = getSelectedColor(ui.calColorPickerRow);
  let selectedTemplate = findTemplateByName(typeName);
  if (!selectedTemplate) {
    const createdId = await addRecord(STORE_TEMPLATES, {
      name: typeName,
      calPerUnit: roundedCalories,
      color: selectedColor,
    });
    selectedTemplate = {
      id: createdId,
      name: typeName,
      calPerUnit: roundedCalories,
      color: selectedColor,
    };
  }

  const editingEntryId = Number(ui.calEntryId.value);
  if (editingEntryId) {
    const existingEntry = await getRecord(STORE_CAL_ENTRIES, editingEntryId);
    if (!existingEntry) {
      throw new Error("Entry not found.");
    }

    await updateRecord(STORE_CAL_ENTRIES, {
      ...existingEntry,
      id: editingEntryId,
      date: selectedDate,
      templateId: selectedTemplate.id,
      quantity,
      createdAt: selectedTime,
      calPerItem: roundedCalories,
      color: selectedColor,
      customName: typeName,
    });
    return true;
  }

  await addRecord(STORE_CAL_ENTRIES, {
    date: selectedDate,
    templateId: selectedTemplate.id,
    quantity,
    customName: typeName,
    createdAt: selectedTime,
    calPerItem: roundedCalories,
    color: selectedColor,
  });

  return true;
}

function openCalEntryModalForCreate(prefill = null) {
  ui.calEntryForm.reset();
  ui.calEntryId.value = "";
  ui.calEntrySubmitBtn.textContent = "Add";
  resetDeleteButton(ui.calEntryDeleteBtn);
  state.calColorManuallySet = false;
  const nextDate = prefill?.date || state.selectedDate || todayString();
  const nextTime = normalizeTimeString(prefill?.time) || currentTimeString();
  const nextTypeName = String(prefill?.typeName || "");
  const nextQuantity = Number.isInteger(prefill?.quantity) && prefill.quantity > 0 ? prefill.quantity : 1;
  ui.calEntryDate.value = nextDate;
  ui.calEntryTime.value = nextTime;
  ui.calTemplateText.value = nextTypeName;
  ui.calQuantity.value = String(nextQuantity);
  ui.calItemCal.value = Number.isFinite(prefill?.calPerItem) ? String(prefill.calPerItem) : "";
  const prefillType = nextTypeName ? findTemplateByName(nextTypeName) : null;
  const prefillColor = prefill && prefill.color ? String(prefill.color) : "";
  if (TEMPLATE_COLOR_PALETTE.includes(prefillColor)) {
    state.calColorManuallySet = true;
    setSelectedColor(ui.calColorPickerRow, prefillColor);
  } else {
    setSelectedColor(ui.calColorPickerRow, prefillType ? getTemplateColor(prefillType) : DEFAULT_TEMPLATE_COLOR);
  }
  void syncCalModalTypeFields({ autoSuggestQuantity: true, preserveManualCalories: true });
  refreshCalModalComputedFields();
  ui.calEntryModal.classList.remove("hidden");
  updateBodyModalState();
  ui.calTemplateText.focus();
}

function openCalEntryModalForEdit(entry) {
  const template = state.templates.find((candidate) => candidate.id === entry.templateId);
  ui.calEntryId.value = String(entry.id);
  ui.calTemplateText.value = entry.customName || (template ? template.name : "");
  ui.calQuantity.value = String(entry.quantity);
  ui.calEntryDate.value = entry.date || state.selectedDate || todayString();
  ui.calEntryTime.value = normalizeTimeString(entry.createdAt) || currentTimeString();
  ui.calItemCal.value = String(getEntryCalPerItem(entry, template));
  ui.calEntrySubmitBtn.textContent = "Save";
  resetDeleteButton(ui.calEntryDeleteBtn);
  state.calColorManuallySet = true;
  setSelectedColor(ui.calColorPickerRow, getEntryColor(entry, template));
  refreshCalModalComputedFields();
  ui.calEntryModal.classList.remove("hidden");
  updateBodyModalState();
  ui.calTemplateText.focus();
}

function closeCalEntryModal() {
  ui.calEntryForm.reset();
  ui.calEntryId.value = "";
  ui.calItemCal.value = "";
  ui.calTotalCalories.textContent = "--";
  ui.calEntrySubmitBtn.disabled = false;
  resetDeleteButton(ui.calEntryDeleteBtn);
  ui.calEntryModal.classList.add("hidden");
  updateBodyModalState();
}

function openTemplateModal(template) {
  ui.templateEditForm.reset();
  ui.templateEditId.value = String(template.id);
  ui.templateEditName.value = template.name;
  ui.templateEditCal.value = String(template.calPerUnit);
  setSelectedColor(ui.templateEditColorPickerRow, getTemplateColor(template));
  resetDeleteButton(ui.templateEditDeleteBtn);
  ui.templateModal.classList.remove("hidden");
  updateBodyModalState();
  ui.templateEditName.focus();
}

function closeTemplateModal() {
  ui.templateEditForm.reset();
  ui.templateEditId.value = "";
  resetDeleteButton(ui.templateEditDeleteBtn);
  ui.templateModal.classList.add("hidden");
  updateBodyModalState();
}

function openProgressEditModal(record) {
  ui.progressEditForm.reset();
  ui.progressEditOriginalDate.value = record.date;
  ui.progressEditDate.value = record.date;
  ui.progressEditDateDisplay.textContent = formatProgressDate(record.date);
  ui.progressEditWeight.value = String(record.weightKg);
  resetDeleteButton(ui.progressEditDeleteBtn);
  ui.progressEditModal.classList.remove("hidden");
  updateBodyModalState();
  ui.progressEditWeight.focus();
}

function closeProgressEditModal() {
  ui.progressEditForm.reset();
  ui.progressEditOriginalDate.value = "";
  resetDeleteButton(ui.progressEditDeleteBtn);
  ui.progressEditModal.classList.add("hidden");
  updateBodyModalState();
}

function updateBodyModalState() {
  const hasVisibleModal =
    !ui.calEntryModal.classList.contains("hidden") ||
    !ui.templateModal.classList.contains("hidden") ||
    !ui.progressEditModal.classList.contains("hidden");
  document.body.classList.toggle("modal-open", hasVisibleModal);
}

async function handleDoubleTapDelete(button, onConfirmedDelete) {
  if (button.dataset.armedDelete === "true") {
    resetDeleteButton(button);
    await onConfirmedDelete();
    return;
  }

  button.dataset.armedDelete = "true";
  button.classList.add("armed");
  if (button._deleteArmTimer) {
    clearTimeout(button._deleteArmTimer);
  }
  button._deleteArmTimer = setTimeout(() => {
    resetDeleteButton(button);
  }, 2200);
}

function resetDeleteButton(button) {
  button.dataset.armedDelete = "false";
  button.classList.remove("armed");
  if (button._deleteArmTimer) {
    clearTimeout(button._deleteArmTimer);
    button._deleteArmTimer = null;
  }
}

function findTemplateByName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return state.templates.find((template) => template.name.trim().toLowerCase() === normalized) || null;
}

function getTemplateColor(template) {
  const color = template && template.color ? String(template.color) : "";
  return TEMPLATE_COLOR_PALETTE.includes(color) ? color : DEFAULT_TEMPLATE_COLOR;
}

function getEntryCalPerItem(entry, template) {
  const override = Number(entry?.calPerItem);
  if (Number.isFinite(override)) {
    return override;
  }
  return Number(template?.calPerUnit) || 0;
}

function getEntryColor(entry, template) {
  const override = entry && entry.color ? String(entry.color) : "";
  if (TEMPLATE_COLOR_PALETTE.includes(override)) {
    return override;
  }
  return getTemplateColor(template);
}

function buildColorSwatches(rowElement) {
  rowElement.innerHTML = "";
  TEMPLATE_COLOR_PALETTE.forEach((color) => {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.backgroundColor = color;
    swatch.dataset.color = color;
    swatch.setAttribute("aria-label", `Select color ${color}`);
    swatch.addEventListener("click", () => {
      if (rowElement === ui.calColorPickerRow) {
        state.calColorManuallySet = true;
      }
      setSelectedColor(rowElement, color);
    });
    rowElement.appendChild(swatch);
  });
}

function setSelectedColor(rowElement, color) {
  const safeColor = TEMPLATE_COLOR_PALETTE.includes(color) ? color : DEFAULT_TEMPLATE_COLOR;
  rowElement.querySelectorAll(".color-swatch").forEach((swatch) => {
    swatch.classList.toggle("selected", swatch.dataset.color === safeColor);
  });
}

function getSelectedColor(rowElement) {
  const selected = rowElement.querySelector(".color-swatch.selected");
  return selected ? selected.dataset.color : DEFAULT_TEMPLATE_COLOR;
}

async function populateSuggestedQuantityForTypeName(typeName) {
  const template = findTemplateByName(typeName);
  if (!template) {
    return;
  }

  const suggested = await getLastQuantityForTemplate(template.id);
  ui.calQuantity.value = String(suggested);
}

async function syncCalModalTypeFields(options = {}) {
  const { autoSuggestQuantity = false, preserveManualCalories = false } = options;
  const enteredName = ui.calTemplateText.value.trim();
  const knownType = findTemplateByName(enteredName);

  if (knownType) {
    if (!preserveManualCalories) {
      ui.calItemCal.value = String(knownType.calPerUnit);
    }

    if (!state.calColorManuallySet) {
      setSelectedColor(ui.calColorPickerRow, getTemplateColor(knownType));
    }

    if (autoSuggestQuantity && !ui.calEntryId.value) {
      const suggested = await getLastQuantityForTemplate(knownType.id);
      const quantityValue = Number(ui.calQuantity.value);
      if (!Number.isInteger(quantityValue) || quantityValue < 1) {
        ui.calQuantity.value = String(suggested);
      }
    }
  } else if (!preserveManualCalories) {
    ui.calItemCal.value = "";
  }

  refreshCalModalComputedFields();
}

function refreshCalModalComputedFields() {
  const typeName = String(ui.calTemplateText.value || "").trim();
  const quantity = Number(ui.calQuantity.value);
  const caloriesRaw = String(ui.calItemCal.value || "").trim();
  const caloriesPerItem = Number(caloriesRaw);
  const selectedDate = String(ui.calEntryDate.value || "").trim();
  const selectedTime = normalizeTimeString(ui.calEntryTime.value);

  const hasValidQuantity = Number.isInteger(quantity) && quantity > 0;
  const hasValidCalories = caloriesRaw.length > 0 && Number.isFinite(caloriesPerItem);

  if (hasValidQuantity && hasValidCalories) {
    ui.calTotalCalories.textContent = formatCal(caloriesPerItem * quantity);
  } else {
    ui.calTotalCalories.textContent = "--";
  }

  const canSubmit =
    typeName.length > 0 &&
    hasValidQuantity &&
    hasValidCalories &&
    selectedDate.length > 0 &&
    selectedTime.length > 0;
  ui.calEntrySubmitBtn.disabled = !canSubmit;
}

function toggleInputSign(inputElement) {
  const raw = String(inputElement.value || "").trim();
  if (!raw) {
    inputElement.value = "-";
    inputElement.focus();
    return;
  }

  if (raw.startsWith("-")) {
    inputElement.value = raw.slice(1);
  } else if (raw.startsWith("+")) {
    inputElement.value = `-${raw.slice(1)}`;
  } else {
    inputElement.value = `-${raw}`;
  }
  inputElement.focus();
}

function parseCaloryPerItemInput(rawValue) {
  const valueText = String(rawValue || "").trim();
  if (!valueText) {
    throw new Error("Calory per item is required.");
  }

  const value = Number(valueText);
  if (!Number.isFinite(value)) {
    throw new Error("Calory per item must be numeric.");
  }

  return value;
}

async function getLastQuantityForTemplate(templateId) {
  const entries = await listAll(STORE_CAL_ENTRIES);
  const matched = entries
    .filter((entry) => entry.templateId === templateId && Number.isInteger(entry.quantity) && entry.quantity > 0)
    .sort((left, right) => right.id - left.id);

  if (matched.length === 0) {
    return 1;
  }

  return matched[0].quantity;
}

async function createTemplate(nameInput, calInput) {
  const name = String(nameInput || "").trim();
  const calories = Number(calInput);

  if (!name) {
    throw new Error("Item name is required.");
  }

  if (!Number.isFinite(calories)) {
    throw new Error("Calories must be numeric.");
  }

  return addRecord(STORE_TEMPLATES, {
    name,
    calPerUnit: roundTo(calories, 3),
    color: DEFAULT_TEMPLATE_COLOR,
  });
}

function makeListItem(mainText, metaText) {
  const fragment = ui.listTemplate.content.cloneNode(true);
  const node = fragment.querySelector(".list-item");
  node.querySelector(".item-main").textContent = mainText;
  node.querySelector(".item-meta").textContent = metaText;
  return node;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      if (!database.objectStoreNames.contains(STORE_TEMPLATES)) {
        database.createObjectStore(STORE_TEMPLATES, {
          keyPath: "id",
          autoIncrement: true,
        });
      }

      if (!database.objectStoreNames.contains(STORE_CAL_ENTRIES)) {
        const calStore = database.createObjectStore(STORE_CAL_ENTRIES, {
          keyPath: "id",
          autoIncrement: true,
        });
        calStore.createIndex("date", "date", { unique: false });
      }

      if (!database.objectStoreNames.contains(STORE_WEIGHT_ENTRIES)) {
        database.createObjectStore(STORE_WEIGHT_ENTRIES, {
          keyPath: "date",
        });
      }

      if (!database.objectStoreNames.contains(STORE_SETTINGS)) {
        database.createObjectStore(STORE_SETTINGS, {
          keyPath: "key",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed."));
  });
}

async function ensureDefaultSettings() {
  await ensureSettingDefault(SETTING_DAILY_CALORIE_TARGET, DEFAULT_DAILY_CALORIE_TARGET);
  await ensureSettingDefault(SETTING_WEIGHT_TARGET, DEFAULT_WEIGHT_TARGET);
}

async function ensureSettingDefault(key, defaultValue) {
  const existing = await getRecord(STORE_SETTINGS, key);
  if (existing && Number.isInteger(existing.value)) {
    return;
  }
  await saveSettingNumber(key, defaultValue);
}

async function saveSettingNumber(key, value) {
  await updateRecord(STORE_SETTINGS, {
    key,
    value,
  });
}

async function loadTargetsIntoForm() {
  const dailyTarget = await readSettingNumber(SETTING_DAILY_CALORIE_TARGET, DEFAULT_DAILY_CALORIE_TARGET);
  const weightTarget = await readSettingNumber(SETTING_WEIGHT_TARGET, DEFAULT_WEIGHT_TARGET);
  ui.dailyCalorieTarget.value = String(dailyTarget);
  ui.weightTarget.value = String(weightTarget);
}

async function readSettingNumber(key, fallback) {
  const record = await getRecord(STORE_SETTINGS, key);
  if (!record || !Number.isInteger(record.value)) {
    return fallback;
  }
  return record.value;
}

function parseIntegerTarget(rawValue, label) {
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

async function autoSaveTargetField({ input, key, fallback, label, onSaved }) {
  const rawValue = String(input.value || "").trim();
  if (!rawValue) {
    return;
  }

  let parsed;
  try {
    parsed = parseIntegerTarget(rawValue, label);
  } catch (_error) {
    return;
  }

  await saveSettingNumber(key, parsed);
  input.value = String(parsed);
  await onSaved();
}

async function normalizeTargetFieldDisplay({ input, key, fallback, label, onSaved }) {
  const rawValue = String(input.value || "").trim();
  if (!rawValue) {
    const stored = await readSettingNumber(key, fallback);
    input.value = String(stored);
    return;
  }

  try {
    const parsed = parseIntegerTarget(rawValue, label);
    await saveSettingNumber(key, parsed);
    input.value = String(parsed);
    await onSaved();
  } catch (error) {
    const stored = await readSettingNumber(key, fallback);
    input.value = String(stored);
    alert(error.message);
  }
}

async function saveAllTargetsFromForm() {
  try {
    const dailyTarget = parseIntegerTarget(ui.dailyCalorieTarget.value, "Daily calory target");
    const weightTarget = parseIntegerTarget(ui.weightTarget.value, "Weight target");

    await saveSettingNumber(SETTING_DAILY_CALORIE_TARGET, dailyTarget);
    await saveSettingNumber(SETTING_WEIGHT_TARGET, weightTarget);

    ui.dailyCalorieTarget.value = String(dailyTarget);
    ui.weightTarget.value = String(weightTarget);
    await refreshCalView();
    await refreshWeightView();
  } catch (error) {
    alert(error.message);
  }
}

function transaction(storeName, mode) {
  return state.db.transaction(storeName, mode).objectStore(storeName);
}

function addRecord(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = transaction(storeName, "readwrite").add(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Add failed."));
  });
}

function bulkAddRecords(storeName, values) {
  // Inserting thousands of seed templates one-by-one (each its own
  // transaction) is slow; a single shared transaction for the whole batch
  // is dramatically faster.
  return new Promise((resolve, reject) => {
    if (values.length === 0) {
      resolve();
      return;
    }
    const store = transaction(storeName, "readwrite");
    let pending = values.length;
    let settled = false;
    for (const value of values) {
      const request = store.add(value);
      request.onsuccess = () => {
        pending -= 1;
        if (pending === 0 && !settled) {
          settled = true;
          resolve();
        }
      };
      request.onerror = () => {
        if (!settled) {
          settled = true;
          reject(request.error || new Error("Bulk add failed."));
        }
      };
    }
  });
}

function updateRecord(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = transaction(storeName, "readwrite").put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Update failed."));
  });
}

function deleteRecord(storeName, key) {
  return new Promise((resolve, reject) => {
    const request = transaction(storeName, "readwrite").delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Delete failed."));
  });
}

function getRecord(storeName, key) {
  return new Promise((resolve, reject) => {
    const request = transaction(storeName, "readonly").get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("Read failed."));
  });
}

function listAll(storeName) {
  return new Promise((resolve, reject) => {
    const request = transaction(storeName, "readonly").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("List failed."));
  });
}

function clearStore(storeName) {
  return new Promise((resolve, reject) => {
    const request = transaction(storeName, "readwrite").clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("Clear failed."));
  });
}

async function listTemplates() {
  const items = await listAll(STORE_TEMPLATES);
  return items.sort((left, right) => left.name.localeCompare(right.name));
}

function listCalEntriesByDate(date) {
  return new Promise((resolve, reject) => {
    const store = transaction(STORE_CAL_ENTRIES, "readonly");
    const index = store.index("date");
    const request = index.getAll(date);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("Cal entry query failed."));
  });
}

async function countCalEntriesForTemplate(templateId) {
  const entries = await listAll(STORE_CAL_ENTRIES);
  return entries.filter((entry) => entry.templateId === templateId).length;
}

async function ensureSeedData() {
  const existingItems = await listAll(STORE_TEMPLATES);
  const existingNames = new Set(existingItems.map((item) => String(item.name || "").trim().toLowerCase()));

  const fallbackSeeds = [
    { name: "1g Banana", calPerUnit: 0.89 },
    { name: "1g Yogurt, plain", calPerUnit: 0.61 },
    { name: "1 egg", calPerUnit: 75 },
  ];

  const jsonSeed = Array.isArray(window.FOOD_TYPE_SEED) ? window.FOOD_TYPE_SEED : [];
  const seeds = jsonSeed.length > 0 ? jsonSeed : fallbackSeeds;

  const recordsToAdd = [];
  for (const seed of seeds) {
    const name = String(seed?.name || "").trim();
    const calories = Number(seed?.calPerUnit);
    if (!name || !Number.isFinite(calories)) {
      continue;
    }

    const normalized = name.toLowerCase();
    if (existingNames.has(normalized)) {
      continue;
    }

    recordsToAdd.push({
      name,
      calPerUnit: roundTo(calories, 3),
      isSeed: true,
      category: typeof seed?.category === "string" ? seed.category : undefined,
    });
    existingNames.add(normalized);
  }

  if (recordsToAdd.length > 0) {
    await bulkAddRecords(STORE_TEMPLATES, recordsToAdd);
  }
}

async function migrateFlagExistingSeedTemplates() {
  const fallbackSeeds = [
    { name: "1g Banana", calPerUnit: 0.89 },
    { name: "1g Yogurt, plain", calPerUnit: 0.61 },
    { name: "1 egg", calPerUnit: 75 },
  ];
  const jsonSeed = Array.isArray(window.FOOD_TYPE_SEED) ? window.FOOD_TYPE_SEED : [];
  const seeds = jsonSeed.length > 0 ? jsonSeed : fallbackSeeds;
  const seedNames = new Set(seeds.map((seed) => String(seed?.name || "").trim().toLowerCase()));

  const existingItems = await listAll(STORE_TEMPLATES);
  for (const item of existingItems) {
    if (item.isSeed) {
      continue;
    }
    const normalized = String(item.name || "").trim().toLowerCase();
    if (!seedNames.has(normalized)) {
      continue;
    }
    await updateRecord(STORE_TEMPLATES, {
      ...item,
      isSeed: true,
    });
  }
}

async function pruneStaleSeedTemplates() {
  // Older versions of the seed generator produced truncated/incorrect names
  // (e.g. "1g Egg", "1g Eggs" from a buggy first-comma-segment cut). Those
  // names no longer exist in the current seed data but were already written
  // to IndexedDB by ensureSeedData on a prior load, and ensureSeedData only
  // adds missing names — it never removes stale ones. Clean those up here:
  // delete unused stale seed templates outright, or demote in-use ones to
  // custom (isSeed: false) so the user's existing calorie entries keep working.
  const fallbackSeeds = [
    { name: "1g Banana", calPerUnit: 0.89 },
    { name: "1g Yogurt, plain", calPerUnit: 0.61 },
    { name: "1 egg", calPerUnit: 75 },
  ];
  const jsonSeed = Array.isArray(window.FOOD_TYPE_SEED) ? window.FOOD_TYPE_SEED : [];
  const seeds = jsonSeed.length > 0 ? jsonSeed : fallbackSeeds;
  const currentSeedNames = new Set(seeds.map((seed) => String(seed?.name || "").trim().toLowerCase()));

  const existingItems = await listAll(STORE_TEMPLATES);
  for (const item of existingItems) {
    if (!item.isSeed) {
      continue;
    }
    const normalized = String(item.name || "").trim().toLowerCase();
    if (currentSeedNames.has(normalized)) {
      continue;
    }

    const usages = await countCalEntriesForTemplate(item.id);
    if (usages > 0) {
      await updateRecord(STORE_TEMPLATES, {
        ...item,
        isSeed: false,
      });
    } else {
      await deleteRecord(STORE_TEMPLATES, item.id);
    }
  }
}

async function migrateLegacy100gTemplates() {
  const templates = await listAll(STORE_TEMPLATES);
  if (templates.length === 0) {
    return;
  }

  const normalizedIdByName = new Map(
    templates.map((template) => [String(template.name || "").trim().toLowerCase(), template.id])
  );

  const legacyTypes = templates.filter((template) => String(template.name || "").trim().toLowerCase().startsWith("100g "));
  if (legacyTypes.length === 0) {
    return;
  }

  const allEntries = await listAll(STORE_CAL_ENTRIES);

  for (const legacyType of legacyTypes) {
    const legacyName = String(legacyType.name || "").trim();
    const suffix = legacyName.slice(5).trim();
    if (!suffix) {
      continue;
    }

    const nextName = `1g ${suffix}`;
    const normalizedNextName = nextName.toLowerCase();

    let targetTypeId = normalizedIdByName.get(normalizedNextName);
    if (!targetTypeId) {
      targetTypeId = await addRecord(STORE_TEMPLATES, {
        name: nextName,
        calPerUnit: roundTo(Number(legacyType.calPerUnit) / 100, 3),
      });
      normalizedIdByName.set(normalizedNextName, targetTypeId);
    }

    const impactedEntries = allEntries.filter((entry) => entry.templateId === legacyType.id);
    for (const entry of impactedEntries) {
      await updateRecord(STORE_CAL_ENTRIES, {
        ...entry,
        templateId: targetTypeId,
        quantity: Number(entry.quantity) * 100,
      });
    }

    await deleteRecord(STORE_TEMPLATES, legacyType.id);
  }
}

async function simplifyAndPruneTemplates() {
  const templates = await listAll(STORE_TEMPLATES);
  if (templates.length === 0) {
    return;
  }

  const deletionNameSet = new Set(["1h run", "2h bike"]);
  const keepersByName = new Map();
  const targetBySourceId = new Map();
  const caloriesByKeeperId = new Map();
  const idsToDelete = new Set();
  const idsToRename = new Map();

  for (const template of templates.sort((left, right) => left.id - right.id)) {
    const rawName = String(template.name || "").trim();
    const normalizedRawName = normalizeNameKey(rawName);
    const calories = Number(template.calPerUnit);
    const isLegacyBadYogurt = normalizedRawName === "1g yogurt" && Math.abs(calories - 10) < 0.001;

    if (deletionNameSet.has(normalizedRawName) || isLegacyBadYogurt) {
      targetBySourceId.set(template.id, null);
      idsToDelete.add(template.id);
      continue;
    }

    const simplifiedName = simplifyTemplateName(rawName);
    const simplifiedKey = normalizeNameKey(simplifiedName);
    const existingKeeper = keepersByName.get(simplifiedKey);

    if (!existingKeeper) {
      keepersByName.set(simplifiedKey, template.id);
      targetBySourceId.set(template.id, template.id);
      caloriesByKeeperId.set(template.id, [Number.isFinite(calories) ? calories : 0]);
      if (simplifiedName !== rawName) {
        idsToRename.set(template.id, simplifiedName);
      }
      continue;
    }

    targetBySourceId.set(template.id, existingKeeper);
    idsToDelete.add(template.id);
    if (!caloriesByKeeperId.has(existingKeeper)) {
      caloriesByKeeperId.set(existingKeeper, []);
    }
    caloriesByKeeperId.get(existingKeeper).push(Number.isFinite(calories) ? calories : 0);
  }

  const allEntries = await listAll(STORE_CAL_ENTRIES);
  for (const entry of allEntries) {
    if (!targetBySourceId.has(entry.templateId)) {
      continue;
    }

    const targetId = targetBySourceId.get(entry.templateId);
    if (targetId === null) {
      await deleteRecord(STORE_CAL_ENTRIES, entry.id);
      continue;
    }

    if (targetId !== entry.templateId) {
      await updateRecord(STORE_CAL_ENTRIES, {
        ...entry,
        templateId: targetId,
      });
    }
  }

  for (const template of templates) {
    if (idsToDelete.has(template.id)) {
      continue;
    }

    const renamed = idsToRename.get(template.id) || String(template.name || "").trim();
    const cals = caloriesByKeeperId.get(template.id) || [Number(template.calPerUnit) || 0];
    const avgCalories = cals.length > 0 ? cals.reduce((sum, value) => sum + value, 0) / cals.length : Number(template.calPerUnit) || 0;

    await updateRecord(STORE_TEMPLATES, {
      ...template,
      name: renamed,
      calPerUnit: roundTo(avgCalories, 3),
    });
  }

  for (const typeId of idsToDelete) {
    await deleteRecord(STORE_TEMPLATES, typeId);
  }
}

function simplifyTemplateName(rawName) {
  const name = String(rawName || "").trim();
  const lower = name.toLowerCase();

  if (lower.startsWith("1g ")) {
    const base = simplifyFoodLabel(name.slice(3));
    return `1g ${base}`;
  }

  if (lower.startsWith("1 ")) {
    const base = simplifyFoodLabel(name.slice(2));
    return `1 ${base}`;
  }

  return simplifyFoodLabel(name);
}

function simplifyFoodLabel(label) {
  return String(label || "").replace(/\s+/g, " ").trim();
}

function normalizeNameKey(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function indexById(array) {
  return array.reduce((map, item) => {
    map[item.id] = item;
    return map;
  }, {});
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function formatCal(value) {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number(value.toFixed(3)).toString();
}

function todayString() {
  const now = new Date();
  const parts = TORONTO_DATE_FORMATTER.formatToParts(now);
  const year = getDateTimePart(parts, "year");
  const month = getDateTimePart(parts, "month");
  const day = getDateTimePart(parts, "day");
  return `${year}-${month}-${day}`;
}

function currentTimeString() {
  const now = new Date();
  const parts = TORONTO_TIME_FORMATTER.formatToParts(now);
  const hours = getDateTimePart(parts, "hour");
  const minutes = getDateTimePart(parts, "minute");
  return `${hours}:${minutes}`;
}

function getDateTimePart(parts, type) {
  const part = parts.find((candidate) => candidate.type === type);
  return part ? part.value : "00";
}

function dayOfWeekShort(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return dayNames[date.getDay()];
}

function dayOfWeekLong(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return dayNames[date.getDay()];
}

function formatProgressDate(dateString) {
  const day = dayOfWeekShort(dateString);
  if (!day) {
    return dateString;
  }
  return `${day} ${dateString}`;
}

function formatCalGroupHeader(dateString, todayDate, yesterdayDate) {
  const day = dayOfWeekLong(dateString);
  if (dateString === todayDate) {
    return day ? `${day} (Today)` : "Today";
  }
  if (dateString === yesterdayDate) {
    return day ? `${day} (Yesterday)` : "Yesterday";
  }
  return day ? `${day} (${dateString})` : dateString;
}

function normalizeTimeString(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const match = raw.match(/^(\d{2}):(\d{2})/);
  if (!match) {
    return "";
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return "";
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function offsetDateString(dateString, daysOffset) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateString;
  }
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(raw) {
  return String(raw)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
