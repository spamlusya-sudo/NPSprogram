import { getStore } from "@netlify/blobs";

const store = getStore("npsprogram-shared");
const key = "dashboard-state";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function sanitizeState(input) {
  const safeNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  };

  const sanitizeFuel = (value) => (["95", "92", "DT"].includes(value) ? value : "95");
  const sanitizeDate = (value, fallback = "") =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;

  const state = typeof input === "object" && input ? input : {};

  return {
    stock: {
      "95": safeNumber(state.stock?.["95"], 1000),
      "92": safeNumber(state.stock?.["92"], 800),
      "DT": safeNumber(state.stock?.["DT"], 500)
    },
    daily: {
      "95": safeNumber(state.daily?.["95"], 45),
      "92": safeNumber(state.daily?.["92"], 35),
      "DT": safeNumber(state.daily?.["DT"], 20)
    },
    deliveries: Array.isArray(state.deliveries)
      ? state.deliveries.map((item) => ({
          id: safeNumber(item?.id, Date.now()),
          fuel: sanitizeFuel(item?.fuel),
          volume: safeNumber(item?.volume, 0),
          buyDate: sanitizeDate(item?.buyDate),
          arrDate: sanitizeDate(item?.arrDate),
          origDays: safeNumber(item?.origDays, 0)
        }))
      : [],
    sales: Array.isArray(state.sales)
      ? state.sales.map((item) => ({
          id: safeNumber(item?.id, Date.now()),
          fuel: sanitizeFuel(item?.fuel),
          date: sanitizeDate(item?.date),
          volume: safeNumber(item?.volume, 0),
          buyPrice: safeNumber(item?.buyPrice, 0),
          sellPrice: safeNumber(item?.sellPrice, 0)
        }))
      : [],
    stockRangeDays: [30, 60, 90].includes(Number(state.stockRangeDays)) ? Number(state.stockRangeDays) : 30,
    forecastRangeDays: [30, 60, 90].includes(Number(state.forecastRangeDays)) ? Number(state.forecastRangeDays) : 30
  };
}

const defaultState = sanitizeState({});

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
    const body = await req.json();
    const state = sanitizeState(body?.state);
    const updatedAt = new Date().toISOString();

    await store.setJSON(key, { state, updatedAt });

    return json({ ok: true, updatedAt });
  }

  return json({ error: "Method not allowed" }, 405);
};
