const STORAGE_KEYS = {
  invoices: "invoxa.invoices.v1",
  current: "invoxa.current.v1",
};

const taxRates = { US: 8, GB: 20, EU: 20, CA: 5, AU: 10, IN: 18, NONE: 0 };
const currencyNames = { USD: "US Dollar", EUR: "Euro", GBP: "British Pound", CAD: "Canadian Dollar", AUD: "Australian Dollar", INR: "Indian Rupee", JPY: "Japanese Yen" };
const itemContainer = document.querySelector("#line-items");
const toast = document.querySelector("#toast");
const fields = {
  number: document.querySelector("#invoice-number"),
  currency: document.querySelector("#currency"),
  issueDate: document.querySelector("#issue-date"),
  dueDate: document.querySelector("#due-date"),
  fromName: document.querySelector("#from-name"),
  fromEmail: document.querySelector("#from-email"),
  clientName: document.querySelector("#client-name"),
  clientEmail: document.querySelector("#client-email"),
  location: document.querySelector("#client-location"),
  taxRate: document.querySelector("#tax-rate"),
  notes: document.querySelector("#invoice-notes"),
};
let toastTimer;
let invoices = readStorage(STORAGE_KEYS.invoices, []);
let activeInvoiceId = null;
let rows = [];
let currentUser = null;
let currentComingSoonFeature = "clients";

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch (error) {
    console.warn(`Could not read ${key} from local storage.`, error);
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    showToast("Couldn't save. Check your device storage.");
    console.error(`Could not write ${key} to local storage.`, error);
    return false;
  }
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function formatMoney(value, currency = fields.currency.value) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(value) || 0);
  } catch {
    return `${currency} ${(Number(value) || 0).toFixed(2)}`;
  }
}

function dateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function initialsFor(user) {
  const nameParts = (user.name || user.email || "Invoxa").trim().split(/\s+/);
  return nameParts.slice(0, 2).map((part) => part[0]).join("").toLocaleUpperCase();
}

function renderAuthState() {
  const signedIn = Boolean(currentUser);
  document.querySelector("#auth-button").hidden = signedIn;
  document.querySelector("#sign-out-button").hidden = !signedIn;
  document.querySelector("#profile-name").textContent = currentUser?.name || "Not signed in";
  document.querySelector("#profile-email").textContent = currentUser?.email || "Invoices stay on this device";
  const initials = signedIn ? initialsFor(currentUser) : "IN";
  document.querySelector("#profile-avatar").textContent = initials;
  document.querySelector("#top-avatar").textContent = initials;
  if (currentUser && document.querySelector("#waitlist-email").value === "") {
    document.querySelector("#waitlist-email").value = currentUser.email;
  }
}

async function loadAuthState() {
  try {
    const response = await fetch("/api/auth/me");
    if (!response.ok) throw new Error(`Account check failed (${response.status}).`);
    const result = await response.json();
    currentUser = result.user || null;
    renderAuthState();
  } catch (error) {
    console.error("Could not load the signed-in account.", error);
    document.querySelector("#profile-email").textContent = "Sign-in status unavailable";
  }
}

function getData() {
  const items = rows.map((row) => ({
    description: row.querySelector(".item-description").value.trim(),
    quantity: Math.max(0, Number(row.querySelector(".item-quantity").value) || 0),
    rate: Math.max(0, Number(row.querySelector(".item-rate").value) || 0),
  })).filter((item) => item.description || item.rate);
  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.rate, 0);
  const taxRate = Math.max(0, Number(fields.taxRate.value) || 0);
  return {
    number: fields.number.value.trim(),
    currency: fields.currency.value,
    issueDate: fields.issueDate.value,
    dueDate: fields.dueDate.value,
    fromName: fields.fromName.value.trim(),
    fromEmail: fields.fromEmail.value.trim(),
    clientName: fields.clientName.value.trim(),
    clientEmail: fields.clientEmail.value.trim(),
    location: fields.location.value,
    taxRate,
    notes: fields.notes.value.trim(),
    items,
    subtotal,
    tax: subtotal * taxRate / 100,
    total: subtotal * (1 + taxRate / 100),
  };
}

