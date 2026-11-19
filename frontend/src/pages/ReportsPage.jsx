import { useState, useMemo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { usePos } from '../context/PosContext';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ReportsPage() {
  const { salesTransactions } = usePos();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(null); // '01' - '12'
  const [selectedDate, setSelectedDate] = useState(null);   // 'YYYY-MM-DD'

  const yearlyData = useMemo(() => {
    let yrSales = 0;
    let yrCost = 0;
    let yrProfit = 0;
    const rows = MONTHS.map((name, idx) => {
      const mCode = String(idx + 1).padStart(2, '0');
      const txns = salesTransactions.filter((t) => (t.date || '').startsWith(`${selectedYear}-${mCode}`));
      const sales = txns.reduce((s, t) => s + Number(t.grandTotal || t.grand_total || 0), 0);
      const cost = txns.reduce((s, t) => s + Number(t.totalCost || t.total_cost || 0), 0);
      const profit = txns.reduce((s, t) => s + Number(t.totalProfit || t.total_profit || 0), 0);
      yrSales += sales;
      yrCost += cost;
      yrProfit += profit;
      return { mCode, name, count: txns.length, sales, cost, profit };
    });
    return { rows, yrSales, yrCost, yrProfit };
  }, [salesTransactions, selectedYear]);

  const monthlyData = useMemo(() => {
    if (!selectedMonth) return { rows: [], mnSales: 0, mnCost: 0, mnProfit: 0 };
    const daysInMonth = new Date(Number(selectedYear), Number(selectedMonth), 0).getDate();
    let mnSales = 0;
    let mnCost = 0;
    let mnProfit = 0;
    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const fullDate = `${selectedYear}-${selectedMonth}-${String(d).padStart(2, '0')}`;
      const txns = salesTransactions.filter((t) => (t.date || '').startsWith(fullDate));
      const sales = txns.reduce((s, t) => s + Number(t.grandTotal || t.grand_total || 0), 0);
      const cost = txns.reduce((s, t) => s + Number(t.totalCost || t.total_cost || 0), 0);
      const profit = txns.reduce((s, t) => s + Number(t.totalProfit || t.total_profit || 0), 0);
      mnSales += sales;
      mnCost += cost;
      mnProfit += profit;
      rows.push({ fullDate, count: txns.length, sales, cost, profit });
    }
    return { rows, mnSales, mnCost, mnProfit };
  }, [salesTransactions, selectedYear, selectedMonth]);

  const dailyData = useMemo(() => {
    if (!selectedDate) return { txns: [], dySales: 0, dyCost: 0, dyProfit: 0 };
    const txns = salesTransactions.filter((t) => (t.date || '').startsWith(selectedDate));
    const dySales = txns.reduce((s, t) => s + Number(t.grandTotal || t.grand_total || 0), 0);
    const dyCost = txns.reduce((s, t) => s + Number(t.totalCost || t.total_cost || 0), 0);
    const dyProfit = txns.reduce((s, t) => s + Number(t.totalProfit || t.total_profit || 0), 0);
    return { txns, dySales, dyCost, dyProfit };
  }, [salesTransactions, selectedDate]);

  const activeTotals = selectedDate
    ? { sales: dailyData.dySales, cost: dailyData.dyCost, profit: dailyData.dyProfit, label: `Daily (${selectedDate})` }
    : selectedMonth
    ? {
        sales: monthlyData.mnSales,
        cost: monthlyData.mnCost,
        profit: monthlyData.mnProfit,
        label: `${MONTHS[Number(selectedMonth) - 1]} ${selectedYear}`,
      }
    : { sales: yearlyData.yrSales, cost: yearlyData.yrCost, profit: yearlyData.yrProfit, label: `Yearly (${selectedYear})` };

  const dailyRows = useMemo(() => {
    return dailyData.txns.flatMap((txn) =>
      (txn.items || txn.transaction_items || []).map((i, idx) => ({
        key: `${txn.id || txn.txnNumber}-${idx}`,
        time: txn.time || txn.date || '',
        txnId: txn.txnNumber || txn.txn_number || `TXN-${txn.id || ''}`,
        partName: i.partName || i.part_name || 'ITEM',
        oem: i.oem || '',
        qty: Number(i.qty || i.quantity || 0),
        price: Number(i.price || 0),
        cost: Number(i.cost || 0),
      }))
    );
  }, [dailyData]);

  return (
    <div className="space-y-5">
      {/* Breadcrumb & Year Selector */}
      <div className="bg-white p-4 rounded-xl border border-zinc-300 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setSelectedMonth(null);
              setSelectedDate(null);
            }}
            className={`cursor-pointer ${!selectedMonth ? 'text-zinc-500' : 'text-[#FF6600] hover:underline'}`}
          >
            Yearly ({selectedYear})
          </button>
          {selectedMonth && (
            <>
              <span>➔</span>
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className={`cursor-pointer ${!selectedDate ? 'text-zinc-500' : 'text-[#FF6600] hover:underline'}`}
              >
                {MONTHS[Number(selectedMonth) - 1]} {selectedYear}
              </button>
            </>
          )}
          {selectedDate && (
            <>
              <span>➔</span>
              <span className="text-zinc-500">{selectedDate} Details</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="bg-zinc-100 hover:bg-zinc-200 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Monthly</span>
            </button>
          )}
          {selectedMonth && !selectedDate && (
            <button
              type="button"
              onClick={() => setSelectedMonth(null)}
              className="bg-zinc-100 hover:bg-zinc-200 text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Yearly</span>
            </button>
          )}
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setSelectedMonth(null);
              setSelectedDate(null);
            }}
            className="border border-zinc-300 rounded-lg px-3 py-1.5 text-xs font-bold bg-white"
          >
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-zinc-300">
          <span className="text-xs font-semibold text-zinc-500">{activeTotals.label} Gross Sales</span>
          <strong className="block text-2xl font-extrabold text-[#FF6600] mt-1">
            ₱{activeTotals.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-300">
          <span className="text-xs font-semibold text-zinc-500">{activeTotals.label} Investment (Cost)</span>
          <strong className="block text-2xl font-extrabold text-zinc-800 mt-1">
            ₱{activeTotals.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="bg-white p-5 rounded-xl border border-zinc-300">
          <span className="text-xs font-semibold text-zinc-500">{activeTotals.label} Net Profit</span>
          <strong className="block text-2xl font-extrabold text-green-600 mt-1">
            ₱{activeTotals.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </strong>
        </div>
      </div>

      {/* Drill-Down Tables */}
      <div className="bg-white rounded-2xl border border-zinc-300 overflow-x-auto">
        {!selectedMonth && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 text-zinc-500 text-[11px] uppercase border-b border-zinc-300">
                <th className="p-3.5">Month</th>
                <th className="p-3.5 text-center">Transactions</th>
                <th className="p-3.5 text-right">Investment (Cost)</th>
                <th className="p-3.5 text-right">Gross Sales</th>
                <th className="p-3.5 text-right">Net Profit</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {yearlyData.rows.map((r) => (
                <tr key={r.mCode} onClick={() => setSelectedMonth(r.mCode)} className="hover:bg-[#FFF7ED] cursor-pointer">
                  <td className="p-3.5 font-bold">
                    {r.name} {selectedYear}
                  </td>
                  <td className="p-3.5 text-center">{r.count}</td>
                  <td className="p-3.5 text-right text-zinc-500">
                    ₱{r.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-right font-bold text-[#FF6600]">
                    ₱{r.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-right font-bold text-green-600">
                    ₱{r.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-center">
                    <span className="px-2.5 py-1 rounded-lg border border-zinc-300 text-[11px] font-semibold">
                      View ➔
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedMonth && !selectedDate && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 text-zinc-500 text-[11px] uppercase border-b border-zinc-300">
                <th className="p-3.5">Date / Day</th>
                <th className="p-3.5 text-center">Transactions</th>
                <th className="p-3.5 text-right">Investment (Cost)</th>
                <th className="p-3.5 text-right">Gross Sales</th>
                <th className="p-3.5 text-right">Net Profit</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {monthlyData.rows.map((d) => (
                <tr
                  key={d.fullDate}
                  onClick={() => d.count > 0 && setSelectedDate(d.fullDate)}
                  className={d.count > 0 ? 'hover:bg-[#FFF7ED] cursor-pointer' : 'text-zinc-400'}
                >
                  <td className="p-3.5 font-bold">{d.fullDate}</td>
                  <td className="p-3.5 text-center">{d.count}</td>
                  <td className="p-3.5 text-right text-zinc-500">
                    ₱{d.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-right font-bold text-[#FF6600]">
                    ₱{d.sales.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-right font-bold text-green-600">
                    ₱{d.profit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3.5 text-center">
                    {d.count > 0 ? (
                      <span className="px-2.5 py-1 rounded-lg border border-zinc-300 text-zinc-800 text-[11px] font-semibold">
                        Details ➔
                      </span>
                    ) : (
                      <span className="text-[11px] text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {selectedDate && (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 text-zinc-500 text-[11px] uppercase border-b border-zinc-300">
                <th className="p-3.5">Time / Txn ID</th>
                <th className="p-3.5">Item Description (Part Name & OEM)</th>
                <th className="p-3.5 text-center">Qty</th>
                <th className="p-3.5 text-right">Investment (Cost)</th>
                <th className="p-3.5 text-right">Gross Sales</th>
                <th className="p-3.5 text-right">Net Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-500">
                    No item records found for {selectedDate}.
                  </td>
                </tr>
              ) : (
                dailyRows.map((row) => (
                  <tr key={row.key} className="hover:bg-zinc-50">
                    <td className="p-3.5 font-mono text-[11px] text-zinc-600">
                      <div className="font-bold text-zinc-900">{row.txnId}</div>
                      <div>{row.time}</div>
                    </td>
                    <td className="p-3.5 font-bold text-zinc-800">
                      {row.partName} {row.oem ? `(${row.oem})` : ''}
                    </td>
                    <td className="p-3.5 text-center font-bold">{row.qty}</td>
                    <td className="p-3.5 text-right text-zinc-500">
                      ₱{(row.cost * row.qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-bold text-[#FF6600]">
                      ₱{(row.price * row.qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3.5 text-right font-bold text-green-600">
                      ₱{((row.price - row.cost) * row.qty).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}