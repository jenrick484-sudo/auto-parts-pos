import { useState, useMemo } from 'react';
import { Calendar } from 'lucide-react';
import { usePos } from '../context/PosContext';

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function SalesLogPage() {
  const { salesTransactions } = usePos();
  const [selectedDate, setSelectedDate] = useState(getTodayString);

  const { filteredTxns, grossSum, costSum, profitSum, totalPcs } = useMemo(() => {
    const txns = salesTransactions.filter(t => (t.date || '').startsWith(selectedDate));
    let gross = 0;
    let cost = 0;
    let profit = 0;
    let pcs = 0;

    txns.forEach(t => {
      gross += Number(t.grandTotal || t.grand_total || 0);
      cost += Number(t.totalCost || t.total_cost || 0);
      profit += Number(t.totalProfit || t.total_profit || 0);
      const items = t.items || t.transaction_items || [];
      items.forEach(i => {
        pcs += Number(i.qty || i.quantity || 0);
      });
    });

    return { filteredTxns: txns, grossSum: gross, costSum: cost, profitSum: profit, totalPcs: pcs };
  }, [salesTransactions, selectedDate]);

  return (
    <div className="space-y-6">
      {/* Header & Date Filter */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-black text-slate-900">Daily Sales & Receipts Log</h1>
          <p className="text-xs text-slate-500">
            Showing {filteredTxns.length} transaction(s) ({totalPcs} pcs sold)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-orange-600" />
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-orange-600"
          />
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400">GROSS SALES</span>
          <div className="text-2xl font-black text-orange-600 mt-1">
            ₱{grossSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400">TOTAL CAPITAL / COST</span>
          <div className="text-2xl font-black text-slate-700 mt-1">
            ₱{costSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs font-bold text-slate-400">NET PROFIT</span>
          <div className="text-2xl font-black text-green-600 mt-1">
            ₱{profitSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[11px] uppercase">
              <th className="p-4">Time / Receipt</th>
              <th className="p-4">Item Description</th>
              <th className="p-4 text-center">Qty</th>
              <th className="p-4 text-center">Payment</th>
              <th className="p-4 text-right">Cost</th>
              <th className="p-4 text-right">Amount</th>
              <th className="p-4 text-right">Profit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredTxns.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-8 text-center text-slate-400 font-semibold">
                  Walang naitalang benta sa petsang ito.
                </td>
              </tr>
            ) : (
              filteredTxns.flatMap((txn) => {
                const items = txn.items || txn.transaction_items || [];
                const pay = (txn.paymentMethod || txn.payment_method || 'CASH').toUpperCase();
                return items.map((item, idx) => {
                  const q = Number(item.qty || item.quantity || 0);
                  const pr = Number(item.price || 0);
                  const cs = Number(item.cost || 0);
                  return (
                    <tr key={`${txn.id}-${idx}`} className="hover:bg-slate-50">
                      <td className="p-4">
                        <strong className="text-slate-900">{txn.time}</strong>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {txn.txnNumber || txn.id}
                        </div>
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {item.partName || item.part_name} ({item.oem})
                      </td>
                      <td className="p-4 text-center font-extrabold">{q}</td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            pay === 'GCASH' || pay === 'G-CASH'
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {pay}
                        </span>
                      </td>
                      <td className="p-4 text-right text-slate-500">₱{(cs * q).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right font-extrabold text-orange-600">₱{(pr * q).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td className="p-4 text-right font-extrabold text-green-600">₱{((pr - cs) * q).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  );
                });
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