function renderPreview() {
  const data = getData();
  document.querySelector("#preview-number").textContent = data.number || "INVOICE";
  document.querySelector("#preview-from-name").textContent = data.fromName || "Your business";
  document.querySelector("#preview-from-email").textContent = data.fromEmail || "Your email";
  document.querySelector("#preview-client-name").textContent = data.clientName || "Your client";
  document.querySelector("#preview-client-email").textContent = data.clientEmail || "Client email";
  document.querySelector("#preview-issue-date").textContent = formatDate(data.issueDate);
  document.querySelector("#preview-due-date").textContent = formatDate(data.dueDate);
  document.querySelector("#preview-subtotal").textContent = formatMoney(data.subtotal);
  document.querySelector("#preview-tax-label").textContent = `Tax (${data.taxRate}%)`;
  document.querySelector("#preview-tax").textContent = formatMoney(data.tax);
  document.querySelector("#preview-total").textContent = formatMoney(data.total);
  document.querySelector("#preview-footer-business").textContent = data.fromName || "Your business";
  document.querySelector("#preview-items").innerHTML = data.items.length
    ? data.items.map((item) => `<div class="paper-line"><span>${escapeHtml(item.description || "Item")} <small>× ${item.quantity}</small></span><span>${formatMoney(item.quantity * item.rate)}</span></div>`).join("")
    : '<div class="paper-line"><span>Your services will appear here</span><span>—</span></div>';
  const note = document.querySelector("#preview-note");
  note.hidden = !data.notes;
  note.textContent = data.notes;
  document.querySelector("#invoice-count").textContent = invoices.length;
  const active = invoices.find((invoice) => invoice.id === activeInvoiceId);
  document.querySelector("#version-count").textContent = active ? active.versions.length : 0;
}

function createItemRow(item = {}) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.innerHTML = `
    <input class="item-description" type="text" aria-label="Item description" placeholder="e.g. Brand identity design" value="${escapeHtml(item.description || "")}" />
    <input class="item-quantity" type="number" aria-label="Quantity" min="0" step="1" value="${item.quantity ?? 1}" />
    <input class="item-rate" type="number" aria-label="Rate" min="0" step="0.01" value="${item.rate ?? ""}" placeholder="0.00" />
    <span class="item-amount">${formatMoney((Number(item.quantity) || 1) * (Number(item.rate) || 0))}</span>
    <button class="remove-item" type="button" aria-label="Remove item">×</button>`;
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => {
    row.querySelector(".item-amount").textContent = formatMoney(
      (Number(row.querySelector(".item-quantity").value) || 0) * (Number(row.querySelector(".item-rate").value) || 0),
    );
    renderPreview();
    persistDraft();
  }));
  row.querySelector(".remove-item").addEventListener("click", () => {
    row.remove();
    rows = rows.filter((entry) => entry !== row);
    renderPreview();
    persistDraft();
  });
  itemContainer.append(row);
  rows.push(row);
}

function persistDraft() {
  if (writeStorage(STORAGE_KEYS.current, { ...getData(), invoiceId: activeInvoiceId })) {
    document.querySelector(".sync-status").innerHTML = '<span class="sync-dot"></span> All changes saved';
  }
}

function setForm(data = {}) {
  Object.entries({
    number: data.number || nextInvoiceNumber(),
    currency: data.currency || "USD",
    issueDate: data.issueDate || dateValue(new Date()),
    dueDate: data.dueDate || dateValue(new Date(Date.now() + 14 * 86400000)),
    fromName: data.fromName ?? "Studio North",
    fromEmail: data.fromEmail ?? "hello@studionorth.co",
    clientName: data.clientName || "",
    clientEmail: data.clientEmail || "",
    location: data.location || "US",
    taxRate: data.taxRate ?? taxRates[data.location || "US"],
    notes: data.notes || "",
  }).forEach(([key, value]) => { fields[key].value = value; });
  itemContainer.innerHTML = "";
  rows = [];
  (data.items?.length ? data.items : [{ quantity: 1, rate: "" }]).forEach(createItemRow);
  renderPreview();
}

