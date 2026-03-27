import { getStore } from "@netlify/blobs";

const store = getStore("npsprogram-shared");
const key = "dashboard-state";
const ALLOWED_FUELS = ["95", "92", "DT"];

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function sanitizeFuel(value) {
  return ALLOWED_FUELS.includes(value) ? value : "95";
}

function sanitizeDate(value, fallback = "") {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function sanitizeFuelMap(obj, fallbackValue) {
  const src = typeof obj === "object" && obj ? obj : {};
  return {
    "95": safeNumber(src["95"], fallbackValue),
    "92": safeNumber(src["92"], fallbackValue),
    "DT": safeNumber(src["DT"], fallbackValue)
  };
}

function sanitizeHistorySnapshots(value) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const [date, snapshot] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out[date] = {
      stock: sanitizeFuelMap(snapshot?.stock, 0),
      daily: sanitizeFuelMap(snapshot?.daily, 0),
      mins: sanitizeFuelMap(snapshot?.mins, 330),
      savedAt: typeof snapshot?.savedAt === "string" ? snapshot.savedAt : null
    };
  }
  return out;
}

function sanitizeState(input) {
  const state = typeof input === "object" && input ? input : {};
  return {
    stock: sanitizeFuelMap(state.stock, 0),
    daily: sanitizeFuelMap(state.daily, 0),
    mins: sanitizeFuelMap(state.mins, 330),
    deliveries: Array.isArray(state.deliveries)
      ? state.deliveries.map((item, idx) => ({
          id: safeNumber(item?.id, Date.now() + idx),
          fuel: sanitizeFuel(item?.fuel),
          volume: safeNumber(item?.volume, 0),
          buyPrice: safeNumber(item?.buyPrice, 0),
          buyDate: sanitizeDate(item?.buyDate),
          arrDate: sanitizeDate(item?.arrDate),
          origDays: safeNumber(item?.origDays, 0)
        }))
      : [],
    sales: Array.isArray(state.sales)
      ? state.sales.map((item, idx) => ({
          id: safeNumber(item?.id, Date.now() + idx),
          fuel: sanitizeFuel(item?.fuel),
          date: sanitizeDate(item?.date),
          volume: safeNumber(item?.volume, 0),
          buyPrice: safeNumber(item?.buyPrice, 0),
          sellPrice: safeNumber(item?.sellPrice, 0)
        }))
      : [],
    historySnapshots: sanitizeHistorySnapshots(state.historySnapshots),
    stockRangeDays: [7, 14, 30].includes(Number(state.stockRangeDays)) ? Number(state.stockRangeDays) : 30,
    forecastRangeDays: [7, 14, 30].includes(Number(state.forecastRangeDays)) ? Number(state.forecastRangeDays) : 30,
    stockChartMode: "future",
    forecastChartMode: "future",
    stockChartFuel: ["ALL", ...ALLOWED_FUELS].includes(state.stockChartFuel) ? state.stockChartFuel : "ALL",
    forecastChartFuel: ["ALL", ...ALLOWED_FUELS].includes(state.forecastChartFuel) ? state.forecastChartFuel : "ALL",
    wsTargetDate: sanitizeDate(state.wsTargetDate)
  };
}

function mergeById(serverList, incomingList) {
  const map = new Map();
  [...serverList, ...incomingList].forEach((item) => {
    if (!item || typeof item !== "object") return;
    map.set(String(item.id), item);
  });
  return Array.from(map.values());
}

function mergeStates(serverState, incomingState) {
  const server = sanitizeState(serverState || {});
  const incoming = sanitizeState(incomingState || {});
  return sanitizeState({
    stock: incoming.stock,
    daily: incoming.daily,
    mins: incoming.mins,
    deliveries: mergeById(server.deliveries, incoming.deliveries),
    sales: mergeById(server.sales, incoming.sales),
    historySnapshots: { ...(server.historySnapshots || {}), ...(incoming.historySnapshots || {}) },
    stockRangeDays: incoming.stockRangeDays,
    forecastRangeDays: incoming.forecastRangeDays,
    stockChartFuel: incoming.stockChartFuel,
    forecastChartFuel: incoming.forecastChartFuel,
    wsTargetDate: incoming.wsTargetDate || server.wsTargetDate || ""
  });
}

const defaultState = sanitizeState({
  stock: { "95": 345.5, "92": 402, "DT": 247 },
  daily: { "95": 45, "92": 35, "DT": 20 },
  mins: { "95": 330, "92": 330, "DT": 330 }
});

export default async (req) => {
  if (req.method === "GET") {
    const entry = await store.get(key, { type: "json" });
    if (!entry) {
      return json({ state: defaultState, updatedAt: null });
    }
    return json({
      state: sanitizeState(entry.state),
      updatedAt: entry.updatedAt || null
    });
  }

  if (req.method === "POST") {
    let payload;
    try {
      payload = await req.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    const current = await store.get(key, { type: "json" });
    const incomingState = sanitizeState(payload?.state);
    const mergedState = current?.state ? mergeStates(current.state, incomingState) : incomingState;
    const updatedAt = new Date().toISOString();
    await store.setJSON(key, { state: mergedState, updatedAt });
    return json({ ok: true, updatedAt, state: mergedState });
  }

  return json({ error: "method_not_allowed" }, 405);
};
