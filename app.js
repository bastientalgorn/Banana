const DB_NAME = "bananaTrackerDB";
const DB_VERSION = 2;
const STORE_ITEM_TYPES = "itemTypes";
const STORE_CAL_ENTRIES = "calEntries";
const STORE_WEIGHT_ENTRIES = "weightEntries";
const STORE_SETTINGS = "settings";
const APP_TIME_ZONE = "America/Toronto";
const SETTING_DAILY_CALORIE_TARGET = "dailyCalorieTarget";
const SETTING_WEIGHT_TARGET = "weightTarget";
const DEFAULT_DAILY_CALORIE_TARGET = 2000;
const DEFAULT_WEIGHT_TARGET = 150;

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
  itemTypes: [],
  selectedDate: todayString(),
};

const ui = {
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
  calItemTypeText: document.getElementById("cal-item-type-text"),
  calItemTypeList: document.getElementById("cal-item-type-list"),
  calItemCal: document.getElementById("cal-item-cal"),
  calQuantity: document.getElementById("cal-quantity"),
  calTotalCalories: document.getElementById("cal-total-calories"),
  calEntryDate: document.getElementById("cal-entry-date"),
  calEntryTime: document.getElementById("cal-entry-time"),
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
  itemTypeForm: document.getElementById("item-type-form"),
  itemTypeName: document.getElementById("item-type-name"),
  itemTypeCal: document.getElementById("item-type-cal"),
  targetsForm: document.getElementById("targets-form"),
  dailyCalorieTarget: document.getElementById("daily-calorie-target"),
  weightTarget: document.getElementById("weight-target"),
  itemTypeSearch: document.getElementById("item-type-search"),
  itemTypeList: document.getElementById("item-type-list"),
  itemTypeModal: document.getElementById("item-type-modal"),
  itemTypeModalBackdrop: document.getElementById("item-type-modal-backdrop"),
  itemTypeEditForm: document.getElementById("item-type-edit-form"),
  itemTypeEditId: document.getElementById("item-type-edit-id"),
  itemTypeEditName: document.getElementById("item-type-edit-name"),
  itemTypeEditCal: document.getElementById("item-type-edit-cal"),
  itemTypeCalPlusBtn: document.getElementById("item-type-cal-plus-btn"),
  itemTypeCalMinusBtn: document.getElementById("item-type-cal-minus-btn"),
  itemTypeEditCancelBtn: document.getElementById("item-type-edit-cancel-btn"),
  itemTypeEditDeleteBtn: document.getElementById("item-type-edit-delete-btn"),
  listTemplate: document.getElementById("simple-list-item-template"),
};