function nextInvoiceNumber() {
  const highest = invoices.reduce((max, invoice) => {
    const match = invoice.number?.match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `INV-${new Date().getFullYear()}-${String(highest + 1).padStart(3, "0")}`;
}

function saveInvoice() {
  const data = getData();
  if (!data.clientName) {
    fields.clientName.focus();
    showToast("Add a client name before saving.");
    return;
  }
  if (!data.items.length || !data.items.some((item) => item.description && item.rate > 0)) {
    document.querySelector(".item-description").focus();
    showToast("Add a description and rate to at least one line item.");
    return;
  }
  const now = new Date().toISOString();
  const updatedInvoices = JSON.parse(JSON.stringify(invoices));
  let invoice = updatedInvoices.find((entry) => entry.id === activeInvoiceId);
  const savedInvoiceId = invoice?.id;
  if (invoice) {
    invoice.number = data.number;
    invoice.clientName = data.clientName;
    invoice.currency = data.currency;
    invoice.total = data.total;
    invoice.updatedAt = now;
    invoice.versions.push({ ...data, savedAt: now });
  } else {
    invoice = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      number: data.number,
      clientName: data.clientName,
      currency: data.currency,
      total: data.total,
      updatedAt: now,
      versions: [{ ...data, savedAt: now }],
    };
    updatedInvoices.unshift(invoice);
  }
  if (!writeStorage(STORAGE_KEYS.invoices, updatedInvoices)) return;
  invoices = updatedInvoices;
  activeInvoiceId = savedInvoiceId || invoice.id;
  persistDraft();
  renderPreview();
  renderSavedInvoices();
  showToast("Invoice saved. Version snapshot created.");
}

function renderSavedInvoices() {
  const list = document.querySelector("#saved-list");
  document.querySelector("#invoice-count").textContent = invoices.length;
  if (!invoices.length) {
    list.innerHTML = '<div class="saved-empty">No saved invoices yet. Create one and it will be waiting here.</div>';
    return;
  }
  list.innerHTML = invoices.map((invoice) => `
    <div class="saved-row">
      <div><strong>${escapeHtml(invoice.number)}</strong><small>${invoice.versions.length} version${invoice.versions.length === 1 ? "" : "s"}</small></div>
      <div><strong>${escapeHtml(invoice.clientName)}</strong><small>Last updated ${formatDate(invoice.updatedAt?.slice(0, 10))}</small></div>
      <div class="saved-total">${formatMoney(invoice.total, invoice.currency)}</div>
      <button type="button" data-open-invoice="${escapeHtml(invoice.id)}">Open invoice →</button>
    </div>`).join("");
  list.querySelectorAll("[data-open-invoice]").forEach((button) => button.addEventListener("click", () => {
    const invoice = invoices.find((entry) => entry.id === button.dataset.openInvoice);
    if (!invoice) return;
    activeInvoiceId = invoice.id;
    setForm(invoice.versions.at(-1));
    persistDraft();
    showEditor();
  }));
}

function showEditor() {
  document.querySelector("#invoice-workspace").hidden = false;
  document.querySelector("#saved-view").hidden = true;
  document.querySelector("#coming-soon-view").hidden = true;
  document.querySelector("#page-title").textContent = "Create an invoice";
  document.querySelector("#page-subtitle").textContent = "A little less admin. A lot more getting paid.";
  document.querySelector("#breadcrumb-current").textContent = "Invoices";
  setActiveNav("invoices");
}

function showSaved() {
  renderSavedInvoices();
  document.querySelector("#invoice-workspace").hidden = true;
  document.querySelector("#saved-view").hidden = false;
  document.querySelector("#coming-soon-view").hidden = true;
  document.querySelector("#page-title").textContent = "Your invoices";
  document.querySelector("#page-subtitle").textContent = "Every detail, right where you left it.";
  document.querySelector("#breadcrumb-current").textContent = "Saved invoices";
  setActiveNav("overview");
}

function setActiveNav(view) {
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.view === view);
  });
}

