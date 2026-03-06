"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";

// ─── Utility Functions ───
const LKR = (n) => {
  const num = parseFloat(n) || 0;
  return `LKR ${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const shortLKR = (n) => {
  const num = parseFloat(n) || 0;
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const toISO = (d) => {
  if (!d) return new Date().toISOString().slice(0, 10);
  return d;
};

const today = () => new Date().toISOString().slice(0, 10);

const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ─── Supabase Cloud Database ───
const SUPABASE_URL = "https://evukcaddybqrbpkfvjev.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2dWtjYWRkeWJxcmJwa2Z2amV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjAyNjAsImV4cCI6MjA4ODAzNjI2MH0.BFNm0EnLrNUnnIc8bPYnF-NJmgeRc5MbKdBK-uM6ekU";

const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: "Bearer " + SUPABASE_KEY,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const sbGet = async (table, query = "") => {
  try {
    const r = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?select=*" + query, {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
    });
    if (!r.ok) { console.error("sbGet error:", table, r.status); return []; }
    return await r.json();
  } catch (e) { console.error("sbGet failed:", table, e); return []; }
};
const sbInsert = async (table, data) => {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + table, { method: "POST", headers: sbHeaders, body: JSON.stringify(Array.isArray(data) ? data : [data]) });
  return r.json();
};
const sbUpdate = async (table, match, data) => {
  const r = await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + match, { method: "PATCH", headers: sbHeaders, body: JSON.stringify(data) });
  return r.json();
};
const sbDelete = async (table, match) => {
  await fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + match, { method: "DELETE", headers: { ...sbHeaders, Prefer: "return=minimal" } });
};

// ─── Auto-Sync (polls for changes + refreshes when app comes back to focus) ───

// ─── Local cache layer (loads from Supabase, caches in memory) ───
let _cache = {};
const DB = {
  _loaded: false,
  load: async () => {
    if (DB._loaded) return;
    try {
      const [users, suppliers, products, purchases, purchase_items, payments, returns, return_items, payment_allocations] = await Promise.all([
        sbGet("users", "&is_active=eq.true&order=role"),
        sbGet("suppliers", "&order=name"),
        sbGet("products", "&order=name"),
        sbGet("purchases", "&order=invoice_date.desc"),
        sbGet("purchase_items"),
        sbGet("payments", "&order=payment_date.desc"),
        sbGet("returns", "&order=return_date.desc"),
        sbGet("return_items"),
        sbGet("payment_allocations"),
      ]);
      _cache = { users, suppliers, products, purchases, purchase_items, payments, returns, return_items, payment_allocations };
      DB._loaded = true;
    } catch (e) {
      console.error("DB load failed:", e);
      throw e;
    }
  },
  reload: async () => { DB._loaded = false; await DB.load(); },
  get: (key, fallback = []) => _cache[key] || fallback,
  set: (key, val) => { _cache[key] = val; },
};

// ─── Icons (inline SVG) ───
const Icon = ({ name, size = 22, color = "currentColor" }) => {
  const icons = {
    home: <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />,
    cart: <path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.3 2.3c-.4.4-.1 1.1.5 1.1H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />,
    money: <path d="M12 8c-1.7 0-3 .9-3 2s1.3 2 3 2 3 .9 3 2-1.3 2-3 2m0-8c1.1 0 2.1.4 2.8 1M12 8V6m0 12v-2m0 0c-1.1 0-2.1-.4-2.8-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    ret: <path d="M3 10h10a5 5 0 010 10H9m-6-10l4-4m-4 4l4 4" />,
    users: <path d="M17 20h5v-2a3 3 0 00-5.4-1.8M17 20H7m10 0v-2c0-.7-.2-1.3-.4-1.8M7 20H2v-2a3 3 0 015.4-1.8M7 20v-2c0-.7.2-1.3.4-1.8m0 0a5.5 5.5 0 019.2 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />,
    box: <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />,
    search: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,
    plus: <path d="M12 4v16m8-8H4" />,
    edit: <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11.8 14H9v-2.8l8.6-8.6z" />,
    trash: <path d="M19 7l-.9 12a2 2 0 01-2 1.8H7.9a2 2 0 01-2-1.8L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
    check: <path d="M5 13l4 4L19 7" />,
    x: <path d="M6 18L18 6M6 6l12 12" />,
    chart: <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
    tag: <path d="M7 7h.01M7 3h5a1.9 1.9 0 011.4.6l6.1 6.1a2 2 0 010 2.8l-5.6 5.6a2 2 0 01-2.8 0L5 12.2A2 2 0 014.6 10.8V5a2 2 0 012-2z" />,
    logout: <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
    clock: <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />,
    eye: <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
    down: <path d="M19 9l-7 7-7-7" />,
    back: <path d="M15 19l-7-7 7-7" />,
    save: <path d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {icons[name]}
    </svg>
  );
};

// ─── Toast Notification ───
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, [onClose]);
  const bg = type === "success" ? "bg-emerald-600" : type === "error" ? "bg-red-600" : "bg-amber-600";
  return (
    <div className={`fixed top-4 right-4 z-[999] ${bg} text-white px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-slideIn min-w-[280px]`}>
      <Icon name={type === "success" ? "check" : "x"} size={20} />
      <span className="text-[15px] font-medium">{message}</span>
      <button onClick={onClose} className="ml-auto opacity-70 hover:opacity-100"><Icon name="x" size={16} /></button>
    </div>
  );
};

// ─── Confirm Dialog (with optional PIN protection) ───
const Confirm = ({ title, message, onYes, onNo, requirePin }) => {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");

  const handleConfirm = () => {
    if (requirePin) {
      if (pin === "1234") {
        onYes();
      } else {
        setPinError("Wrong PIN! Only Admin can delete.");
        setPin("");
      }
    } else {
      onYes();
    }
  };

  return (
    <div className="fixed inset-0 z-[998] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>
        <p className="text-slate-600 mb-4">{message}</p>
        {requirePin && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-red-700 mb-2">🔒 Enter Admin PIN to confirm deletion:</label>
            <input type="password" inputMode="numeric" maxLength={4} value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "")); setPinError(""); }}
              onKeyDown={e => e.key === "Enter" && pin.length === 4 && handleConfirm()}
              className="w-full text-center text-2xl tracking-[0.5em] py-3 rounded-xl border-2 border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100 outline-none"
              placeholder="• • • •" autoFocus />
            {pinError && <p className="text-red-500 text-sm mt-2 text-center font-semibold">{pinError}</p>}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onNo} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition">Cancel</button>
          <button onClick={handleConfirm} disabled={requirePin && pin.length < 4}
            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition disabled:opacity-40">
            {requirePin ? "🔒 Delete" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Modal Wrapper ───
const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-[900] bg-black/50 flex items-start justify-center p-3 pt-8 overflow-y-auto">
    <div className={`bg-white rounded-2xl shadow-2xl w-full ${wide ? "max-w-3xl" : "max-w-lg md:max-w-xl"} mb-8`}>
      <div className="flex items-center justify-between p-5 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100"><Icon name="x" /></button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

// ─── Search Input ───
const SearchBox = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" size={18} /></div>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full pl-11 pr-4 py-3 md:py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none text-[16px] md:text-[18px] transition" />
    {value && <button onClick={() => onChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><Icon name="x" size={16} /></button>}
  </div>
);

// ─── Empty State ───
const Empty = ({ icon, text, sub }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-slate-400"><Icon name={icon} size={28} /></div>
    <p className="text-lg font-semibold text-slate-500 mb-1">{text}</p>
    {sub && <p className="text-sm text-slate-400">{sub}</p>}
  </div>
);

// ─── Data is loaded from Supabase on app mount ───

// ─── Data Hooks (Supabase-backed) ───
const useData = (key, refreshTick) => {
  const [data, setData] = useState(() => DB.get(key));
  // Re-sync from cache when refreshTick changes
  useEffect(() => { setData(DB.get(key)); }, [refreshTick, key]);
  const save = useCallback((newData) => { DB.set(key, newData); setData(newData); }, [key]);
  const add = useCallback(async (item) => {
    const { id, ...rest } = item;
    const result = await sbInsert(key, rest);
    if (result && result[0]) {
      const newItem = result[0];
      const d = [...DB.get(key), newItem];
      save(d);
      return newItem;
    }
    return item;
  }, [key, save]);
  const update = useCallback(async (id, changes) => {
    await sbUpdate(key, "id=eq." + id, { ...changes, updated_at: new Date().toISOString() });
    const d = DB.get(key).map(i => i.id === id ? { ...i, ...changes, updated_at: today() } : i);
    save(d);
  }, [key, save]);
  const remove = useCallback(async (id) => {
    await sbDelete(key, "id=eq." + id);
    save(DB.get(key).filter(i => i.id !== id));
  }, [key, save]);
  const refresh = useCallback(async () => {
    await DB.reload();
    setData(DB.get(key));
  }, [key]);
  return { data, save, add, update, remove, refresh };
};

// ═══════════════════════════════════════
//  MAIN APP
// ═══════════════════════════════════════
export default function ShopLedger() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [dbReady, setDbReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const syncingRef = useRef(false);

  const silentRefresh = useCallback(async () => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    try {
      await DB.reload();
      setRefreshTick(t => t + 1);
    } catch (e) { console.error("Sync error:", e); }
    syncingRef.current = false;
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await silentRefresh();
    setRefreshing(false);
  };

  // Auto-sync: poll every 15 seconds (silent, no blinking)
  useEffect(() => {
    if (!dbReady) return;
    const poll = setInterval(silentRefresh, 15000);
    return () => clearInterval(poll);
  }, [dbReady, silentRefresh]);

  // Refresh when user switches back to the app
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") silentRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [silentRefresh]);

  // Load data from Supabase on mount
  useEffect(() => {
    let retries = 0;
    const tryLoad = () => {
      DB.load().then(() => { setDbReady(true); setRefreshTick(1); }).catch(e => {
        console.error("DB load error:", e);
        if (retries < 2) { retries++; DB._loaded = false; setTimeout(tryLoad, 2000); }
        else { setDbReady(true); setRefreshTick(1); }
      });
    };
    tryLoad();
  }, []);

  const suppliers = useData("suppliers", refreshTick);
  const products = useData("products", refreshTick);
  const purchases = useData("purchases", refreshTick);
  const purchaseItems = useData("purchase_items", refreshTick);
  const payments = useData("payments", refreshTick);
  const returns = useData("returns", refreshTick);
  const returnItems = useData("return_items", refreshTick);
  const paymentAllocations = useData("payment_allocations", refreshTick);

  // ── FIFO Allocation Helper ──
  // Given a supplier, computes which credit/partial invoices are unpaid/partially-paid
  // by looking at existing allocations, then previews how a new payment would be distributed
  const computeFifoPreview = useCallback((supplierId, paymentAmount, excludePaymentId = null) => {
    // Get all credit/partial invoices for this supplier, sorted oldest first
    const creditInvoices = purchases.data
      .filter(p => p.supplier_id === supplierId && (p.payment_type === "Credit" || p.payment_type === "Partial"))
      .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date) || (a.created_at || "").localeCompare(b.created_at || ""));

    // Get existing allocations (exclude current payment if editing)
    const existingAllocs = paymentAllocations.data.filter(a =>
      a.supplier_id === supplierId && a.payment_id !== excludePaymentId
    );

    // Also account for returns as credits against the supplier
    const totalReturns = returns.data
      .filter(r => r.supplier_id === supplierId)
      .reduce((s, r) => s + r.total_amount, 0);

    // Calculate how much each invoice still owes
    const invoiceBalances = creditInvoices.map(inv => {
      const invoiceCredit = inv.total_amount - (inv.amount_paid || 0); // amount that went on credit
      const alreadyAllocated = existingAllocs
        .filter(a => a.purchase_id === inv.id)
        .reduce((s, a) => s + a.allocated_amount, 0);
      const remaining = Math.max(0, Math.round((invoiceCredit - alreadyAllocated) * 100) / 100);
      return { ...inv, invoiceCredit, alreadyAllocated, remaining };
    }).filter(inv => inv.remaining > 0);

    // Allocate the payment amount using FIFO
    let remaining = parseFloat(paymentAmount) || 0;
    const allocations = [];
    for (const inv of invoiceBalances) {
      if (remaining <= 0) break;
      const allocate = Math.min(remaining, inv.remaining);
      allocations.push({
        purchase_id: inv.id,
        invoice_number: inv.invoice_number || "N/A",
        invoice_date: inv.invoice_date,
        invoice_total: inv.total_amount,
        invoice_credit: inv.invoiceCredit,
        already_paid: inv.alreadyAllocated,
        remaining_before: inv.remaining,
        allocated_amount: Math.round(allocate * 100) / 100,
        remaining_after: Math.round((inv.remaining - allocate) * 100) / 100,
        fully_settled: Math.round((inv.remaining - allocate) * 100) / 100 === 0,
      });
      remaining = Math.round((remaining - allocate) * 100) / 100;
    }

    return {
      allocations,
      totalAllocated: Math.round((parseFloat(paymentAmount || 0) - remaining) * 100) / 100,
      unallocated: remaining, // excess payment beyond all invoices
      unpaidInvoices: invoiceBalances.length,
    };
  }, [purchases.data, paymentAllocations.data, returns.data]);

  // Get allocation info for a specific invoice (how much has been paid via allocations)
  const getInvoiceAllocations = useCallback((purchaseId) => {
    return paymentAllocations.data
      .filter(a => a.purchase_id === purchaseId)
      .map(a => {
        const payment = payments.data.find(p => p.id === a.payment_id);
        return { ...a, payment };
      });
  }, [paymentAllocations.data, payments.data]);

  // Get allocation info for a specific payment (which invoices it settled)
  const getPaymentAllocations = useCallback((paymentId) => {
    return paymentAllocations.data
      .filter(a => a.payment_id === paymentId)
      .map(a => {
        const purchase = purchases.data.find(p => p.id === a.purchase_id);
        return { ...a, purchase };
      });
  }, [paymentAllocations.data, purchases.data]);

  // Get unpaid invoices for a supplier (used in manual allocation mode)
  const getUnpaidInvoices = useCallback((supplierId, excludePaymentId = null) => {
    const creditInvoices = purchases.data
      .filter(p => p.supplier_id === supplierId && (p.payment_type === "Credit" || p.payment_type === "Partial"))
      .sort((a, b) => a.invoice_date.localeCompare(b.invoice_date) || (a.created_at || "").localeCompare(b.created_at || ""));

    const existingAllocs = paymentAllocations.data.filter(a =>
      a.supplier_id === supplierId && a.payment_id !== excludePaymentId
    );

    return creditInvoices.map(inv => {
      const invoiceCredit = inv.total_amount - (inv.amount_paid || 0);
      const alreadyAllocated = existingAllocs
        .filter(a => a.purchase_id === inv.id)
        .reduce((s, a) => s + a.allocated_amount, 0);
      const remaining = Math.max(0, Math.round((invoiceCredit - alreadyAllocated) * 100) / 100);
      return {
        purchase_id: inv.id,
        invoice_number: inv.invoice_number || "N/A",
        invoice_date: inv.invoice_date,
        invoice_total: inv.total_amount,
        invoice_credit: invoiceCredit,
        already_paid: alreadyAllocated,
        remaining,
      };
    }).filter(inv => inv.remaining > 0);
  }, [purchases.data, paymentAllocations.data]);

  const notify = (message, type = "success") => setToast({ message, type });
  const askConfirm = (title, message, onYes, requirePin = false) => setConfirm({ title, message, onYes, onNo: () => setConfirm(null), requirePin });

  // ── Purchase draft stored as ref so it never causes re-renders ──
  const purchaseDraftRef = useRef(null);

  const login = (u) => { setUser(u); };
  const logout = () => { setUser(null); setPage("dashboard"); };

  // ── Compute supplier outstanding ──
  const getOutstanding = useCallback((suppId) => {
    const supp = suppliers.data.find(s => s.id === suppId);
    const openingBalance = parseFloat(supp?.opening_balance) || 0;
    const creditPurchases = purchases.data.filter(p => p.supplier_id === suppId && (p.payment_type === "Credit" || p.payment_type === "Partial"))
      .reduce((s, p) => s + (p.total_amount - (p.amount_paid || 0)), 0);
    const totalPayments = payments.data.filter(p => p.supplier_id === suppId).reduce((s, p) => s + p.amount, 0);
    const totalReturns = returns.data.filter(r => r.supplier_id === suppId).reduce((s, r) => s + r.total_amount, 0);
    return Math.round((openingBalance + creditPurchases - totalPayments - totalReturns) * 100) / 100;
  }, [suppliers.data, purchases.data, payments.data, returns.data]);

  const getLastPrice = useCallback((prodId) => {
    const items = purchaseItems.data.filter(i => i.product_id === prodId);
    if (!items.length) return null;
    const pIds = items.map(i => i.purchase_id);
    const relPurchases = purchases.data.filter(p => pIds.includes(p.id)).sort((a, b) => new Date(b.invoice_date) - new Date(a.invoice_date));
    if (!relPurchases.length) return null;
    const latestItem = items.find(i => i.purchase_id === relPurchases[0].id);
    const supp = suppliers.data.find(s => s.id === relPurchases[0].supplier_id);
    return latestItem ? { price: latestItem.unit_price, unit: latestItem.unit, date: relPurchases[0].invoice_date, supplier: supp?.name } : null;
  }, [purchaseItems.data, purchases.data, suppliers.data]);

  // ── Loading Screen ──
  if (!dbReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 via-slate-800 to-blue-900 gap-4">
        <div className="text-5xl mb-2">📒</div>
        <div className="w-10 h-10 border-4 border-blue-300 border-t-white rounded-full animate-spin" />
        <p className="text-white font-medium">Connecting to database...</p>
        <p className="text-slate-400 text-sm">☁️ Supabase Cloud</p>
      </div>
    );
  }

  // ── Login Screen ──
  if (!user) {
    return <LoginScreen users={DB.get("users")} onLogin={login} />;
  }

  const isAdmin = user.role === "admin";
  const navItems = [
    { id: "dashboard", icon: "home", label: "Home" },
    { id: "purchases", icon: "cart", label: "Purchases" },
    { id: "payments", icon: "money", label: "Payments" },
    { id: "returns", icon: "ret", label: "Returns" },
    { id: "suppliers", icon: "users", label: "Suppliers" },
    { id: "products", icon: "box", label: "Products" },
    { id: "price-check", icon: "tag", label: "Prices" },
    ...(isAdmin ? [{ id: "reports", icon: "chart", label: "Reports" }] : []),
  ];

  const refreshAll = async () => {
    await silentRefresh();
  };


  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      {confirm && <Confirm {...confirm} />}

      {/* Desktop Sidebar (1024px+) */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-[220px] bg-slate-900 flex-col z-50">
        <div className="p-5 border-b border-slate-700">
          <h1 className="text-white font-extrabold text-lg tracking-tight">📒 Shop Ledger</h1>
          <p className="text-slate-400 text-xs mt-1">{user.name} ({user.role})</p>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`w-full flex items-center gap-3 px-5 py-3.5 text-left text-[15px] transition ${page === n.id ? "bg-blue-600/20 text-blue-400 font-semibold border-r-3 border-blue-400" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
              <Icon name={n.icon} size={20} /><span>{n.label}</span>
            </button>
          ))}
        </nav>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-3 px-5 py-4 text-slate-400 hover:text-white hover:bg-slate-800 border-t border-slate-700 transition">
          <Icon name="refresh" size={20} /><span>{refreshing ? "Refreshing..." : "Refresh Data"}</span>
        </button>
        <button onClick={logout} className="flex items-center gap-3 px-5 py-4 text-slate-400 hover:text-white hover:bg-slate-800 border-t border-slate-700 transition">
          <Icon name="logout" size={20} /><span>Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-[220px] pb-28 md:pb-24 lg:pb-6">
        {/* Header (mobile + tablet) */}
        <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-slate-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <h1 className="font-extrabold text-lg md:text-xl text-slate-800">📒 Shop Ledger</h1>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="text-xs md:text-sm text-slate-500 bg-slate-100 px-2 md:px-3 py-1 md:py-1.5 rounded-full font-medium">{user.name}</span>
            <button onClick={handleRefresh} disabled={refreshing} className={`w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full hover:bg-blue-100 bg-blue-50 transition ${refreshing ? "animate-spin" : ""}`}>
              <Icon name="refresh" size={18} color="#2563eb" />
            </button>
            <button onClick={logout} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center rounded-full hover:bg-slate-100 bg-slate-50">
              <Icon name="logout" size={18} color="#64748b" />
            </button>
          </div>
        </header>

        <div className="p-4 md:p-6 lg:p-6 max-w-7xl mx-auto">
          {page === "dashboard" && <Dashboard {...{ suppliers, products, purchases, purchaseItems, payments, returns, getOutstanding, setPage, notify, user }} />}
          {page === "suppliers" && <Suppliers {...{ suppliers, getOutstanding, notify, askConfirm, purchases, purchaseItems, payments, returns, getInvoiceAllocations, paymentAllocations }} />}
          {page === "products" && <Products {...{ products, getLastPrice, notify, askConfirm }} />}
          {page === "purchases" && <Purchases {...{ suppliers, products, purchases, purchaseItems, getOutstanding, getLastPrice, notify, askConfirm, refreshAll, purchaseDraftRef, getInvoiceAllocations, payments }} />}
          {page === "payments" && <Payments {...{ suppliers, payments, paymentAllocations, getOutstanding, notify, askConfirm, refreshAll, computeFifoPreview, getPaymentAllocations, getUnpaidInvoices, purchases, purchaseItems, products }} />}
          {page === "returns" && <Returns {...{ suppliers, products, returns, returnItems, getOutstanding, notify, askConfirm, refreshAll }} />}
          {page === "price-check" && <PriceCheck {...{ products, purchaseItems, purchases, suppliers, getLastPrice }} />}
          {page === "reports" && <Reports {...{ suppliers, products, purchases, purchaseItems, payments, returns, returnItems, getOutstanding, paymentAllocations }} />}
        </div>
      </main>

      {/* Bottom Nav — Mobile: 6 items with More | Tablet: ALL items visible, bigger */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 safe-bottom shadow-[0_-2px_10px_rgba(0,0,0,0.08)]">
        {/* Mobile bottom nav (< 768px) — compact with More overflow */}
        <div className="md:hidden flex">
          {navItems.slice(0, 5).map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`flex-1 min-w-[64px] flex flex-col items-center gap-0.5 py-2.5 px-1 text-[11px] transition ${page === n.id ? "text-blue-600 font-bold" : "text-slate-400"}`}>
              <Icon name={n.icon} size={22} color={page === n.id ? "#2563eb" : "#94a3b8"} />
              <span>{n.label}</span>
            </button>
          ))}
          <button onClick={() => setPage(page === "more" ? "dashboard" : "more")}
            className={`flex-1 min-w-[64px] flex flex-col items-center gap-0.5 py-2.5 px-1 text-[11px] ${["products","price-check","reports"].includes(page) ? "text-blue-600 font-bold" : "text-slate-400"}`}>
            <Icon name="down" size={22} color={["products","price-check","reports"].includes(page) ? "#2563eb" : "#94a3b8"} />
            <span>More</span>
          </button>
        </div>
        {/* Mobile More overflow */}
        {page === "more" && (
          <div className="md:hidden border-t border-slate-100 flex flex-wrap gap-2 p-3 bg-white">
            {navItems.slice(5).map(n => (
              <button key={n.id} onClick={() => setPage(n.id)}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-200 transition">
                <Icon name={n.icon} size={18} />{n.label}
              </button>
            ))}
          </div>
        )}

        {/* Tablet bottom nav (768px+) — ALL items visible, bigger touch targets */}
        <div className="hidden md:flex lg:hidden">
          {navItems.map(n => (
            <button key={n.id} onClick={() => setPage(n.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-[13px] font-medium transition ${page === n.id ? "text-blue-600 font-bold bg-blue-50" : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"}`}>
              <div className={`w-11 h-11 flex items-center justify-center rounded-xl transition ${page === n.id ? "bg-blue-100" : ""}`}>
                <Icon name={n.icon} size={24} color={page === n.id ? "#2563eb" : "#94a3b8"} />
              </div>
              <span>{n.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

// ═══════════════════════════════════════
//  LOGIN SCREEN
// ═══════════════════════════════════════
function LoginScreen({ users, onLogin }) {
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    const u = users.find(u => u.id === selected);
    if (u && u.pin === pin) { onLogin(u); }
    else { setError("Incorrect PIN. Try again."); setPin(""); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">📒</div>
          <h1 className="text-2xl font-extrabold text-slate-800">Shop Ledger</h1>
          <p className="text-slate-500 mt-1">Supplier Purchase Management</p>
          <p className="text-xs text-emerald-600 mt-2 font-medium">☁️ Cloud Connected</p>
        </div>

        {!selected ? (
          <div>
            <p className="text-sm font-semibold text-slate-600 mb-3">Who's logging in?</p>
            <div className="space-y-3">
              {users.filter(u => u.is_active).map(u => (
                <button key={u.id} onClick={() => setSelected(u.id)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:bg-blue-50 transition text-left">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">{u.name[0]}</div>
                  <div>
                    <p className="font-bold text-slate-800 text-lg">{u.name}</p>
                    <p className="text-sm text-slate-500 capitalize">{u.role}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button onClick={() => { setSelected(null); setPin(""); setError(""); }}
              className="flex items-center gap-1 text-sm text-blue-600 mb-4 hover:underline"><Icon name="back" size={16} /> Back</button>
            <p className="text-sm font-semibold text-slate-600 mb-3">Enter your PIN</p>
            <input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g,"")); setError(""); }}
              className="w-full text-center text-3xl tracking-[0.5em] py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none mb-4"
              placeholder="• • • •" autoFocus onKeyDown={e => e.key === "Enter" && pin.length >= 4 && handleSubmit()} />
            {error && <p className="text-red-500 text-sm text-center mb-3">{error}</p>}
            <button onClick={handleSubmit} disabled={pin.length < 4}
              className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-lg disabled:opacity-40 hover:bg-blue-700 transition">
              Login
            </button>
          </div>
        )}
        <p className="text-center text-xs text-slate-400 mt-6">Default PINs — Admin: 1234, Father: 0000</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  DASHBOARD
// ═══════════════════════════════════════
function Dashboard({ suppliers, products, purchases, purchaseItems, payments, returns, getOutstanding, setPage, notify, user }) {
  const totalOutstanding = suppliers.data.filter(s => s.is_active).reduce((s, sup) => s + getOutstanding(sup.id), 0);
  const top5 = suppliers.data.filter(s => s.is_active).map(s => ({ ...s, outstanding: getOutstanding(s.id) })).filter(s => s.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding).slice(0, 5);

  const now = new Date();
  const weekAgo = new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const recentPurchases = purchases.data.filter(p => p.invoice_date >= weekAgo).sort((a, b) => b.invoice_date.localeCompare(a.invoice_date)).slice(0, 5);
  const recentPayments = payments.data.filter(p => p.payment_date >= weekAgo).sort((a, b) => b.payment_date.localeCompare(a.payment_date)).slice(0, 5);

  const monthPurchases = purchases.data.filter(p => p.invoice_date >= monthStart).reduce((s, p) => s + p.total_amount, 0);
  const monthPayments = payments.data.filter(p => p.payment_date >= monthStart).reduce((s, p) => s + p.amount, 0);
  const monthReturns = returns.data.filter(r => r.return_date >= monthStart).reduce((s, r) => s + r.total_amount, 0);

  const getSuppName = (id) => suppliers.data.find(s => s.id === id)?.name || "Unknown";

  return (
    <div className="space-y-5">
      {/* Outstanding Banner */}
      <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-2xl p-6 md:p-8 text-white shadow-lg">
        <p className="text-red-100 text-sm md:text-base font-medium mb-1">Total Outstanding</p>
        <p className="text-3xl md:text-4xl lg:text-4xl font-extrabold">{LKR(totalOutstanding)}</p>
        <p className="text-red-200 text-sm md:text-base mt-2">{suppliers.data.filter(s => s.is_active && getOutstanding(s.id) > 0).length} suppliers with balance</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "New Purchase", icon: "cart", color: "bg-blue-600 hover:bg-blue-700", page: "purchases" },
          { label: "New Payment", icon: "money", color: "bg-emerald-600 hover:bg-emerald-700", page: "payments" },
          { label: "New Return", icon: "ret", color: "bg-orange-500 hover:bg-orange-600", page: "returns" },
          { label: "Price Check", icon: "tag", color: "bg-violet-600 hover:bg-violet-700", page: "price-check" },
        ].map(a => (
          <button key={a.label} onClick={() => setPage(a.page)}
            className={`${a.color} text-white rounded-xl p-4 md:p-5 flex flex-col items-center gap-2 md:gap-3 transition shadow-md min-h-[80px] md:min-h-[100px]`}>
            <Icon name={a.icon} size={28} />
            <span className="text-sm md:text-base font-bold">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Month Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <p className="text-xs text-blue-600 font-semibold">This Month Purchases</p>
          <p className="text-lg font-extrabold text-blue-700 mt-1">{LKR(monthPurchases)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <p className="text-xs text-emerald-600 font-semibold">Payments</p>
          <p className="text-lg font-extrabold text-emerald-700 mt-1">{LKR(monthPayments)}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <p className="text-xs text-orange-600 font-semibold">Returns</p>
          <p className="text-lg font-extrabold text-orange-700 mt-1">{LKR(monthReturns)}</p>
        </div>
      </div>

      {/* Two Column: Top Suppliers + Recent */}
      <div className="grid md:grid-cols-2 gap-5">
        {/* Top 5 Outstanding */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Top Suppliers Owing</h3>
          </div>
          <div className="p-3 space-y-2">
            {top5.length ? top5.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <span className="font-semibold text-slate-700">{s.name}</span>
                </div>
                <span className="font-bold text-red-600">{LKR(s.outstanding)}</span>
              </div>
            )) : <Empty icon="check" text="All settled!" sub="No outstanding balances" />}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Recent Purchases (7 days)</h3>
          </div>
          <div className="p-3 space-y-2">
            {recentPurchases.length ? recentPurchases.map(p => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50">
                <div>
                  <p className="font-semibold text-slate-700">{getSuppName(p.supplier_id)}</p>
                  <p className="text-xs text-slate-400">{fmtDate(p.invoice_date)} • {p.payment_type}</p>
                </div>
                <span className="font-bold text-blue-600">{LKR(p.total_amount)}</span>
              </div>
            )) : <Empty icon="cart" text="No recent purchases" />}
          </div>
        </div>
      </div>

      {/* Recent Payments */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-800">Recent Payments (7 days)</h3>
        </div>
        <div className="p-3 space-y-2">
          {recentPayments.length ? recentPayments.map(p => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-50">
              <div>
                <p className="font-semibold text-slate-700">{getSuppName(p.supplier_id)}</p>
                <p className="text-xs text-slate-400">{fmtDate(p.payment_date)} • {p.payment_method}</p>
              </div>
              <span className="font-bold text-emerald-600">{LKR(p.amount)}</span>
            </div>
          )) : <Empty icon="money" text="No recent payments" />}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
//  SUPPLIERS
// ═══════════════════════════════════════
function Suppliers({ suppliers, getOutstanding, notify, askConfirm, purchases, purchaseItems, payments, returns, getInvoiceAllocations, paymentAllocations }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", opening_balance: "", opening_balance_date: "" });
  const [viewSupplier, setViewSupplier] = useState(null);
  const [viewInvoice, setViewInvoice] = useState(null);

  const filtered = suppliers.data.filter(s => s.is_active && s.name.toLowerCase().includes(search.toLowerCase()));

  const openNew = () => { setForm({ name: "", phone: "", address: "", notes: "", opening_balance: "", opening_balance_date: "" }); setEditing(null); setShowForm(true); };
  const openEdit = (s) => { setForm({ name: s.name, phone: s.phone || "", address: s.address || "", notes: s.notes || "", opening_balance: s.opening_balance ? String(s.opening_balance) : "", opening_balance_date: s.opening_balance_date || "" }); setEditing(s.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return notify("Supplier name is required", "error");
    const saveData = {
      ...form,
      opening_balance: form.opening_balance ? parseFloat(form.opening_balance) : 0,
      opening_balance_date: form.opening_balance_date || null,
    };
    if (editing) {
      await suppliers.update(editing, saveData);
      notify("Supplier updated");
    } else {
      await suppliers.add({ ...saveData, is_active: true });
      notify("Supplier added");
    }
    setShowForm(false);
  };

  const handleDeactivate = (s) => {
    askConfirm("Deactivate Supplier?", `Are you sure you want to deactivate "${s.name}"? They won't appear in lists but history is kept.`,
      async () => { await suppliers.update(s.id, { is_active: false }); await refreshAll(); notify("Supplier deactivated"); }, true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">Suppliers</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-5 md:px-6 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg hover:bg-blue-700 transition shadow-md">
          <Icon name="plus" size={20} /> Add Supplier
        </button>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Search suppliers..." />

      <div className="space-y-3">
        {filtered.length ? filtered.map(s => {
          const out = getOutstanding(s.id);
          return (
            <div key={s.id} onClick={() => setViewSupplier(s)} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition cursor-pointer active:bg-slate-50">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-slate-800 truncate">{s.name}</p>
                {s.phone && <p className="text-sm text-slate-500">{s.phone}</p>}
                <p className="text-xs text-blue-500 mt-1">Tap to view details →</p>
              </div>
              <div className="text-right ml-3">
                <p className={`font-extrabold text-lg ${out > 0 ? "text-red-600" : "text-emerald-600"}`}>{LKR(out)}</p>
                <p className="text-xs text-slate-400">{out > 0 ? "Outstanding" : "Settled"}</p>
              </div>
              <div className="flex gap-1 ml-3">
                <button onClick={(e) => { e.stopPropagation(); openEdit(s); }} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100"><Icon name="edit" size={18} color="#64748b" /></button>
                <button onClick={(e) => { e.stopPropagation(); handleDeactivate(s); }} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-red-50"><Icon name="trash" size={18} color="#ef4444" /></button>
              </div>
            </div>
          );
        }) : <Empty icon="users" text="No suppliers found" sub={search ? "Try a different search" : "Add your first supplier"} />}
      </div>

      {/* Supplier Detail Modal */}
      {viewSupplier && (
        <Modal title={viewSupplier.name} onClose={() => setViewSupplier(null)} wide>
          {(() => {
            const s = viewSupplier;
            const out = getOutstanding(s.id);
            const suppPurchases = purchases.data.filter(p => p.supplier_id === s.id).sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
            const suppPayments = payments.data.filter(p => p.supplier_id === s.id).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
            const suppReturns = returns.data.filter(r => r.supplier_id === s.id).sort((a, b) => b.return_date.localeCompare(a.return_date));
            const totalPurchased = suppPurchases.reduce((sum, p) => sum + p.total_amount, 0);
            const totalPaid = suppPayments.reduce((sum, p) => sum + p.amount, 0);
            const totalReturned = suppReturns.reduce((sum, r) => sum + r.total_amount, 0);

            return (
              <div className="space-y-5">
                {/* Summary Banner */}
                <div className={`rounded-xl p-4 md:p-5 ${out > 0 ? "bg-red-50 border border-red-200" : "bg-emerald-50 border border-emerald-200"}`}>
                  <p className="text-sm font-semibold text-slate-600 mb-1">Outstanding Balance</p>
                  <p className={`text-3xl font-extrabold ${out > 0 ? "text-red-600" : "text-emerald-600"}`}>{LKR(out)}</p>
                </div>

                {/* Opening Balance */}
                {(s.opening_balance > 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-amber-700">📒 Opening Balance (B/F)</p>
                      {s.opening_balance_date && <p className="text-xs text-amber-600">As at {fmtDate(s.opening_balance_date)}</p>}
                    </div>
                    <p className="font-extrabold text-amber-700">{LKR(s.opening_balance)}</p>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-blue-600 font-semibold">Purchased</p>
                    <p className="text-base md:text-lg font-extrabold text-blue-700">{LKR(totalPurchased)}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-emerald-600 font-semibold">Paid</p>
                    <p className="text-base md:text-lg font-extrabold text-emerald-700">{LKR(totalPaid)}</p>
                  </div>
                  <div className="bg-orange-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-orange-600 font-semibold">Returned</p>
                    <p className="text-base md:text-lg font-extrabold text-orange-700">{LKR(totalReturned)}</p>
                  </div>
                </div>

                {/* Contact Info */}
                {(s.phone || s.address) && (
                  <div className="bg-slate-50 rounded-xl p-4">
                    {s.phone && <p className="text-sm text-slate-600">📞 {s.phone}</p>}
                    {s.address && <p className="text-sm text-slate-600 mt-1">📍 {s.address}</p>}
                  </div>
                )}

                {/* Purchases */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">📦 Purchases ({suppPurchases.length})</h4>
                  {suppPurchases.length ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {suppPurchases.map(p => {
                        const allocs = getInvoiceAllocations(p.id);
                        const totalAllocated = allocs.reduce((sum, a) => sum + a.allocated_amount, 0);
                        const creditAmount = (p.payment_type === "Credit" || p.payment_type === "Partial") ? p.total_amount - (p.amount_paid || 0) : 0;
                        const fullySettled = creditAmount > 0 && totalAllocated >= creditAmount;
                        return (
                        <div key={p.id} onClick={() => setViewInvoice(p)} className={`bg-white border rounded-xl p-3 flex justify-between items-center cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition active:bg-blue-100 ${fullySettled ? "border-emerald-200" : "border-slate-200"}`}>
                          <div>
                            <p className="font-semibold text-slate-700">{fmtDate(p.invoice_date)} {p.invoice_number ? `• #${p.invoice_number}` : ""}</p>
                            <p className="text-xs text-slate-400">{p.payment_type}</p>
                            {fullySettled && <p className="text-xs text-emerald-600 font-bold">✓ Settled via FIFO</p>}
                            {!fullySettled && totalAllocated > 0 && <p className="text-xs text-amber-600 font-medium">Partly settled: {LKR(totalAllocated)}</p>}
                          </div>
                          <p className="font-bold text-blue-600">{LKR(p.total_amount)}</p>
                        </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-slate-400">No purchases yet</p>}
                </div>

                {/* Payments */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">💰 Payments ({suppPayments.length})</h4>
                  {suppPayments.length ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {suppPayments.map(p => {
                        const allocs = paymentAllocations.data.filter(a => a.payment_id === p.id);
                        const invoiceRefs = allocs.map(a => {
                          const inv = purchases.data.find(pu => pu.id === a.purchase_id);
                          return `#${inv?.invoice_number || "N/A"}`;
                        });
                        return (
                        <div key={p.id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-slate-700">{fmtDate(p.payment_date)}</p>
                            <p className="text-xs text-slate-400">{p.payment_method} {p.reference_number ? `• Ref: ${p.reference_number}` : ""}</p>
                            {invoiceRefs.length > 0 && <p className="text-xs text-blue-600 font-medium">→ {invoiceRefs.join(", ")}</p>}
                          </div>
                          <p className="font-bold text-emerald-600">{LKR(p.amount)}</p>
                        </div>
                        );
                      })}
                    </div>
                  ) : <p className="text-sm text-slate-400">No payments yet</p>}
                </div>

                {/* Returns */}
                {suppReturns.length > 0 && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2">↩️ Returns ({suppReturns.length})</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {suppReturns.map(r => (
                        <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-3 flex justify-between items-center">
                          <div>
                            <p className="font-semibold text-slate-700">{fmtDate(r.return_date)}</p>
                            <p className="text-xs text-slate-400">{r.reason || "No reason"}</p>
                          </div>
                          <p className="font-bold text-orange-600">{LKR(r.total_amount)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </Modal>
      )}

      {viewInvoice && (() => {
        const p = viewInvoice;
        const supp = suppliers.data.find(s => s.id === p.supplier_id);
        const pItems = purchaseItems.data.filter(i => i.purchase_id === p.id);
        return (
          <Modal title="Invoice Details" onClose={() => setViewInvoice(null)} wide>
            <div className="space-y-5">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-extrabold text-xl text-slate-800">{supp?.name}</p>
                    <p className="text-sm text-slate-500 mt-1">{fmtDate(p.invoice_date)}</p>
                    {p.invoice_number && <p className="text-sm text-slate-500">Invoice #: {p.invoice_number}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-blue-700">{LKR(p.total_amount)}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full mt-1 inline-block ${p.payment_type === "Cash" ? "bg-emerald-100 text-emerald-700" : p.payment_type === "Credit" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{p.payment_type}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-bold text-slate-700 mb-2">📦 Items ({pItems.length})</h4>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="grid grid-cols-4 gap-2 px-4 py-2 bg-slate-50 text-xs font-semibold text-slate-500">
                    <span>Product</span><span className="text-center">Qty</span><span className="text-center">Price</span><span className="text-right">Amount</span>
                  </div>
                  {pItems.map(item => (
                    <div key={item.id} className="grid grid-cols-4 gap-2 px-4 py-3 border-t border-slate-100 items-center">
                      <div><p className="font-medium text-slate-700 text-sm">{item.product_name}</p>{item.packing_size && item.price_per === "packing_unit" && <p className="text-xs text-amber-600">{item.quantity} {item.unit} × {item.packing_size} {item.packing_unit}</p>}</div>
                      <p className="text-center text-sm text-slate-600">{item.quantity} {item.unit}</p>
                      <p className="text-center text-sm text-slate-600">{shortLKR(item.unit_price)}/{item.price_label || item.unit}</p>
                      <p className="text-right font-bold text-blue-600 text-sm">{LKR(item.line_total)}</p>
                    </div>
                  ))}
                  <div className="grid grid-cols-4 gap-2 px-4 py-3 bg-blue-50 border-t-2 border-blue-200">
                    <span className="col-span-3 font-bold text-right">Total:</span>
                    <span className="font-extrabold text-blue-700 text-right text-lg">{LKR(p.total_amount)}</span>
                  </div>
                </div>
              </div>
              {(p.payment_type === "Credit" || p.payment_type === "Partial") && (
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">💳 Payment</h4>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between"><span className="text-slate-500">Type:</span><span className="font-semibold">{p.payment_type}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Invoice Total:</span><span className="font-semibold">{LKR(p.total_amount)}</span></div>
                    {p.amount_paid > 0 && <div className="flex justify-between"><span className="text-slate-500">Paid:</span><span className="font-semibold text-emerald-600">{LKR(p.amount_paid)}</span></div>}
                    <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-red-600 font-semibold">Remaining:</span><span className="font-extrabold text-red-600">{LKR(parseFloat(p.total_amount) - (parseFloat(p.amount_paid) || 0))}</span></div>
                  </div>
                </div>
              )}
              {p.notes && <div className="bg-slate-50 rounded-xl p-3"><p className="text-sm text-slate-600">{p.notes}</p></div>}
            </div>
          </Modal>
        );
      })()}

      {showForm && (
        <Modal title={editing ? "Edit Supplier" : "Add Supplier"} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg" placeholder="Supplier name" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" placeholder="Phone number" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Address</label>
              <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" placeholder="Address" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" rows={2} placeholder="Optional notes" />
            </div>

            {/* Opening Balance */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📒</span>
                <div>
                  <p className="font-bold text-slate-700 text-sm">Opening Balance</p>
                  <p className="text-xs text-slate-500">Amount already owed to this supplier before using this app</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (LKR)</label>
                <input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg font-bold text-center" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">As at date</label>
                <input type="date" value={form.opening_balance_date} onChange={e => setForm({ ...form, opening_balance_date: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" />
              </div>
            </div>

            <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition">
              <Icon name="save" size={20} /> {editing ? "Update Supplier" : "Save Supplier"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  PRODUCTS
// ═══════════════════════════════════════
function Products({ products, getLastPrice, notify, askConfirm }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Commodity", default_unit: "bag", packing_size: "", packing_unit: "kg", price_per: "packing_unit", notes: "" });

  const categories = ["Commodity", "Packed Food", "Beverages", "Other"];
  const units = ["kg", "g", "L", "mL", "piece", "packet", "bag", "box", "case", "can", "bottle", "dozen"];
  const priceUnits = ["kg", "g", "L", "mL", "piece", "packet", "bag", "box", "case", "can", "bottle", "dozen"];

  const filtered = products.data.filter(p => p.is_active && (p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())));

  const openNew = () => { setForm({ name: "", category: "Commodity", default_unit: "bag", packing_size: "", packing_unit: "kg", price_per: "packing_unit", notes: "" }); setEditing(null); setShowForm(true); };
  const openEdit = (p) => { setForm({ name: p.name, category: p.category, default_unit: p.default_unit, packing_size: p.packing_size || "", packing_unit: p.packing_unit || "kg", price_per: p.price_per || "packing_unit", notes: p.notes || "" }); setEditing(p.id); setShowForm(true); };

  const handleSave = async () => {
    if (!form.name.trim()) return notify("Product name is required", "error");
    const saveData = { ...form, packing_size: form.packing_size ? parseFloat(form.packing_size) : null };
    if (editing) {
      await products.update(editing, saveData);
      notify("Product updated");
    } else {
      await products.add({ ...saveData, is_active: true });
      notify("Product added");
    }
    setShowForm(false);
  };

  const getPackingLabel = (p) => {
    if (p.packing_size && p.packing_unit) return `1 ${p.default_unit} = ${p.packing_size} ${p.packing_unit}`;
    return p.default_unit;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">Products</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-5 md:px-6 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg hover:bg-blue-700 transition shadow-md">
          <Icon name="plus" size={20} /> Add Product
        </button>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Search products..." />

      <div className="space-y-3">
        {filtered.length ? filtered.map(p => {
          const lp = getLastPrice(p.id);
          return (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg text-slate-800 truncate">{p.name}</p>
                <p className="text-sm text-slate-500">{p.category} • {getPackingLabel(p)}</p>
                {p.packing_size && <p className="text-xs text-slate-400">Price per {p.price_per === "packing_unit" ? p.packing_unit : p.default_unit}</p>}
              </div>
              <div className="text-right ml-3">
                {lp ? (
                  <>
                    <p className="font-extrabold text-blue-600">{LKR(lp.price)}/{lp.unit}</p>
                    <p className="text-xs text-slate-400">{fmtDate(lp.date)} • {lp.supplier}</p>
                  </>
                ) : <p className="text-sm text-slate-400">No purchases yet</p>}
              </div>
              <div className="flex gap-1 ml-3">
                <button onClick={() => openEdit(p)} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-100"><Icon name="edit" size={18} color="#64748b" /></button>
              </div>
            </div>
          );
        }) : <Empty icon="box" text="No products found" sub={search ? "Try a different search" : "Add your first product"} />}
      </div>

      {showForm && (
        <Modal title={editing ? "Edit Product" : "Add Product"} onClose={() => setShowForm(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Name *</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg" placeholder="e.g. White Sugar Indian 50Kg" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map(c => (
                  <button key={c} onClick={() => setForm({ ...form, category: c })}
                    className={`py-3 rounded-xl border-2 font-semibold transition ${form.category === c ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{c}</button>
                ))}
              </div>
            </div>

            {/* Buying Unit */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">I buy this in (Buying Unit)</label>
              <p className="text-xs text-slate-400 mb-2">The unit you count when buying. e.g. Bags, Cases, Cans</p>
              <div className="flex flex-wrap gap-2">
                {units.map(u => (
                  <button key={u} onClick={() => setForm({ ...form, default_unit: u })}
                    className={`px-4 py-2.5 rounded-xl border-2 font-medium transition ${form.default_unit === u ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{u}</button>
                ))}
              </div>
            </div>

            {/* Packing Size */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <div>
                <label className="block text-sm font-bold text-amber-800 mb-1">📦 Packing Size (Optional)</label>
                <p className="text-xs text-amber-700 mb-2">If the price is per a smaller unit inside the pack. e.g. 1 Bag = 50 Kg, and price is per Kg</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">How many?</label>
                  <input type="number" value={form.packing_size} onChange={e => setForm({ ...form, packing_size: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 outline-none text-lg text-center" placeholder="e.g. 50" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Of what unit?</label>
                  <select value={form.packing_unit} onChange={e => setForm({ ...form, packing_unit: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-amber-500 outline-none bg-white text-lg">
                    {priceUnits.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              {form.packing_size && (
                <div className="bg-white rounded-lg p-3 border border-amber-200">
                  <p className="text-sm font-semibold text-amber-800">
                    ✅ 1 {form.default_unit} = {form.packing_size} {form.packing_unit}
                  </p>
                  <div className="mt-2">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Price is mentioned per:</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setForm({ ...form, price_per: "packing_unit" })}
                        className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition ${form.price_per === "packing_unit" ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-200 text-slate-600"}`}>
                        Per {form.packing_unit} <span className="block text-xs font-normal">e.g. LKR 195/kg</span>
                      </button>
                      <button onClick={() => setForm({ ...form, price_per: "buying_unit" })}
                        className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition ${form.price_per === "buying_unit" ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-200 text-slate-600"}`}>
                        Per {form.default_unit} <span className="block text-xs font-normal">e.g. LKR 9750/bag</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" rows={2} placeholder="Optional notes" />
            </div>
            <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition">
              {editing ? "Update Product" : "Save Product"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  PURCHASES
// ═══════════════════════════════════════
function Purchases({ suppliers, products, purchases, purchaseItems, getOutstanding, getLastPrice, notify, askConfirm, refreshAll, purchaseDraftRef, getInvoiceAllocations, payments }) {
  // Check if there's a draft to restore on mount
  const draft = purchaseDraftRef.current;
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);
  const [showDraftBanner, setShowDraftBanner] = useState(!!draft);
  const [viewPurchase, setViewPurchase] = useState(null);

  // purchase form state
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [paymentType, setPaymentType] = useState("Credit");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);

  // add item form
  const [itemProductId, setItemProductId] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemUnit, setItemUnit] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [showAddItem, setShowAddItem] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const units = ["kg", "g", "L", "mL", "piece", "packet", "bag", "box", "case", "can", "bottle", "dozen"];

  const activeSuppliers = suppliers.data.filter(s => s.is_active);
  const activeProducts = products.data.filter(p => p.is_active);

  const invoiceTotal = items.reduce((s, i) => s + i.line_total, 0);

  // Check draft on every mount (component re-mounts when navigating back)
  useEffect(() => {
    if (purchaseDraftRef.current) {
      setShowDraftBanner(true);
    }
  }, []);

  // ── Save draft when closing the form ──
  const saveDraftAndClose = () => {
    if (supplierId || items.length > 0) {
      purchaseDraftRef.current = { supplierId, invoiceNo, invoiceDate, paymentType, amountPaid, notes, items, editing };
    }
    setShowForm(false);
  };

  // ── Restore draft into form ──
  const restoreDraft = () => {
    const d = purchaseDraftRef.current;
    if (!d) return;
    setSupplierId(d.supplierId || "");
    setInvoiceNo(d.invoiceNo || "");
    setInvoiceDate(d.invoiceDate || today());
    setPaymentType(d.paymentType || "Credit");
    setAmountPaid(d.amountPaid || "");
    setNotes(d.notes || "");
    setItems(d.items || []);
    setEditing(d.editing || null);
    purchaseDraftRef.current = null;
    setShowDraftBanner(false);
    setShowForm(true);
    notify("Draft restored!", "success");
  };

  const clearDraft = () => {
    purchaseDraftRef.current = null;
    setShowDraftBanner(false);
  };

  const filteredPurchases = purchases.data.filter(p => {
    const supp = suppliers.data.find(s => s.id === p.supplier_id);
    return !search || (supp?.name || "").toLowerCase().includes(search.toLowerCase()) || (p.invoice_number || "").toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));

  const resetForm = () => {
    setSupplierId(""); setInvoiceNo(""); setInvoiceDate(today());
    setPaymentType("Credit"); setAmountPaid(""); setNotes(""); setItems([]);
    setEditing(null); clearDraft();
  };

  const openNew = () => { resetForm(); setShowForm(true); };

  const openEdit = (p) => {
    setSupplierId(p.supplier_id);
    setInvoiceNo(p.invoice_number || "");
    setInvoiceDate(p.invoice_date);
    setPaymentType(p.payment_type);
    setAmountPaid(p.amount_paid ? String(p.amount_paid) : "");
    setNotes(p.notes || "");
    const pItems = purchaseItems.data.filter(i => i.purchase_id === p.id).map(i => ({
      ...i,
      product_name: products.data.find(pr => pr.id === i.product_id)?.name || "Unknown"
    }));
    setItems(pItems);
    setEditing(p.id);
    setShowForm(true);
  };

  const addItem = () => {
    if (!itemProductId) return notify("Select a product", "error");
    if (!itemQty || parseFloat(itemQty) <= 0) return notify("Enter valid quantity", "error");
    if (!itemPrice || parseFloat(itemPrice) <= 0) return notify("Enter valid price", "error");

    const prod = activeProducts.find(p => p.id === itemProductId);
    const qty = parseFloat(itemQty);
    const price = parseFloat(itemPrice);
    const unit = itemUnit || prod?.default_unit || "kg";

    // Calculate line total based on packing size
    // If product has packing_size and price_per is "packing_unit":
    //   e.g. 50 Bags × 50 kg/bag × 195 per kg = 487,500
    // If price_per is "buying_unit" or no packing_size:
    //   e.g. 50 Bags × 9750 per bag = 487,500
    let lineTotal;
    let priceLabel;
    const packSize = prod?.packing_size;
    const packUnit = prod?.packing_unit;
    const pricePer = prod?.price_per || "buying_unit";

    if (packSize && pricePer === "packing_unit") {
      // Price is per inner unit (e.g. per Kg), multiply by packing size
      lineTotal = Math.round(qty * packSize * price * 100) / 100;
      priceLabel = `${packUnit}`;
    } else {
      // Price is per buying unit (e.g. per Bag) or no packing info
      lineTotal = Math.round(qty * price * 100) / 100;
      priceLabel = unit;
    }

    setItems([...items, {
      id: genId(), product_id: itemProductId, product_name: prod?.name || "",
      quantity: qty, unit: unit,
      unit_price: price, line_total: lineTotal,
      packing_size: packSize || null,
      packing_unit: packUnit || null,
      price_per: pricePer,
      price_label: priceLabel
    }]);

    setItemProductId(""); setItemQty(""); setItemUnit(""); setItemPrice(""); setProductSearch(""); setShowAddItem(false);
  };

  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!supplierId) return notify("Select a supplier", "error");
    if (items.length === 0) return notify("Add at least one item", "error");

    // Duplicate invoice check
    if (invoiceNo) {
      const dup = purchases.data.find(p => p.invoice_number === invoiceNo && p.supplier_id === supplierId && p.id !== editing);
      if (dup) return notify("Duplicate invoice! This invoice number already exists for this supplier.", "warning");
    }

    const total = items.reduce((s, i) => s + i.line_total, 0);
    const paid = paymentType === "Cash" ? total : paymentType === "Credit" ? 0 : parseFloat(amountPaid) || 0;

    if (editing) {
      // Remove old items from Supabase
      await sbDelete("purchase_items", "purchase_id=eq." + editing);
      await purchases.update(editing, { supplier_id: supplierId, invoice_number: invoiceNo, invoice_date: invoiceDate, payment_type: paymentType, total_amount: total, amount_paid: paid, notes });
      const newItems = items.map(i => { const { id, ...rest } = i; return { ...rest, purchase_id: editing }; });
      if (newItems.length) await sbInsert("purchase_items", newItems);
      notify("Purchase updated");
    } else {
      const result = await purchases.add({ supplier_id: supplierId, invoice_number: invoiceNo, invoice_date: invoiceDate, payment_type: paymentType, total_amount: total, amount_paid: paid, notes });
      if (result && result.id) {
        const newItems = items.map(i => { const { id, ...rest } = i; return { ...rest, purchase_id: result.id }; });
        if (newItems.length) await sbInsert("purchase_items", newItems);
      }
      notify("Purchase saved");
    }
    setShowForm(false); resetForm(); await refreshAll();
  };

  const handleDelete = (p) => {
    askConfirm("Delete Purchase?", `Delete purchase from ${suppliers.data.find(s => s.id === p.supplier_id)?.name}? This cannot be undone.`, async () => {
      await purchases.remove(p.id);
      await refreshAll(); notify("Purchase deleted");
    }, true);
  };

  const filteredProductsForAdd = activeProducts.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">Purchases</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-blue-600 text-white px-5 md:px-6 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg hover:bg-blue-700 transition shadow-md">
          <Icon name="plus" size={20} /> New Purchase
        </button>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Search by supplier or invoice..." />

      {/* Draft Banner — shows when there's a saved draft and form is closed */}
      {showDraftBanner && !showForm && purchaseDraftRef.current && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 md:p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0">
              <Icon name="edit" size={24} />
            </div>
            <div>
              <p className="font-bold text-amber-800 text-lg md:text-xl">📋 Unsaved Invoice Draft</p>
              <p className="text-sm md:text-base text-amber-600">
                {(() => {
                  const d = purchaseDraftRef.current;
                  const sName = suppliers.data.find(s => s.id === d?.supplierId)?.name;
                  const iCount = d?.items?.length || 0;
                  return <>
                    {sName ? `Supplier: ${sName}` : "Draft saved"}
                    {iCount > 0 ? ` • ${iCount} item${iCount > 1 ? "s" : ""}` : ""}
                  </>;
                })()}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={restoreDraft} className="flex-1 py-3 md:py-4 text-base md:text-lg font-bold text-white bg-amber-600 rounded-xl hover:bg-amber-700 transition shadow-md flex items-center justify-center gap-2">
              <Icon name="edit" size={20} /> Continue Editing
            </button>
            <button onClick={clearDraft} className="px-4 md:px-5 py-3 md:py-4 text-base font-semibold text-slate-600 bg-white border-2 border-slate-200 rounded-xl hover:bg-slate-50 transition">
              Discard
            </button>
          </div>
        </div>
      )}

      {/* Purchase List */}
      <div className="space-y-3">
        {filteredPurchases.length ? filteredPurchases.map(p => {
          const supp = suppliers.data.find(s => s.id === p.supplier_id);
          const pItems = purchaseItems.data.filter(i => i.purchase_id === p.id);
          const allocs = getInvoiceAllocations(p.id);
          const totalAllocated = allocs.reduce((s, a) => s + a.allocated_amount, 0);
          const creditAmount = (p.payment_type === "Credit" || p.payment_type === "Partial") ? p.total_amount - (p.amount_paid || 0) : 0;
          const fullySettled = creditAmount > 0 && totalAllocated >= creditAmount;
          return (
            <div key={p.id} onClick={() => setViewPurchase(p)} className={`bg-white rounded-xl border p-4 hover:shadow-md transition cursor-pointer active:bg-slate-50 ${fullySettled ? "border-emerald-200" : "border-slate-200"}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-lg text-slate-800">{supp?.name || "Unknown"}</p>
                  <p className="text-sm text-slate-500">{fmtDate(p.invoice_date)} {p.invoice_number ? `• #${p.invoice_number}` : ""}</p>
                  <p className="text-xs text-slate-400 mt-1">{pItems.length} item{pItems.length !== 1 ? "s" : ""} • {p.payment_type}</p>
                  <p className="text-xs text-blue-500 mt-1">Tap to view details →</p>
                </div>
                <div className="text-right">
                  <p className="font-extrabold text-xl text-blue-600">{LKR(p.total_amount)}</p>
                  {p.payment_type === "Partial" && <p className="text-xs text-emerald-600">Paid: {LKR(p.amount_paid)}</p>}
                  {p.payment_type === "Credit" && !fullySettled && totalAllocated === 0 && <p className="text-xs text-red-500">Credit (Unpaid)</p>}
                  {p.payment_type === "Cash" && <p className="text-xs text-emerald-500">Paid in Full</p>}
                  {fullySettled && <p className="text-xs text-emerald-600 font-bold">✓ Settled via FIFO</p>}
                  {!fullySettled && totalAllocated > 0 && <p className="text-xs text-amber-600">Partly settled: {LKR(totalAllocated)}</p>}
                </div>
              </div>
            </div>
          );
        }) : <Empty icon="cart" text="No purchases yet" sub="Tap + to record your first purchase" />}
      </div>

      {/* Purchase Detail Modal */}
      {viewPurchase && (() => {
        const p = viewPurchase;
        const supp = suppliers.data.find(s => s.id === p.supplier_id);
        const pItems = purchaseItems.data.filter(i => i.purchase_id === p.id);
        return (
          <Modal title="Invoice Details" onClose={() => setViewPurchase(null)} wide>
            <div className="space-y-5">
              {/* Header */}
              <div className="bg-blue-50 rounded-xl p-4 md:p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-extrabold text-xl text-slate-800">{supp?.name || "Unknown"}</p>
                    <p className="text-sm text-slate-500 mt-1">{fmtDate(p.invoice_date)}</p>
                    {p.invoice_number && <p className="text-sm text-slate-500">Invoice #: {p.invoice_number}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-extrabold text-blue-700">{LKR(p.total_amount)}</p>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full mt-1 inline-block ${p.payment_type === "Cash" ? "bg-emerald-100 text-emerald-700" : p.payment_type === "Credit" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {p.payment_type}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="font-bold text-slate-700 mb-2">📦 Items ({pItems.length})</h4>
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 px-4 py-2 grid grid-cols-12 gap-1 text-xs font-semibold text-slate-500">
                    <div className="col-span-5">Product</div>
                    <div className="col-span-2 text-right">Qty</div>
                    <div className="col-span-2 text-right">Price</div>
                    <div className="col-span-3 text-right">Amount</div>
                  </div>
                  {pItems.map(item => (
                    <div key={item.id} className="px-4 py-3 grid grid-cols-12 gap-1 text-sm border-t border-slate-100">
                      <div className="col-span-5 font-medium text-slate-700">
                        {item.product_name || "Item"}
                        {item.packing_size && item.price_per === "packing_unit" && (
                          <span className="block text-xs text-amber-600">{item.quantity} {item.unit} × {item.packing_size} {item.packing_unit}</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right text-slate-600">{item.quantity} {item.unit}</div>
                      <div className="col-span-2 text-right text-slate-600">{shortLKR(item.unit_price)}/{item.price_label || item.unit}</div>
                      <div className="col-span-3 text-right font-bold text-blue-600">{LKR(item.line_total)}</div>
                    </div>
                  ))}
                  <div className="px-4 py-3 grid grid-cols-12 gap-1 bg-blue-50 border-t-2 border-blue-200">
                    <div className="col-span-9 text-right font-bold text-slate-700">Total:</div>
                    <div className="col-span-3 text-right font-extrabold text-blue-700 text-lg">{LKR(p.total_amount)}</div>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h4 className="font-bold text-slate-700 mb-2">💳 Payment</h4>
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="font-semibold">{p.payment_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Invoice Total:</span>
                    <span className="font-semibold">{LKR(p.total_amount)}</span>
                  </div>
                  {p.payment_type === "Partial" && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Paid:</span>
                      <span className="font-semibold text-emerald-600">{LKR(p.amount_paid)}</span>
                    </div>
                  )}
                  {(p.payment_type === "Credit" || p.payment_type === "Partial") && (
                    <div className="flex justify-between border-t border-slate-100 pt-2">
                      <span className="text-slate-500 font-semibold">Remaining:</span>
                      <span className="font-extrabold text-red-600">{LKR(p.total_amount - (p.amount_paid || 0))}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* FIFO Payment Allocations for this invoice */}
              {(p.payment_type === "Credit" || p.payment_type === "Partial") && (() => {
                const allocs = getInvoiceAllocations(p.id);
                const totalAllocated = allocs.reduce((s, a) => s + a.allocated_amount, 0);
                const creditAmount = p.total_amount - (p.amount_paid || 0);
                const remainingAfterAlloc = Math.max(0, Math.round((creditAmount - totalAllocated) * 100) / 100);
                const fullyPaid = remainingAfterAlloc === 0 && totalAllocated > 0;
                return (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2">🔄 Payment Allocations (FIFO)</h4>
                    {allocs.length > 0 ? (
                      <div className={`border rounded-xl overflow-hidden ${fullyPaid ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
                        {fullyPaid && (
                          <div className="px-4 py-2 bg-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-2">
                            <Icon name="check" size={16} color="#059669" /> Invoice Fully Settled
                          </div>
                        )}
                        <div className="p-3 space-y-2">
                          {allocs.map((a, i) => (
                            <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                              <div>
                                <p className="text-sm font-semibold text-slate-700">Payment on {fmtDate(a.payment?.payment_date)}</p>
                                <p className="text-xs text-slate-400">{a.payment?.payment_method} {a.payment?.reference_number ? `• Ref: ${a.payment.reference_number}` : ""}</p>
                              </div>
                              <p className="font-bold text-emerald-600 text-sm">{LKR(a.allocated_amount)}</p>
                            </div>
                          ))}
                        </div>
                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-slate-500">Total allocated:</span>
                            <span className="font-bold text-emerald-600">{LKR(totalAllocated)}</span>
                          </div>
                          {!fullyPaid && (
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Still owing:</span>
                              <span className="font-bold text-red-600">{LKR(remainingAfterAlloc)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                        <p className="text-sm text-slate-500">No payments allocated to this invoice yet</p>
                        <p className="text-xs text-slate-400 mt-1">Payments recorded with FIFO will automatically allocate here</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {p.notes && (
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">📝 Notes</h4>
                  <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">{p.notes}</p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button onClick={() => { setViewPurchase(null); openEdit(p); }}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-base hover:bg-blue-700 transition flex items-center justify-center gap-2">
                  <Icon name="edit" size={18} /> Edit
                </button>
                <button onClick={() => { setViewPurchase(null); handleDelete(p); }}
                  className="px-5 py-3 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl font-bold text-base hover:bg-red-100 transition flex items-center justify-center gap-2">
                  <Icon name="trash" size={18} /> Delete
                </button>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Purchase Form Modal */}
      {showForm && (
        <Modal title={editing ? "Edit Purchase" : "New Purchase"} onClose={saveDraftAndClose} wide>
          <div className="space-y-5">
            {/* Supplier Select */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg bg-white">
                <option value="">Select supplier...</option>
                {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name} (Owes: {LKR(getOutstanding(s.id))})</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Invoice #</label>
                <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" placeholder="INV-001" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" />
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Items *</label>
                <button onClick={() => setShowAddItem(true)} className="flex items-center gap-1.5 text-sm text-blue-600 font-semibold hover:text-blue-700">
                  <Icon name="plus" size={16} /> Add Item
                </button>
              </div>

              {items.length > 0 && (
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                  <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-xs font-semibold text-slate-500 uppercase">
                    <div className="col-span-4">Product</div><div className="col-span-2">Qty</div><div className="col-span-1">Price/</div>
                    <div className="col-span-2 text-right">Price/Unit</div><div className="col-span-2 text-right">Amount</div><div className="col-span-1"></div>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 px-4 py-3 border-b border-slate-200 last:border-0 items-center text-sm">
                      <div className="col-span-4 font-medium text-slate-700 truncate">
                        {item.product_name}
                        {item.packing_size && item.price_per === "packing_unit" && (
                          <span className="block text-xs text-amber-600">{item.quantity} {item.unit} × {item.packing_size} {item.packing_unit}</span>
                        )}
                      </div>
                      <div className="col-span-2">{item.quantity} {item.unit}</div>
                      <div className="col-span-1 text-slate-500">{item.price_label || item.unit}</div>
                      <div className="col-span-2 text-right">{shortLKR(item.unit_price)}</div>
                      <div className="col-span-2 text-right font-bold text-blue-600">{shortLKR(item.line_total)}</div>
                      <div className="col-span-1 text-right">
                        <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600"><Icon name="x" size={16} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 bg-blue-50 font-bold">
                    <span>Invoice Total</span>
                    <span className="text-blue-700 text-lg">{LKR(invoiceTotal)}</span>
                  </div>
                </div>
              )}

              {items.length === 0 && <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">No items added yet</div>}
            </div>

            {/* Payment Type */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Type</label>
              <div className="grid grid-cols-3 gap-2">
                {["Cash", "Credit", "Partial"].map(t => (
                  <button key={t} onClick={() => setPaymentType(t)}
                    className={`py-3 rounded-xl border-2 font-semibold transition ${paymentType === t ?
                      (t === "Cash" ? "border-emerald-500 bg-emerald-50 text-emerald-700" :
                        t === "Credit" ? "border-red-500 bg-red-50 text-red-700" :
                          "border-amber-500 bg-amber-50 text-amber-700") :
                      "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{t}</button>
                ))}
              </div>
            </div>

            {paymentType === "Partial" && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Amount Paid Now (LKR)</label>
                <input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg" placeholder="0.00" />
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" rows={2} placeholder="Optional notes" />
            </div>

            <button onClick={handleSave} className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-700 transition shadow-md">
              {editing ? "Update Purchase" : "Save Purchase"}
            </button>
          </div>

          {/* Add Item Sub-Modal */}
          {showAddItem && (
            <div className="fixed inset-0 z-[950] bg-black/40 flex items-start justify-center p-3 pt-6 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md md:max-w-lg w-full my-auto">
                <div className="sticky top-0 bg-white rounded-t-2xl p-5 border-b border-slate-100 flex justify-between items-center z-10">
                  <h3 className="font-bold text-lg text-slate-800">Add Item</h3>
                  <button onClick={() => setShowAddItem(false)} className="w-12 h-12 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 transition"><Icon name="x" size={24} color="#dc2626" /></button>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Product *</label>
                    <SearchBox value={productSearch} onChange={setProductSearch} placeholder="Search products..." />
                    <div className="mt-2 max-h-32 overflow-y-auto border border-slate-200 rounded-xl">
                      {filteredProductsForAdd.map(p => {
                        const lp = getLastPrice(p.id);
                        const hasPackInfo = p.packing_size && p.packing_unit;
                        return (
                          <button key={p.id} onClick={() => {
                            setItemProductId(p.id); setItemUnit(p.default_unit);
                            if (lp) setItemPrice(String(lp.price));
                            setProductSearch(p.name);
                          }}
                            className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-blue-50 transition ${itemProductId === p.id ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}`}>
                            <p className="font-semibold text-slate-700">{p.name}</p>
                            <p className="text-xs text-slate-400">
                              {p.category} • {p.default_unit}
                              {hasPackInfo ? ` (1 ${p.default_unit} = ${p.packing_size} ${p.packing_unit})` : ""}
                              {lp ? ` • Last: ${LKR(lp.price)}/${lp.unit}` : ""}
                            </p>
                          </button>
                        );
                      })}
                      {!filteredProductsForAdd.length && <p className="p-4 text-sm text-slate-400 text-center">No products found</p>}
                    </div>
                  </div>

                  {/* Packing info hint */}
                  {itemProductId && (() => {
                    const selProd = activeProducts.find(p => p.id === itemProductId);
                    if (selProd?.packing_size && selProd?.price_per === "packing_unit") {
                      return (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                          <p className="text-sm font-semibold text-amber-800">📦 1 {selProd.default_unit} = {selProd.packing_size} {selProd.packing_unit}</p>
                          <p className="text-xs text-amber-700">Price is per {selProd.packing_unit}. Amount = Qty × {selProd.packing_size} × Price</p>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Qty *</label>
                      <input type="number" value={itemQty} onChange={e => setItemQty(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg text-center" placeholder="0" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Unit</label>
                      <select value={itemUnit} onChange={e => setItemUnit(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none bg-white">
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">
                        Price *
                        {itemProductId && (() => {
                          const sp = activeProducts.find(p => p.id === itemProductId);
                          if (sp?.packing_size && sp?.price_per === "packing_unit") return <span className="text-xs text-amber-600 block">per {sp.packing_unit}</span>;
                          return <span className="text-xs text-slate-400 block">per {itemUnit || "unit"}</span>;
                        })()}
                      </label>
                      <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)}
                        className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg text-center" placeholder="0.00" />
                    </div>
                  </div>
                  {itemQty && itemPrice && (
                    <div className="bg-blue-50 rounded-xl p-3 text-center">
                      {(() => {
                        const selProd = activeProducts.find(p => p.id === itemProductId);
                        const q = parseFloat(itemQty || 0);
                        const pr = parseFloat(itemPrice || 0);
                        const packSz = selProd?.packing_size;
                        const pricePr = selProd?.price_per || "buying_unit";
                        let total;
                        let breakdown;
                        if (packSz && pricePr === "packing_unit") {
                          total = q * packSz * pr;
                          breakdown = `${q} ${itemUnit} × ${packSz} ${selProd.packing_unit} × ${shortLKR(pr)}`;
                        } else {
                          total = q * pr;
                          breakdown = `${q} × ${shortLKR(pr)}`;
                        }
                        return (
                          <>
                            <p className="text-xs text-blue-500 mb-1">{breakdown}</p>
                            <span className="text-sm text-blue-600">Line Total: </span>
                            <span className="font-bold text-blue-700 text-lg">{LKR(total)}</span>
                          </>
                        );
                      })()}
                    </div>
                  )}
                  <div className="pb-4 pt-2">
                    <button onClick={addItem} className="w-full py-5 bg-blue-600 text-white rounded-xl font-bold text-xl hover:bg-blue-700 transition shadow-lg flex items-center justify-center gap-2">
                      <Icon name="plus" size={24} /> Add to Invoice
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  PAYMENTS
// ═══════════════════════════════════════
function Payments({ suppliers, payments, paymentAllocations, getOutstanding, notify, askConfirm, refreshAll, computeFifoPreview, getPaymentAllocations, getUnpaidInvoices, purchases, purchaseItems, products }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ supplier_id: "", amount: "", payment_date: today(), payment_method: "Cash", reference_number: "", notes: "" });
  const [editing, setEditing] = useState(null);
  const [fifoPreview, setFifoPreview] = useState(null);
  const [expandedPayment, setExpandedPayment] = useState(null);
  const [allocMode, setAllocMode] = useState("auto"); // "auto" = FIFO, "manual" = pick invoices
  const [manualAllocs, setManualAllocs] = useState([]); // [{purchase_id, allocated_amount, ...invoiceInfo}]
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [previewInvoiceId, setPreviewInvoiceId] = useState(null);

  const methods = ["Cash", "Bank Transfer", "Cheque", "Other"];
  const activeSuppliers = suppliers.data.filter(s => s.is_active);

  const filteredPayments = payments.data.filter(p => {
    const supp = suppliers.data.find(s => s.id === p.supplier_id);
    return !search || (supp?.name || "").toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => b.payment_date.localeCompare(a.payment_date));

  const openNew = () => {
    setForm({ supplier_id: "", amount: "", payment_date: today(), payment_method: "Cash", reference_number: "", notes: "" });
    setEditing(null); setFifoPreview(null); setAllocMode("auto"); setManualAllocs([]); setUnpaidInvoices([]); setShowForm(true);
  };

  // Update FIFO preview when supplier or amount changes (auto mode)
  const updatePreview = (suppId, amount, editId = null) => {
    if (suppId && amount && parseFloat(amount) > 0) {
      setFifoPreview(computeFifoPreview(suppId, amount, editId));
    } else {
      setFifoPreview(null);
    }
  };

  // Load unpaid invoices when supplier changes (for manual mode)
  const loadUnpaidInvoices = (suppId, editId = null) => {
    setUnpaidInvoices(suppId ? getUnpaidInvoices(suppId, editId) : []);
  };

  const handleSupplierChange = (suppId) => {
    setForm(f => ({ ...f, supplier_id: suppId }));
    updatePreview(suppId, form.amount, editing);
    loadUnpaidInvoices(suppId, editing);
    setManualAllocs([]);
  };

  const handleAmountChange = (amount) => {
    setForm(f => ({ ...f, amount }));
    if (allocMode === "auto") updatePreview(form.supplier_id, amount, editing);
  };

  const handleModeChange = (mode) => {
    setAllocMode(mode);
    if (mode === "auto") {
      updatePreview(form.supplier_id, form.amount, editing);
      setManualAllocs([]);
    } else {
      setFifoPreview(null);
    }
  };

  // Manual mode: toggle an invoice on/off
  const toggleManualInvoice = (inv) => {
    const exists = manualAllocs.find(a => a.purchase_id === inv.purchase_id);
    if (exists) {
      setManualAllocs(manualAllocs.filter(a => a.purchase_id !== inv.purchase_id));
    } else {
      setManualAllocs([...manualAllocs, {
        purchase_id: inv.purchase_id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        invoice_total: inv.invoice_total,
        remaining_before: inv.remaining,
        allocated_amount: inv.remaining,
      }]);
    }
  };

  // Manual mode: update amount for a specific invoice
  const updateManualAmount = (purchaseId, amount) => {
    const inv = unpaidInvoices.find(i => i.purchase_id === purchaseId);
    const capped = Math.min(parseFloat(amount) || 0, inv?.remaining || 0);
    setManualAllocs(manualAllocs.map(a =>
      a.purchase_id === purchaseId ? { ...a, allocated_amount: Math.round(capped * 100) / 100 } : a
    ));
  };

  const manualTotal = manualAllocs.reduce((s, a) => s + a.allocated_amount, 0);

  // Build final allocations based on mode
  const getFinalAllocations = () => {
    if (allocMode === "auto" && fifoPreview) {
      return fifoPreview.allocations.map(a => ({ purchase_id: a.purchase_id, allocated_amount: a.allocated_amount }));
    } else if (allocMode === "manual") {
      return manualAllocs.filter(a => a.allocated_amount > 0).map(a => ({ purchase_id: a.purchase_id, allocated_amount: a.allocated_amount }));
    }
    return [];
  };

  const handleSave = async () => {
    if (!form.supplier_id) return notify("Select a supplier", "error");
    if (!form.amount || parseFloat(form.amount) <= 0) return notify("Enter valid amount", "error");

    const paymentAmount = parseFloat(form.amount);
    const finalAllocs = getFinalAllocations();

    if (allocMode === "manual" && manualTotal > paymentAmount + 0.01) {
      return notify("Allocated total exceeds payment amount!", "error");
    }

    if (editing) {
      await payments.update(editing, { ...form, amount: paymentAmount });
      await sbDelete("payment_allocations", "payment_id=eq." + editing);
      if (finalAllocs.length > 0) {
        await sbInsert("payment_allocations", finalAllocs.map(a => ({ payment_id: editing, purchase_id: a.purchase_id, supplier_id: form.supplier_id, allocated_amount: a.allocated_amount })));
      }
      notify("Payment updated");
    } else {
      const result = await payments.add({ id: genId(), ...form, amount: paymentAmount, created_at: today() });
      if (result && result.id && finalAllocs.length > 0) {
        await sbInsert("payment_allocations", finalAllocs.map(a => ({ payment_id: result.id, purchase_id: a.purchase_id, supplier_id: form.supplier_id, allocated_amount: a.allocated_amount })));
      }
      notify("Payment recorded");
    }
    setShowForm(false); setFifoPreview(null); setManualAllocs([]); await refreshAll();
  };

  const handleDelete = (p) => {
    askConfirm("Delete Payment?", "This will remove the payment and its invoice allocations.", async () => {
      await sbDelete("payment_allocations", "payment_id=eq." + p.id);
      await payments.remove(p.id);
      await refreshAll(); notify("Payment deleted");
    }, true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">Payments</h2>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-600 text-white px-5 md:px-6 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg hover:bg-emerald-700 transition shadow-md">
          <Icon name="plus" size={20} /> New Payment
        </button>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Search payments..." />

      <div className="space-y-3">
        {filteredPayments.length ? filteredPayments.map(p => {
          const supp = suppliers.data.find(s => s.id === p.supplier_id);
          const allocs = getPaymentAllocations(p.id);
          const isExpanded = expandedPayment === p.id;
          return (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 hover:shadow-md transition">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-lg text-slate-800">{supp?.name || "Unknown"}</p>
                    <p className="text-sm text-slate-500">{fmtDate(p.payment_date)} • {p.payment_method}</p>
                    {p.reference_number && <p className="text-xs text-slate-400">Ref: {p.reference_number}</p>}
                    {p.notes && <p className="text-xs text-slate-400 mt-1">📝 {p.notes}</p>}
                  </div>
                  <p className="font-extrabold text-xl text-emerald-600">{LKR(p.amount)}</p>
                </div>
                {allocs.length > 0 && (
                  <button onClick={() => setExpandedPayment(isExpanded ? null : p.id)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition">
                    <Icon name="check" size={12} color="#2563eb" />
                    Settled {allocs.length} invoice{allocs.length !== 1 ? "s" : ""}
                    <Icon name={isExpanded ? "x" : "down"} size={12} color="#2563eb" />
                  </button>
                )}
                {allocs.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg inline-block font-medium">⚠ No allocation (legacy payment)</p>
                )}
                {isExpanded && allocs.length > 0 && (
                  <div className="mt-3 bg-slate-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Allocation Breakdown</p>
                    {allocs.map((a, i) => (
                      <div key={i} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-100">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Invoice #{a.purchase?.invoice_number || "N/A"}</p>
                          <p className="text-xs text-slate-400">{fmtDate(a.purchase?.invoice_date)} • Total: {LKR(a.purchase?.total_amount)}</p>
                        </div>
                        <p className="font-bold text-emerald-600 text-sm">{LKR(a.allocated_amount)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 px-4 pb-4 pt-1 border-t border-slate-100 mt-1">
                <button onClick={() => {
                  setForm({ ...p, amount: String(p.amount) }); setEditing(p.id); setAllocMode("auto"); setManualAllocs([]);
                  setShowForm(true); updatePreview(p.supplier_id, String(p.amount), p.id); loadUnpaidInvoices(p.supplier_id, p.id);
                }}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition">
                  <Icon name="edit" size={14} /> Edit
                </button>
                <button onClick={() => handleDelete(p)}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                  <Icon name="trash" size={14} /> Delete
                </button>
              </div>
            </div>
          );
        }) : <Empty icon="money" text="No payments yet" sub="Tap + to record a payment" />}
      </div>

      {showForm && (
        <Modal title={editing ? "Edit Payment" : "New Payment"} onClose={() => { setShowForm(false); setFifoPreview(null); setManualAllocs([]); }}>
          <div className="space-y-4">
            {/* Supplier */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier *</label>
              <select value={form.supplier_id} onChange={e => handleSupplierChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg bg-white">
                <option value="">Select supplier...</option>
                {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name} (Owes: {LKR(getOutstanding(s.id))})</option>)}
              </select>
            </div>
            {form.supplier_id && (
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <span className="text-sm text-red-600">Current Outstanding: </span>
                <span className="font-bold text-red-700">{LKR(getOutstanding(form.supplier_id))}</span>
              </div>
            )}

            {/* ── Allocation Mode Toggle ── */}
            {form.supplier_id && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Allocation Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleModeChange("auto")}
                    className={`py-3 px-3 rounded-xl border-2 font-semibold transition text-sm ${allocMode === "auto" ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    🔄 Auto (FIFO)
                  </button>
                  <button onClick={() => handleModeChange("manual")}
                    className={`py-3 px-3 rounded-xl border-2 font-semibold transition text-sm ${allocMode === "manual" ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>
                    ✋ Pick Invoices
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">
                  {allocMode === "auto" ? "Payment settles oldest invoices first" : "Choose which invoice(s) this payment is for"}
                </p>
              </div>
            )}

            {/* ── Manual Mode: Invoice Picker ── */}
            {allocMode === "manual" && form.supplier_id && (
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">Select Invoice(s) to Pay</label>
                {unpaidInvoices.length > 0 ? (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {unpaidInvoices.map(inv => {
                      const selected = manualAllocs.find(a => a.purchase_id === inv.purchase_id);
                      return (
                        <div key={inv.purchase_id}
                          className={`rounded-xl border-2 transition ${selected ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                          <div className="flex items-center">
                            <button onClick={() => toggleManualInvoice(inv)}
                              className="flex-1 text-left p-3 flex items-center gap-3">
                              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition ${selected ? "bg-violet-600 border-violet-600" : "border-slate-300"}`}>
                                {selected && <Icon name="check" size={14} color="white" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-slate-700">Invoice #{inv.invoice_number}</p>
                                <p className="text-xs text-slate-400">{fmtDate(inv.invoice_date)} • Total: {shortLKR(inv.invoice_total)}</p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-red-600 text-sm">{LKR(inv.remaining)}</p>
                                <p className="text-xs text-slate-400">owing</p>
                              </div>
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setPreviewInvoiceId(inv.purchase_id); }}
                              className="mr-2 w-9 h-9 flex items-center justify-center rounded-lg transition flex-shrink-0 bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600"
                              title="View invoice details">
                              <Icon name="eye" size={16} />
                            </button>
                          </div>
                          {selected && (
                            <div className="px-3 pb-3 pt-1 border-t border-violet-200">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">Pay:</span>
                                <input type="number" value={selected.allocated_amount || ""}
                                  onChange={e => updateManualAmount(inv.purchase_id, e.target.value)}
                                  className="flex-1 px-3 py-2 rounded-lg border-2 border-violet-300 focus:border-violet-500 outline-none text-sm font-bold text-center"
                                  max={inv.remaining} min={0} step="0.01" />
                                <button onClick={() => updateManualAmount(inv.purchase_id, inv.remaining)}
                                  className="text-xs text-violet-600 font-semibold bg-violet-100 px-2 py-1.5 rounded-lg hover:bg-violet-200 transition whitespace-nowrap">
                                  Full
                                </button>
                              </div>
                              {selected.allocated_amount < inv.remaining && selected.allocated_amount > 0 && (
                                <p className="text-xs text-slate-400 mt-1 text-center">
                                  Remaining after: {LKR(Math.round((inv.remaining - selected.allocated_amount) * 100) / 100)}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                    <p className="text-sm text-slate-500">No unpaid credit invoices for this supplier</p>
                  </div>
                )}
                {manualAllocs.length > 0 && (
                  <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-600">Total to allocate:</span>
                      <span className="font-extrabold text-violet-700">{LKR(manualTotal)}</span>
                    </div>
                    {!form.amount && manualTotal > 0 && (
                      <button onClick={() => setForm(f => ({ ...f, amount: String(manualTotal) }))}
                        className="w-full py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 transition">
                        Set payment amount to {LKR(manualTotal)}
                      </button>
                    )}
                    {form.amount && Math.abs(parseFloat(form.amount) - manualTotal) > 0.01 && parseFloat(form.amount) > 0 && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                        ⚠ Payment ({LKR(form.amount)}) differs from allocation ({LKR(manualTotal)}).
                        {parseFloat(form.amount) > manualTotal
                          ? ` ${LKR(parseFloat(form.amount) - manualTotal)} unallocated.`
                          : " Allocation exceeds payment — please adjust."}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Amount (LKR) *</label>
              <input type="number" value={form.amount} onChange={e => handleAmountChange(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-2xl font-bold text-center" placeholder="0.00" />
            </div>

            {/* ── FIFO Preview (auto mode only) ── */}
            {allocMode === "auto" && fifoPreview && fifoPreview.allocations.length > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-emerald-50 rounded-2xl border-2 border-blue-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <Icon name="check" size={16} color="white" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800">FIFO Allocation Preview</p>
                    <p className="text-xs text-slate-500">Payment will settle invoices oldest-first</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {fifoPreview.allocations.map((a, i) => (
                    <div key={i} className={`rounded-xl border ${a.fully_settled ? "bg-emerald-50 border-emerald-200" : "bg-white border-slate-200"}`}>
                      <div className="flex items-center p-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-700">
                            {a.fully_settled && <span className="text-emerald-600">✓ </span>}
                            Invoice #{a.invoice_number}
                          </p>
                          <p className="text-xs text-slate-400">{fmtDate(a.invoice_date)} • Owed: {shortLKR(a.remaining_before)}</p>
                        </div>
                        <div className="text-right mr-2 flex-shrink-0">
                          <p className="font-bold text-emerald-600 text-sm">−{shortLKR(a.allocated_amount)}</p>
                          {a.fully_settled
                            ? <p className="text-xs text-emerald-600 font-semibold">FULLY PAID</p>
                            : <p className="text-xs text-slate-400">Left: {shortLKR(a.remaining_after)}</p>}
                        </div>
                        <button onClick={() => setPreviewInvoiceId(a.purchase_id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition flex-shrink-0 bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-600"
                          title="View invoice details">
                          <Icon name="eye" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-600">Total allocated:</span>
                  <span className="font-extrabold text-emerald-700">{LKR(fifoPreview.totalAllocated)}</span>
                </div>
                {fifoPreview.unallocated > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    <p className="text-sm text-amber-700 font-medium">⚠ {LKR(fifoPreview.unallocated)} excess — no more unpaid invoices</p>
                  </div>
                )}
              </div>
            )}
            {allocMode === "auto" && form.supplier_id && form.amount && parseFloat(form.amount) > 0 && fifoPreview && fifoPreview.allocations.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-sm text-amber-700 font-medium">No unpaid credit invoices found</p>
              </div>
            )}

            {/* Date, Method, Ref, Notes */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
              <input type="date" value={form.payment_date} onChange={e => setForm({ ...form, payment_date: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {methods.map(m => (
                  <button key={m} onClick={() => setForm({ ...form, payment_method: m })}
                    className={`py-3 rounded-xl border-2 font-semibold transition ${form.payment_method === m ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}>{m}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Reference Number</label>
              <input value={form.reference_number || ""} onChange={e => setForm({ ...form, reference_number: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" placeholder="Optional" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
              <textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" rows={2} />
            </div>

            {/* Save Button */}
            <button onClick={handleSave} className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 transition">
              {editing ? "Update Payment" : (() => {
                const count = allocMode === "auto" ? (fifoPreview?.allocations?.length || 0) : manualAllocs.filter(a => a.allocated_amount > 0).length;
                return count > 0 ? `Record Payment & Settle ${count} Invoice${count > 1 ? "s" : ""}` : "Record Payment";
              })()}
            </button>
          </div>
        </Modal>
      )}

      {/* Invoice Preview Modal — opens on eye icon tap */}
      {previewInvoiceId && (() => {
        const purch = purchases.data.find(p => p.id === previewInvoiceId);
        if (!purch) { setPreviewInvoiceId(null); return null; }
        const supp = suppliers.data.find(s => s.id === purch.supplier_id);
        const pItems = purchaseItems.data.filter(i => i.purchase_id === purch.id);
        return (
          <div className="fixed inset-0 z-[950] bg-black/50 flex items-center justify-center p-4" onClick={() => setPreviewInvoiceId(null)}>
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Invoice Details</h2>
                <button onClick={() => setPreviewInvoiceId(null)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100">
                  <Icon name="x" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                {/* Header */}
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-extrabold text-xl text-slate-800">{supp?.name || "Unknown"}</p>
                      <p className="text-sm text-slate-500 mt-1">{fmtDate(purch.invoice_date)}</p>
                      {purch.invoice_number && <p className="text-sm text-slate-500">Invoice #: {purch.invoice_number}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-extrabold text-blue-700">{LKR(purch.total_amount)}</p>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full mt-1 inline-block ${purch.payment_type === "Cash" ? "bg-emerald-100 text-emerald-700" : purch.payment_type === "Credit" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {purch.payment_type}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items Table */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">📦 Items ({pItems.length})</h4>
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-100 px-4 py-2 grid grid-cols-12 gap-1 text-xs font-semibold text-slate-500">
                      <div className="col-span-5">Product</div>
                      <div className="col-span-2 text-right">Qty</div>
                      <div className="col-span-2 text-right">Price</div>
                      <div className="col-span-3 text-right">Amount</div>
                    </div>
                    {pItems.map(item => (
                      <div key={item.id} className="px-4 py-3 grid grid-cols-12 gap-1 text-sm border-t border-slate-100">
                        <div className="col-span-5 font-medium text-slate-700">
                          {products.data.find(pr => pr.id === item.product_id)?.name || item.product_name || "Item"}
                          {item.packing_size && item.price_per === "packing_unit" && (
                            <span className="block text-xs text-amber-600">{item.quantity} {item.unit} × {item.packing_size} {item.packing_unit}</span>
                          )}
                        </div>
                        <div className="col-span-2 text-right text-slate-600">{item.quantity} {item.unit}</div>
                        <div className="col-span-2 text-right text-slate-600">{shortLKR(item.unit_price)}/{item.price_label || item.unit}</div>
                        <div className="col-span-3 text-right font-bold text-blue-600">{LKR(item.line_total)}</div>
                      </div>
                    ))}
                    <div className="px-4 py-3 grid grid-cols-12 gap-1 bg-blue-50 border-t-2 border-blue-200">
                      <div className="col-span-9 text-right font-bold text-slate-700">Total:</div>
                      <div className="col-span-3 text-right font-extrabold text-blue-700 text-lg">{LKR(purch.total_amount)}</div>
                    </div>
                  </div>
                </div>

                {/* Payment Info */}
                <div>
                  <h4 className="font-bold text-slate-700 mb-2">💳 Payment</h4>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
                    <div className="flex justify-between"><span className="text-slate-500">Type:</span><span className="font-semibold">{purch.payment_type}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Invoice Total:</span><span className="font-semibold">{LKR(purch.total_amount)}</span></div>
                    {purch.payment_type === "Partial" && (
                      <div className="flex justify-between"><span className="text-slate-500">Paid at purchase:</span><span className="font-semibold text-emerald-600">{LKR(purch.amount_paid)}</span></div>
                    )}
                    {(purch.payment_type === "Credit" || purch.payment_type === "Partial") && (
                      <div className="flex justify-between border-t border-slate-100 pt-2">
                        <span className="text-slate-500 font-semibold">Credit Amount:</span>
                        <span className="font-extrabold text-red-600">{LKR(purch.total_amount - (purch.amount_paid || 0))}</span>
                      </div>
                    )}
                  </div>
                </div>

                {purch.notes && (
                  <div>
                    <h4 className="font-bold text-slate-700 mb-2">📝 Notes</h4>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">{purch.notes}</p>
                  </div>
                )}

                <button onClick={() => setPreviewInvoiceId(null)}
                  className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold text-base hover:bg-slate-200 transition">
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ═══════════════════════════════════════
//  RETURNS
// ═══════════════════════════════════════
function Returns({ suppliers, products, returns, returnItems, getOutstanding, notify, askConfirm, refreshAll }) {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [returnDate, setReturnDate] = useState(today());
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([]);
  const [showAddItem, setShowAddItem] = useState(false);
  const [itemProductId, setItemProductId] = useState("");
  const [itemQty, setItemQty] = useState("");
  const [itemUnit, setItemUnit] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [productSearch, setProductSearch] = useState("");

  const units = ["kg", "g", "L", "mL", "piece", "packet", "bag", "box", "case", "can", "bottle", "dozen"];
  const activeSuppliers = suppliers.data.filter(s => s.is_active);
  const activeProducts = products.data.filter(p => p.is_active);
  const returnTotal = items.reduce((s, i) => s + i.line_total, 0);

  const filteredReturns = returns.data.filter(r => {
    const supp = suppliers.data.find(s => s.id === r.supplier_id);
    return !search || (supp?.name || "").toLowerCase().includes(search.toLowerCase());
  }).sort((a, b) => b.return_date.localeCompare(a.return_date));

  const resetForm = () => { setSupplierId(""); setReturnDate(today()); setReason(""); setNotes(""); setItems([]); };

  const addItem = () => {
    if (!itemProductId || !itemQty || !itemPrice) return notify("Fill all item fields", "error");
    const prod = activeProducts.find(p => p.id === itemProductId);
    const qty = parseFloat(itemQty);
    const price = parseFloat(itemPrice);
    setItems([...items, { id: genId(), product_id: itemProductId, product_name: prod?.name || "", quantity: qty, unit: itemUnit || prod?.default_unit || "kg", unit_price: price, line_total: Math.round(qty * price * 100) / 100 }]);
    setItemProductId(""); setItemQty(""); setItemUnit(""); setItemPrice(""); setProductSearch(""); setShowAddItem(false);
  };

  const handleSave = async () => {
    if (!supplierId) return notify("Select a supplier", "error");
    if (items.length === 0) return notify("Add at least one item", "error");
    const total = items.reduce((s, i) => s + i.line_total, 0);
    const result = await returns.add({ supplier_id: supplierId, return_date: returnDate, total_amount: total, reason, notes });
    if (result && result.id) {
      const newItems = items.map(i => { const { id, ...rest } = i; return { ...rest, return_id: result.id }; });
      if (newItems.length) await sbInsert("return_items", newItems);
    }
    notify("Return recorded"); setShowForm(false); resetForm(); await refreshAll();
  };

  const handleDelete = (r) => {
    askConfirm("Delete Return?", "This will affect the supplier\'s outstanding balance.", async () => {
      await returns.remove(r.id);
      await refreshAll(); notify("Return deleted");
    }, true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800">Goods Returns</h2>
        <button onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 bg-orange-500 text-white px-5 md:px-6 py-3 md:py-4 rounded-xl font-bold text-base md:text-lg hover:bg-orange-600 transition shadow-md">
          <Icon name="plus" size={20} /> New Return
        </button>
      </div>
      <SearchBox value={search} onChange={setSearch} placeholder="Search returns..." />

      <div className="space-y-3">
        {filteredReturns.length ? filteredReturns.map(r => {
          const supp = suppliers.data.find(s => s.id === r.supplier_id);
          return (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-lg text-slate-800">{supp?.name || "Unknown"}</p>
                  <p className="text-sm text-slate-500">{fmtDate(r.return_date)} {r.reason ? `• ${r.reason}` : ""}</p>
                </div>
                <p className="font-extrabold text-xl text-orange-600">{LKR(r.total_amount)}</p>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button onClick={() => handleDelete(r)} className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition">
                  <Icon name="trash" size={14} /> Delete
                </button>
              </div>
            </div>
          );
        }) : <Empty icon="ret" text="No returns yet" sub="Tap + to record a return" />}
      </div>

      {showForm && (
        <Modal title="New Return" onClose={() => setShowForm(false)} wide>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier *</label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-lg bg-white">
                <option value="">Select supplier...</option>
                {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Return Date</label>
              <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-slate-700">Items *</label>
                <button onClick={() => setShowAddItem(true)} className="flex items-center gap-1.5 text-sm text-orange-600 font-semibold hover:text-orange-700">
                  <Icon name="plus" size={16} /> Add Item
                </button>
              </div>
              {items.length > 0 ? (
                <div className="bg-orange-50 rounded-xl border border-orange-200 overflow-hidden">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between px-4 py-3 border-b border-orange-200 last:border-0">
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-slate-500">{item.quantity} {item.unit} × {LKR(item.unit_price)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-orange-600">{LKR(item.line_total)}</span>
                        <button onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><Icon name="x" size={16} /></button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-3 bg-orange-100 font-bold">
                    <span>Total Return</span><span className="text-orange-700">{LKR(returnTotal)}</span>
                  </div>
                </div>
              ) : <div className="text-center py-6 text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">No items added</div>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Reason</label>
              <input value={reason} onChange={e => setReason(e.target.value)} className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none" placeholder="Damaged, expired, etc." />
            </div>
            <button onClick={handleSave} className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold text-lg hover:bg-orange-600 transition">Record Return</button>
          </div>

          {showAddItem && (
            <div className="fixed inset-0 z-[950] bg-black/40 flex items-start justify-center p-3 pt-6 overflow-y-auto">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md md:max-w-lg w-full my-auto">
                <div className="sticky top-0 bg-white rounded-t-2xl p-5 border-b border-slate-100 flex justify-between items-center z-10">
                  <h3 className="font-bold text-lg">Add Return Item</h3>
                  <button onClick={() => setShowAddItem(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100"><Icon name="x" /></button>
                </div>
                <div className="p-5 space-y-4">
                  <SearchBox value={productSearch} onChange={setProductSearch} placeholder="Search products..." />
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl">
                    {activeProducts.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase())).map(p => (
                      <button key={p.id} onClick={() => { setItemProductId(p.id); setItemUnit(p.default_unit); setProductSearch(p.name); }}
                        className={`w-full text-left px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-orange-50 ${itemProductId === p.id ? "bg-orange-50 border-l-4 border-l-orange-500" : ""}`}>
                        <p className="font-semibold">{p.name}</p>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Qty</label>
                      <input type="number" value={itemQty} onChange={e => setItemQty(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-center" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Unit</label>
                      <select value={itemUnit} onChange={e => setItemUnit(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 outline-none bg-white">
                        {units.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1">Price</label>
                      <input type="number" value={itemPrice} onChange={e => setItemPrice(e.target.value)} className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 outline-none text-center" />
                    </div>
                  </div>
                  <button onClick={addItem} className="w-full py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition">Add Item</button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  PRICE CHECK
// ═══════════════════════════════════════
function PriceCheck({ products, purchaseItems, purchases, suppliers, getLastPrice }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);

  const activeProducts = products.data.filter(p => p.is_active);
  const filtered = activeProducts.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const getPriceHistory = (prodId) => {
    const items = purchaseItems.data.filter(i => i.product_id === prodId);
    return items.map(i => {
      const purchase = purchases.data.find(p => p.id === i.purchase_id);
      const supp = purchase ? suppliers.data.find(s => s.id === purchase.supplier_id) : null;
      return { date: purchase?.invoice_date, supplier: supp?.name || "Unknown", price: i.unit_price, qty: i.quantity, unit: i.unit };
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-slate-800">Price Check</h2>
      <SearchBox value={search} onChange={setSearch} placeholder="Search product to check price..." />

      {selected ? (
        <div>
          <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-blue-600 font-semibold mb-3 hover:underline">
            <Icon name="back" size={16} /> Back to products
          </button>
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 className="text-xl font-bold text-slate-800">{selected.name}</h3>
            <p className="text-sm text-slate-500 mb-4">{selected.category} • {selected.default_unit}</p>
            {(() => {
              const lp = getLastPrice(selected.id);
              return lp ? (
                <div className="bg-blue-50 rounded-xl p-4 mb-4">
                  <p className="text-sm text-blue-600 font-semibold">Last Purchase Price</p>
                  <p className="text-2xl font-extrabold text-blue-700">{LKR(lp.price)} / {lp.unit}</p>
                  <p className="text-sm text-blue-500">{fmtDate(lp.date)} from {lp.supplier}</p>
                </div>
              ) : null;
            })()}
            <h4 className="font-bold text-slate-700 mb-2">Price History</h4>
            <div className="space-y-2">
              {getPriceHistory(selected.id).length ? getPriceHistory(selected.id).map((h, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div>
                    <p className="font-medium text-slate-700">{h.supplier}</p>
                    <p className="text-xs text-slate-400">{fmtDate(h.date)} • {h.qty} {h.unit}</p>
                  </div>
                  <p className="font-bold text-slate-800">{LKR(h.price)}/{h.unit}</p>
                </div>
              )) : <p className="text-slate-400 text-center py-6">No purchase history</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const lp = getLastPrice(p.id);
            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className="w-full bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between hover:shadow-md transition text-left">
                <div>
                  <p className="font-bold text-lg text-slate-800">{p.name}</p>
                  <p className="text-sm text-slate-500">{p.category}</p>
                </div>
                <div className="text-right">
                  {lp ? (
                    <>
                      <p className="font-extrabold text-blue-600">{LKR(lp.price)}/{lp.unit}</p>
                      <p className="text-xs text-slate-400">{fmtDate(lp.date)}</p>
                    </>
                  ) : <p className="text-sm text-slate-400">No price data</p>}
                </div>
              </button>
            );
          })}
          {!filtered.length && <Empty icon="tag" text="No products found" sub="Add products first to check prices" />}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════
function Reports({ suppliers, products, purchases, purchaseItems, payments, returns, returnItems, getOutstanding, paymentAllocations }) {
  const [report, setReport] = useState(null);
  const [filterSupplier, setFilterSupplier] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const activeSuppliers = suppliers.data.filter(s => s.is_active);

  const reportTypes = [
    { id: "outstanding", label: "Outstanding Summary", icon: "money", desc: "All suppliers with current balances", color: "bg-red-50 border-red-200 text-red-700" },
    { id: "supplier-ledger", label: "Supplier Ledger", icon: "users", desc: "Full transaction history per supplier", color: "bg-blue-50 border-blue-200 text-blue-700" },
    { id: "purchases", label: "Purchase Report", icon: "cart", desc: "All purchases by date/supplier", color: "bg-blue-50 border-blue-200 text-blue-700" },
    { id: "payments", label: "Payment Report", icon: "money", desc: "All payments by date/supplier", color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { id: "summary", label: "Period Summary", icon: "chart", desc: "Totals for any date range", color: "bg-violet-50 border-violet-200 text-violet-700" },
  ];

  const renderReport = () => {
    switch (report) {
      case "outstanding":
        const outData = activeSuppliers.map(s => ({ name: s.name, phone: s.phone, outstanding: getOutstanding(s.id) })).sort((a, b) => b.outstanding - a.outstanding);
        const totalOut = outData.reduce((s, d) => s + d.outstanding, 0);
        return (
          <div className="space-y-3">
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <p className="text-sm text-red-600">Total Outstanding</p>
              <p className="text-2xl font-extrabold text-red-700">{LKR(totalOut)}</p>
            </div>
            {outData.map((d, i) => (
              <div key={i} className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                <div><p className="font-semibold">{d.name}</p>{d.phone && <p className="text-xs text-slate-400">{d.phone}</p>}</div>
                <p className={`font-bold ${d.outstanding > 0 ? "text-red-600" : "text-emerald-600"}`}>{LKR(d.outstanding)}</p>
              </div>
            ))}
          </div>
        );

      case "supplier-ledger":
        if (!filterSupplier) return <p className="text-center text-slate-400 py-8">Select a supplier above</p>;
        const supp = suppliers.data.find(s => s.id === filterSupplier);
        const ledger = [];
        // Opening balance as first entry (only show if no dateFrom filter, or if OB date is within range)
        const ob = parseFloat(supp?.opening_balance) || 0;
        const obDate = supp?.opening_balance_date || "2000-01-01";
        if (ob > 0 && (!dateFrom || obDate >= dateFrom) && (!dateTo || obDate <= dateTo)) {
          ledger.push({ date: obDate, type: "Opening", desc: `Opening Balance — B/F`, debit: ob, credit: 0, isOpening: true });
        }
        purchases.data.filter(p => p.supplier_id === filterSupplier && (!dateFrom || p.invoice_date >= dateFrom) && (!dateTo || p.invoice_date <= dateTo)).forEach(p => {
          if (p.payment_type === "Credit" || p.payment_type === "Partial") {
            ledger.push({ date: p.invoice_date, type: "Purchase", desc: `Invoice ${p.invoice_number || "N/A"} (${p.payment_type})`, debit: p.total_amount - (p.amount_paid || 0), credit: 0 });
          }
        });
        payments.data.filter(p => p.supplier_id === filterSupplier && (!dateFrom || p.payment_date >= dateFrom) && (!dateTo || p.payment_date <= dateTo)).forEach(p => {
          const allocs = paymentAllocations.data.filter(a => a.payment_id === p.id);
          let desc = `${p.payment_method} ${p.reference_number || ""}`;
          if (allocs.length > 0) {
            const invoiceRefs = allocs.map(a => {
              const inv = purchases.data.find(pu => pu.id === a.purchase_id);
              return `#${inv?.invoice_number || "N/A"} (${shortLKR(a.allocated_amount)})`;
            }).join(", ");
            desc += ` → ${invoiceRefs}`;
          }
          ledger.push({ date: p.payment_date, type: "Payment", desc, debit: 0, credit: p.amount });
        });
        returns.data.filter(r => r.supplier_id === filterSupplier && (!dateFrom || r.return_date >= dateFrom) && (!dateTo || r.return_date <= dateTo)).forEach(r => {
          ledger.push({ date: r.return_date, type: "Return", desc: r.reason || "Goods returned", debit: 0, credit: r.total_amount });
        });
        ledger.sort((a, b) => a.date.localeCompare(b.date));
        let balance = 0;
        ledger.forEach(l => { balance += l.debit - l.credit; l.balance = balance; });

        return (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-xl p-4">
              <p className="font-bold text-lg">{supp?.name}</p>
              <p className="text-sm text-slate-500">Current Outstanding: <span className={`font-bold ${balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{LKR(balance)}</span></p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="text-left p-2">Date</th><th className="text-left p-2">Type</th><th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Debit</th><th className="text-right p-2">Credit</th><th className="text-right p-2">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((l, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${l.isOpening ? "bg-amber-50" : ""}`}>
                      <td className="p-2">{l.isOpening && !l.date ? "-" : fmtDate(l.date)}</td>
                      <td className="p-2"><span className={`px-2 py-0.5 rounded text-xs font-semibold ${l.type === "Purchase" ? "bg-blue-100 text-blue-700" : l.type === "Payment" ? "bg-emerald-100 text-emerald-700" : l.type === "Opening" ? "bg-amber-100 text-amber-700" : "bg-orange-100 text-orange-700"}`}>{l.type}</span></td>
                      <td className={`p-2 ${l.isOpening ? "font-semibold text-amber-700" : "text-slate-600"}`}>{l.desc}</td>
                      <td className="p-2 text-right text-red-600 font-medium">{l.debit ? shortLKR(l.debit) : "-"}</td>
                      <td className="p-2 text-right text-emerald-600 font-medium">{l.credit ? shortLKR(l.credit) : "-"}</td>
                      <td className={`p-2 text-right font-bold ${l.balance > 0 ? "text-red-600" : "text-emerald-600"}`}>{shortLKR(l.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      case "purchases":
        const filteredP = purchases.data.filter(p => {
          if (filterSupplier && p.supplier_id !== filterSupplier) return false;
          if (dateFrom && p.invoice_date < dateFrom) return false;
          if (dateTo && p.invoice_date > dateTo) return false;
          return true;
        }).sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
        const totalP = filteredP.reduce((s, p) => s + p.total_amount, 0);
        return (
          <div className="space-y-3">
            <div className="bg-blue-50 rounded-xl p-4 text-center"><p className="text-sm text-blue-600">Total</p><p className="text-xl font-extrabold text-blue-700">{LKR(totalP)}</p><p className="text-xs text-blue-500">{filteredP.length} purchases</p></div>
            {filteredP.map(p => {
              const s = suppliers.data.find(su => su.id === p.supplier_id);
              return (
                <div key={p.id} className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                  <div><p className="font-semibold">{s?.name}</p><p className="text-xs text-slate-400">{fmtDate(p.invoice_date)} • {p.payment_type}</p></div>
                  <p className="font-bold text-blue-600">{LKR(p.total_amount)}</p>
                </div>
              );
            })}
          </div>
        );

      case "payments":
        const filteredPay = payments.data.filter(p => {
          if (filterSupplier && p.supplier_id !== filterSupplier) return false;
          if (dateFrom && p.payment_date < dateFrom) return false;
          if (dateTo && p.payment_date > dateTo) return false;
          return true;
        }).sort((a, b) => b.payment_date.localeCompare(a.payment_date));
        const totalPay = filteredPay.reduce((s, p) => s + p.amount, 0);
        return (
          <div className="space-y-3">
            <div className="bg-emerald-50 rounded-xl p-4 text-center"><p className="text-sm text-emerald-600">Total</p><p className="text-xl font-extrabold text-emerald-700">{LKR(totalPay)}</p><p className="text-xs text-emerald-500">{filteredPay.length} payments</p></div>
            {filteredPay.map(p => {
              const s = suppliers.data.find(su => su.id === p.supplier_id);
              return (
                <div key={p.id} className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                  <div><p className="font-semibold">{s?.name}</p><p className="text-xs text-slate-400">{fmtDate(p.payment_date)} • {p.payment_method}</p></div>
                  <p className="font-bold text-emerald-600">{LKR(p.amount)}</p>
                </div>
              );
            })}
          </div>
        );

      case "summary":
        const sP = purchases.data.filter(p => (!dateFrom || p.invoice_date >= dateFrom) && (!dateTo || p.invoice_date <= dateTo));
        const sPay = payments.data.filter(p => (!dateFrom || p.payment_date >= dateFrom) && (!dateTo || p.payment_date <= dateTo));
        const sR = returns.data.filter(r => (!dateFrom || r.return_date >= dateFrom) && (!dateTo || r.return_date <= dateTo));
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-5 text-center"><p className="text-sm text-blue-600 font-semibold">Purchases</p><p className="text-2xl font-extrabold text-blue-700">{LKR(sP.reduce((s, p) => s + p.total_amount, 0))}</p><p className="text-xs text-blue-500">{sP.length} invoices</p></div>
            <div className="bg-emerald-50 rounded-xl p-5 text-center"><p className="text-sm text-emerald-600 font-semibold">Payments</p><p className="text-2xl font-extrabold text-emerald-700">{LKR(sPay.reduce((s, p) => s + p.amount, 0))}</p><p className="text-xs text-emerald-500">{sPay.length} payments</p></div>
            <div className="bg-orange-50 rounded-xl p-5 text-center"><p className="text-sm text-orange-600 font-semibold">Returns</p><p className="text-2xl font-extrabold text-orange-700">{LKR(sR.reduce((s, r) => s + r.total_amount, 0))}</p><p className="text-xs text-orange-500">{sR.length} returns</p></div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-extrabold text-slate-800">Reports</h2>

      {!report ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {reportTypes.map(r => (
            <button key={r.id} onClick={() => setReport(r.id)}
              className={`${r.color} border rounded-xl p-5 text-left hover:shadow-md transition`}>
              <div className="flex items-center gap-3 mb-2">
                <Icon name={r.icon} size={22} />
                <h3 className="font-bold text-lg">{r.label}</h3>
              </div>
              <p className="text-sm opacity-80">{r.desc}</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <button onClick={() => { setReport(null); setFilterSupplier(""); setDateFrom(""); setDateTo(""); }}
            className="flex items-center gap-1 text-blue-600 font-semibold hover:underline">
            <Icon name="back" size={16} /> Back to Reports
          </button>

          <h3 className="text-xl font-bold text-slate-800">{reportTypes.find(r => r.id === report)?.label}</h3>

          {/* Filters */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            {(report === "supplier-ledger" || report === "purchases" || report === "payments") && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Supplier</label>
                <select value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 outline-none bg-white">
                  <option value="">All Suppliers</option>
                  {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
            {report !== "outstanding" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">From</label>
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">To</label>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 outline-none" />
                </div>
              </div>
            )}
          </div>

          {renderReport()}
        </div>
      )}
    </div>
  );
}