document.addEventListener("DOMContentLoaded", async () => {
  bindUiEvents();
  state.db = await openDatabase();
  await ensureDefaultSettings();
  await migrateLegacy100gItemTypes();
  await ensureSeedData();
  await simplifyAndPruneItemTypes();
  state.itemTypes = await listItemTypes();
  ui.weightTodayDate.value = state.selectedDate;

  syncItemTypeSelects();
  await refreshCalView();
  await refreshWeightView();
  await refreshDataView();
  await loadTargetsIntoForm();
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

  ui.calItemTypeText.addEventListener("input", async () => {
    await syncCalModalTypeFields({ autoSuggestQuantity: true });
  });

  ui.calItemTypeText.addEventListener("change", async () => {
    await syncCalModalTypeFields({ autoSuggestQuantity: true });
  });

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
      await reloadItemTypesAndRefresh();
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

  ui.itemTypeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await createItemType(ui.itemTypeName.value, ui.itemTypeCal.value);
      ui.itemTypeForm.reset();
      await reloadItemTypesAndRefresh();
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

  ui.itemTypeSearch.addEventListener("input", async () => {
    await refreshDataView();
  });

  ui.itemTypeModalBackdrop.addEventListener("click", () => {
    closeItemTypeModal();
  });

  ui.itemTypeEditCancelBtn.addEventListener("click", () => {
    closeItemTypeModal();
  });

  ui.itemTypeEditForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const id = Number(ui.itemTypeEditId.value);
    const name = ui.itemTypeEditName.value.trim();
    const calPerUnit = Number(ui.itemTypeEditCal.value);

    if (!id) {
      alert("Item type not found.");
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

    await updateRecord(STORE_ITEM_TYPES, {
      id,
      name,
      calPerUnit: roundTo(calPerUnit, 3),
    });

    closeItemTypeModal();
    await reloadItemTypesAndRefresh();
  });

  ui.itemTypeEditDeleteBtn.addEventListener("click", async () => {
    await handleDoubleTapDelete(ui.itemTypeEditDeleteBtn, async () => {
      const id = Number(ui.itemTypeEditId.value);
      if (!id) {
        return;
      }

      const usages = await countCalEntriesForItemType(id);
      if (usages > 0) {
        alert("Cannot delete an item type used by calorie entries.");
        return;
      }

      await deleteRecord(STORE_ITEM_TYPES, id);
      closeItemTypeModal();
      await reloadItemTypesAndRefresh();
    });
  });

  ui.itemTypeCalPlusBtn.addEventListener("click", () => {
    const current = Number(ui.itemTypeEditCal.value || "0");
    const safeValue = Number.isFinite(current) ? current : 0;
    ui.itemTypeEditCal.value = String(roundTo(safeValue + 1, 3));
  });

  ui.itemTypeCalMinusBtn.addEventListener("click", () => {
    const current = Number(ui.itemTypeEditCal.value || "0");
    const safeValue = Number.isFinite(current) ? current : 0;
    ui.itemTypeEditCal.value = String(roundTo(safeValue - 1, 3));
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

async function reloadItemTypesAndRefresh() {
  state.itemTypes = await listItemTypes();
  syncItemTypeSelects();
  await refreshCalView();
  await refreshWeightView();
  await refreshDataView();
}

function syncItemTypeSelects() {
  const datalistOptions = state.itemTypes
    .map((itemType) => `<option value="${escapeHtml(itemType.name)}"></option>`)
    .join("");

  ui.calItemTypeList.innerHTML = datalistOptions;
}

async function refreshCalView() {
  const entries = await listAll(STORE_CAL_ENTRIES);
  const itemTypeMap = indexById(state.itemTypes);
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
    const itemType = itemTypeMap[entry.itemTypeId];
    if (!itemType) {
      continue;
    }

    const lineTotal = itemType.calPerUnit * entry.quantity;
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

    const displayName = entry.customName || itemType.name;
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
    nameNode.textContent = displayName;

    const totalNode = document.createElement("span");
    totalNode.className = "cal-col cal-col-total";
    totalNode.textContent = `${Math.round(lineTotal)} kcal`;

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
        typeName: itemType.name,
        quantity: entry.quantity,
        date: todayString(),
        time: currentTimeString(),
        calPerItem: itemType.calPerUnit,
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
  const padding = 40;

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
    context.font = "16px Segoe UI";
    context.fillText("No data yet", padding + 10, padding + 20);
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
    context.font = "14px Segoe UI";
    context.fillText(`Target ${targetWeight}`, padding + 8, Math.max(padding + 14, targetY - 8));
    context.restore();
  }

  context.fillStyle = "#e6edf3";
  context.font = "14px Segoe UI";
  context.fillText(`${minWeight.toFixed(1)}`, 8, height - padding);
  context.fillText(`${maxWeight.toFixed(1)}`, 8, padding + 6);

  const first = records[0];
  const last = records[records.length - 1];
  context.fillText(first.date, padding, height - 10);
  const lastLabelWidth = context.measureText(last.date).width;
  context.fillText(last.date, width - padding - lastLabelWidth, height - 10);
}

async function refreshDataView() {
  ui.itemTypeList.innerHTML = "";
  const query = String(ui.itemTypeSearch.value || "").trim().toLowerCase();
  const filteredItemTypes = query
    ? state.itemTypes.filter((itemType) => String(itemType.name || "").toLowerCase().includes(query))
    : state.itemTypes;

  for (const itemType of filteredItemTypes) {
    const node = document.createElement("li");
    node.className = "list-item cal-entry-row";

    const label = document.createElement("span");
    label.className = "cal-entry-label";
    label.textContent = `${itemType.name} (${formatCal(itemType.calPerUnit)} kcal)`;

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "icon-edit-button";
    editButton.title = "Edit item type";
    editButton.setAttribute("aria-label", "Edit item type");
    editButton.textContent = "✎";
    editButton.addEventListener("click", () => openItemTypeModal(itemType));

    node.appendChild(label);
    node.appendChild(editButton);

    ui.itemTypeList.appendChild(node);
  }

  if (filteredItemTypes.length === 0) {
    const emptyNode = document.createElement("li");
    emptyNode.className = "list-item";
    emptyNode.textContent = "No item types match your search.";
    ui.itemTypeList.appendChild(emptyNode);
  }
}

async function saveCalEntryFromModal() {
  const typeName = ui.calItemTypeText.value.trim();
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
  let selectedItemType = findItemTypeByName(typeName);
  if (!selectedItemType) {
    const createdId = await addRecord(STORE_ITEM_TYPES, {
      name: typeName,
      calPerUnit: roundedCalories,
    });
    selectedItemType = {
      id: createdId,
      name: typeName,
      calPerUnit: roundedCalories,
    };
  } else if (roundTo(Number(selectedItemType.calPerUnit), 3) !== roundedCalories) {
    await updateRecord(STORE_ITEM_TYPES, {
      ...selectedItemType,
      calPerUnit: roundedCalories,
    });
    selectedItemType = {
      ...selectedItemType,
      calPerUnit: roundedCalories,
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
      itemTypeId: selectedItemType.id,
      quantity,
      createdAt: selectedTime,
    });
    return true;
  }

  await addRecord(STORE_CAL_ENTRIES, {
    date: selectedDate,
    itemTypeId: selectedItemType.id,
    quantity,
    customName: "",
    createdAt: selectedTime,
  });

  return true;
}

function openCalEntryModalForCreate(prefill = null) {
  ui.calEntryForm.reset();
  ui.calEntryId.value = "";
  ui.calEntrySubmitBtn.textContent = "Add";
  resetDeleteButton(ui.calEntryDeleteBtn);
  const nextDate = prefill?.date || state.selectedDate || todayString();
  const nextTime = normalizeTimeString(prefill?.time) || currentTimeString();
  const nextTypeName = String(prefill?.typeName || "");
  const nextQuantity = Number.isInteger(prefill?.quantity) && prefill.quantity > 0 ? prefill.quantity : 1;
  ui.calEntryDate.value = nextDate;
  ui.calEntryTime.value = nextTime;
  ui.calItemTypeText.value = nextTypeName;
  ui.calQuantity.value = String(nextQuantity);
  ui.calItemCal.value = Number.isFinite(prefill?.calPerItem) ? String(prefill.calPerItem) : "";
  void syncCalModalTypeFields({ autoSuggestQuantity: true, preserveManualCalories: true });
  refreshCalModalComputedFields();
  ui.calEntryModal.classList.remove("hidden");
  updateBodyModalState();
  ui.calItemTypeText.focus();
}

function openCalEntryModalForEdit(entry) {
  const itemType = state.itemTypes.find((candidate) => candidate.id === entry.itemTypeId);
  ui.calEntryId.value = String(entry.id);
  ui.calItemTypeText.value = itemType ? itemType.name : "";
  ui.calQuantity.value = String(entry.quantity);
  ui.calEntryDate.value = entry.date || state.selectedDate || todayString();
  ui.calEntryTime.value = normalizeTimeString(entry.createdAt) || currentTimeString();
  ui.calItemCal.value = itemType ? String(itemType.calPerUnit) : "";
  ui.calEntrySubmitBtn.textContent = "Save";
  resetDeleteButton(ui.calEntryDeleteBtn);
  refreshCalModalComputedFields();
  ui.calEntryModal.classList.remove("hidden");
  updateBodyModalState();
  ui.calItemTypeText.focus();
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

function openItemTypeModal(itemType) {
  ui.itemTypeEditForm.reset();
  ui.itemTypeEditId.value = String(itemType.id);
  ui.itemTypeEditName.value = itemType.name;
  ui.itemTypeEditCal.value = String(itemType.calPerUnit);
  resetDeleteButton(ui.itemTypeEditDeleteBtn);
  ui.itemTypeModal.classList.remove("hidden");
  updateBodyModalState();
  ui.itemTypeEditName.focus();
}

function closeItemTypeModal() {
  ui.itemTypeEditForm.reset();
  ui.itemTypeEditId.value = "";
  resetDeleteButton(ui.itemTypeEditDeleteBtn);
  ui.itemTypeModal.classList.add("hidden");
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
    !ui.itemTypeModal.classList.contains("hidden") ||
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

function findItemTypeByName(name) {
  const normalized = String(name || "").trim().toLowerCase();
  return state.itemTypes.find((itemType) => itemType.name.trim().toLowerCase() === normalized) || null;
}

async function populateSuggestedQuantityForTypeName(typeName) {
  const itemType = findItemTypeByName(typeName);
  if (!itemType) {
    return;
  }

  const suggested = await getLastQuantityForItemType(itemType.id);
  ui.calQuantity.value = String(suggested);
}

async function syncCalModalTypeFields(options = {}) {
  const { autoSuggestQuantity = false, preserveManualCalories = false } = options;
  const enteredName = ui.calItemTypeText.value.trim();
  const knownType = findItemTypeByName(enteredName);

  if (knownType) {
    if (!preserveManualCalories) {
      ui.calItemCal.value = String(knownType.calPerUnit);
    }

    if (autoSuggestQuantity && !ui.calEntryId.value) {
      const suggested = await getLastQuantityForItemType(knownType.id);
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
  const typeName = String(ui.calItemTypeText.value || "").trim();
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

async function getLastQuantityForItemType(itemTypeId) {
  const entries = await listAll(STORE_CAL_ENTRIES);
  const matched = entries
    .filter((entry) => entry.itemTypeId === itemTypeId && Number.isInteger(entry.quantity) && entry.quantity > 0)
    .sort((left, right) => right.id - left.id);

  if (matched.length === 0) {
    return 1;
  }

  return matched[0].quantity;
}

async function createItemType(nameInput, calInput) {
  const name = String(nameInput || "").trim();
  const calories = Number(calInput);

  if (!name) {
    throw new Error("Item name is required.");
  }

  if (!Number.isFinite(calories)) {
    throw new Error("Calories must be numeric.");
  }

  return addRecord(STORE_ITEM_TYPES, {
    name,
    calPerUnit: roundTo(calories, 3),
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

      if (!database.objectStoreNames.contains(STORE_ITEM_TYPES)) {
        database.createObjectStore(STORE_ITEM_TYPES, {
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

async function listItemTypes() {
  const items = await listAll(STORE_ITEM_TYPES);
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

async function countCalEntriesForItemType(itemTypeId) {
  const entries = await listAll(STORE_CAL_ENTRIES);
  return entries.filter((entry) => entry.itemTypeId === itemTypeId).length;
}

async function ensureSeedData() {
  const existingItems = await listAll(STORE_ITEM_TYPES);
  const existingNames = new Set(existingItems.map((item) => String(item.name || "").trim().toLowerCase()));

  const fallbackSeeds = [
    { name: "1g Banana", calPerUnit: 0.89 },
    { name: "1g Yogurt, plain", calPerUnit: 0.61 },
    { name: "1 egg", calPerUnit: 75 },
  ];

  const jsonSeed = Array.isArray(window.FOOD_TYPE_SEED) ? window.FOOD_TYPE_SEED : [];
  const seeds = jsonSeed.length > 0 ? jsonSeed : fallbackSeeds;

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

    await addRecord(STORE_ITEM_TYPES, {
      name,
      calPerUnit: roundTo(calories, 3),
    });
    existingNames.add(normalized);
  }
}

async function migrateLegacy100gItemTypes() {
  const itemTypes = await listAll(STORE_ITEM_TYPES);
  if (itemTypes.length === 0) {
    return;
  }

  const normalizedIdByName = new Map(
    itemTypes.map((itemType) => [String(itemType.name || "").trim().toLowerCase(), itemType.id])
  );

  const legacyTypes = itemTypes.filter((itemType) => String(itemType.name || "").trim().toLowerCase().startsWith("100g "));
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
      targetTypeId = await addRecord(STORE_ITEM_TYPES, {
        name: nextName,
        calPerUnit: roundTo(Number(legacyType.calPerUnit) / 100, 3),
      });
      normalizedIdByName.set(normalizedNextName, targetTypeId);
    }

    const impactedEntries = allEntries.filter((entry) => entry.itemTypeId === legacyType.id);
    for (const entry of impactedEntries) {
      await updateRecord(STORE_CAL_ENTRIES, {
        ...entry,
        itemTypeId: targetTypeId,
        quantity: Number(entry.quantity) * 100,
      });
    }

    await deleteRecord(STORE_ITEM_TYPES, legacyType.id);
  }
}

async function simplifyAndPruneItemTypes() {
  const itemTypes = await listAll(STORE_ITEM_TYPES);
  if (itemTypes.length === 0) {
    return;
  }

  const deletionNameSet = new Set(["1h run", "2h bike"]);
  const keepersByName = new Map();
  const targetBySourceId = new Map();
  const caloriesByKeeperId = new Map();
  const idsToDelete = new Set();
  const idsToRename = new Map();

  for (const itemType of itemTypes.sort((left, right) => left.id - right.id)) {
    const rawName = String(itemType.name || "").trim();
    const normalizedRawName = normalizeNameKey(rawName);
    const calories = Number(itemType.calPerUnit);
    const isLegacyBadYogurt = normalizedRawName === "1g yogurt" && Math.abs(calories - 10) < 0.001;

    if (deletionNameSet.has(normalizedRawName) || isLegacyBadYogurt) {
      targetBySourceId.set(itemType.id, null);
      idsToDelete.add(itemType.id);
      continue;
    }

    const simplifiedName = simplifyItemTypeName(rawName);
    const simplifiedKey = normalizeNameKey(simplifiedName);
    const existingKeeper = keepersByName.get(simplifiedKey);

    if (!existingKeeper) {
      keepersByName.set(simplifiedKey, itemType.id);
      targetBySourceId.set(itemType.id, itemType.id);
      caloriesByKeeperId.set(itemType.id, [Number.isFinite(calories) ? calories : 0]);
      if (simplifiedName !== rawName) {
        idsToRename.set(itemType.id, simplifiedName);
      }
      continue;
    }

    targetBySourceId.set(itemType.id, existingKeeper);
    idsToDelete.add(itemType.id);
    if (!caloriesByKeeperId.has(existingKeeper)) {
      caloriesByKeeperId.set(existingKeeper, []);
    }
    caloriesByKeeperId.get(existingKeeper).push(Number.isFinite(calories) ? calories : 0);
  }

  const allEntries = await listAll(STORE_CAL_ENTRIES);
  for (const entry of allEntries) {
    if (!targetBySourceId.has(entry.itemTypeId)) {
      continue;
    }

    const targetId = targetBySourceId.get(entry.itemTypeId);
    if (targetId === null) {
      await deleteRecord(STORE_CAL_ENTRIES, entry.id);
      continue;
    }

    if (targetId !== entry.itemTypeId) {
      await updateRecord(STORE_CAL_ENTRIES, {
        ...entry,
        itemTypeId: targetId,
      });
    }
  }

  for (const itemType of itemTypes) {
    if (idsToDelete.has(itemType.id)) {
      continue;
    }

    const renamed = idsToRename.get(itemType.id) || String(itemType.name || "").trim();
    const cals = caloriesByKeeperId.get(itemType.id) || [Number(itemType.calPerUnit) || 0];
    const avgCalories = cals.length > 0 ? cals.reduce((sum, value) => sum + value, 0) / cals.length : Number(itemType.calPerUnit) || 0;

    await updateRecord(STORE_ITEM_TYPES, {
      ...itemType,
      name: renamed,
      calPerUnit: roundTo(avgCalories, 3),
    });
  }

  for (const typeId of idsToDelete) {
    await deleteRecord(STORE_ITEM_TYPES, typeId);
  }
}

function simplifyItemTypeName(rawName) {
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
  const firstChunk = String(label || "").split(",", 1)[0];
  return firstChunk.replace(/\s+/g, " ").trim();
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