function showComingSoon(feature) {
  currentComingSoonFeature = feature;
  const featureDetails = {
    clients: {
      title: "A better way to manage clients is on its way.",
      description: "Keep your client details, contacts, and invoice history together. Join the early access list and we’ll let you know when it’s ready.",
    },
    items: {
      title: "Your favorite services, ready when you are.",
      description: "Build a reusable catalog of products and services, then add them to invoices in a click. Join the early access list for launch news.",
    },
  };
  document.querySelector("#coming-soon-title").textContent = featureDetails[feature].title;
  document.querySelector("#coming-soon-description").textContent = featureDetails[feature].description;
  document.querySelector("#waitlist-status").textContent = "";
  document.querySelector("#invoice-workspace").hidden = true;
  document.querySelector("#saved-view").hidden = true;
  document.querySelector("#coming-soon-view").hidden = false;
  document.querySelector("#page-title").textContent = feature === "clients" ? "Clients" : "Items & services";
  document.querySelector("#page-subtitle").textContent = "A little more of Invoxa is on its way.";
  document.querySelector("#breadcrumb-current").textContent = feature === "clients" ? "Clients" : "Items & services";
  setActiveNav(feature);
}

function openVersions() {
  const invoice = invoices.find((entry) => entry.id === activeInvoiceId);
  const list = document.querySelector("#versions-list");
  if (!invoice) {
    list.innerHTML = '<div class="version-empty">Save this invoice to start a version history.</div>';
  } else {
    list.innerHTML = [...invoice.versions].reverse().map((version, index) => {
      const versionNumber = invoice.versions.length - index;
      return `<div class="version-entry">
        <div><strong>Version ${versionNumber}</strong><small>${new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(version.savedAt))} · ${formatMoney(version.total, version.currency)}</small></div>
        <button type="button" data-restore-version="${versionNumber}">Restore</button>
      </div>`;
    }).join("");
    list.querySelectorAll("[data-restore-version]").forEach((button) => button.addEventListener("click", () => {
      const index = Number(button.dataset.restoreVersion) - 1;
      setForm(invoice.versions[index]);
      persistDraft();
      document.querySelector("#versions-dialog").close();
      showToast(`Version ${index + 1} restored. Save to create a new snapshot.`);
    }));
  }
  document.querySelector("#versions-dialog").showModal();
}

function showSuggestions() {
  const panel = document.querySelector("#suggestion-panel");
  const entries = invoices.flatMap((invoice) => invoice.versions.flatMap((version) =>
    version.items.map((item) => ({ ...item, currency: version.currency })),
  )).filter((item) => item.description);
  const groups = new Map();
  entries.forEach((item) => {
    const key = `${item.description.toLocaleLowerCase()}|${item.currency}`;
    const previous = groups.get(key);
    if (previous) {
      previous.count += 1;
      previous.rateTotal += item.rate;
      previous.quantityTotal += item.quantity;
    } else {
      groups.set(key, { ...item, count: 1, rateTotal: item.rate, quantityTotal: item.quantity });
    }
  });
  const suggestions = [...groups.values()].sort((a, b) => b.count - a.count).slice(0, 5);
  panel.hidden = false;
  if (!suggestions.length) {
    panel.innerHTML = '<span class="suggestion-label">Suggestions will appear after you save invoices on this device.</span>';
    return;
  }
  panel.innerHTML = `<span class="suggestion-label">Frequently used in your saved invoices · select to add</span>${suggestions.map((item) => {
    const averageRate = item.rateTotal / item.count;
    const quantity = Math.max(1, Math.round(item.quantityTotal / item.count));
    return `<button type="button" class="suggestion-chip" data-description="${escapeHtml(item.description)}" data-rate="${averageRate}" data-quantity="${quantity}" data-currency="${item.currency}">${escapeHtml(item.description)} · ${formatMoney(averageRate, item.currency)}</button>`;
  }).join("")}`;
  panel.querySelectorAll(".suggestion-chip").forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.currency !== fields.currency.value) {
      showToast(`This suggestion is in ${button.dataset.currency}. Change currency to use its saved rate.`);
      return;
    }
    const emptyRow = rows.find((row) => !row.querySelector(".item-description").value && !row.querySelector(".item-rate").value);
    if (emptyRow) {
      emptyRow.querySelector(".item-description").value = button.dataset.description;
      emptyRow.querySelector(".item-rate").value = Number(button.dataset.rate).toFixed(2);
      emptyRow.querySelector(".item-quantity").value = button.dataset.quantity;
      emptyRow.querySelector(".item-amount").textContent = formatMoney(Number(button.dataset.rate) * Number(button.dataset.quantity));
    } else {
      createItemRow({ description: button.dataset.description, rate: Number(button.dataset.rate).toFixed(2), quantity: button.dataset.quantity });
    }
    renderPreview();
    persistDraft();
  }));
}

fields.location.addEventListener("change", () => {
  fields.taxRate.value = taxRates[fields.location.value];
  renderPreview();
  persistDraft();
});
Object.values(fields).forEach((field) => {
  field.addEventListener("input", () => { renderPreview(); persistDraft(); });
  field.addEventListener("change", () => { renderPreview(); persistDraft(); });
});
document.querySelector("#currency").addEventListener("change", () => {
  rows.forEach((row) => {
    const quantity = Number(row.querySelector(".item-quantity").value) || 0;
    const rate = Number(row.querySelector(".item-rate").value) || 0;
    row.querySelector(".item-amount").textContent = formatMoney(quantity * rate);
  });
  renderPreview();
  persistDraft();
});
document.querySelector("#add-item-button").addEventListener("click", () => createItemRow({ quantity: 1 }));
document.querySelector("#suggest-button").addEventListener("click", showSuggestions);
document.querySelector("#save-button").addEventListener("click", saveInvoice);
document.querySelector("#print-button").addEventListener("click", () => window.print());
document.querySelector("#versions-button").addEventListener("click", openVersions);
document.querySelector(".dialog-close").addEventListener("click", () => document.querySelector("#versions-dialog").close());
document.querySelector("#new-invoice-button").addEventListener("click", () => {
  activeInvoiceId = null;
  setForm({ number: nextInvoiceNumber() });
  persistDraft();
  showEditor();
});
document.querySelector("#saved-new-button").addEventListener("click", () => {
  activeInvoiceId = null;
  setForm({ number: nextInvoiceNumber() });
  persistDraft();
  showEditor();
});
document.querySelector("#history-link").addEventListener("click", showSaved);
document.querySelector("#auth-button").addEventListener("click", () => {
  window.location.assign("/api/auth/google");
});
document.querySelector("#sign-out-button").addEventListener("click", async () => {
  const button = document.querySelector("#sign-out-button");
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error(`Sign-out failed (${response.status}).`);
    currentUser = null;
    renderAuthState();
    showToast("You've been signed out.");
  } catch (error) {
    console.error("Could not sign out.", error);
    showToast("Couldn't sign out. Please try again.");
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#waitlist-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const emailInput = document.querySelector("#waitlist-email");
  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.querySelector("#waitlist-status");
  submitButton.disabled = true;
  status.textContent = "Adding you to the list…";
  try {
    const response = await fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput.value, feature: currentComingSoonFeature }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
    status.textContent = "You're on the list. We'll be in touch when it's ready.";
    form.reset();
    renderAuthState();
  } catch (error) {
    console.error("Could not add the email to the waitlist.", error);
    status.textContent = error.message || "Couldn't join the list. Please try again.";
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector("#reset-button").addEventListener("click", () => {
  activeInvoiceId = null;
  setForm({ number: nextInvoiceNumber() });
  persistDraft();
  showToast("Started a fresh invoice.");
});
document.querySelectorAll(".nav-link").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.view === "invoices") showEditor();
  else if (button.dataset.view === "overview") showSaved();
  else showComingSoon(button.dataset.view);
}));
document.querySelector(".upgrade-button").addEventListener("click", () => showToast("You're all set — start by creating an invoice."));
document.querySelector(".help-button").addEventListener("click", () => showToast("Need help? Print saves a PDF; your invoices stay on this device."));

const draft = readStorage(STORAGE_KEYS.current, {});
activeInvoiceId = draft.invoiceId || null;
setForm(draft);
renderSavedInvoices();
loadAuthState();
const authResult = new URLSearchParams(window.location.search).get("auth");
if (authResult === "error" || authResult === "cancelled") {
  showToast(authResult === "cancelled" ? "Google sign-in was cancelled." : "Google sign-in failed. Please try again.");
  window.history.replaceState({}, "", window.location.pathname);
}
