import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Package,
  ShoppingCart,
  Boxes,
  PackagePlus,
  BarChart3,
} from 'lucide-react';
import { usePos } from '../context/PosContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Tooltip, Legend, Filler);

function getTodayString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export default function DashboardPage() {
  const { masterItems, inventoryBatches, salesTransactions } = usePos();
  const navigate = useNavigate();

  const stats = useMemo(() => {
    const todayStr = getTodayString();
    const todayTxns = salesTransactions.filter((t) => (t.date || '').startsWith(todayStr));

    const todayGross = todayTxns.reduce((sum, t) => sum + Number(t.grandTotal || t.grand_total || 0), 0);
    const todayProfit = todayTxns.reduce((sum, t) => sum + Number(t.totalProfit || t.total_profit || 0), 0);

    const outOfStock = inventoryBatches.filter((b) => Number(b.stock || 0) === 0);
    const lowStock = inventoryBatches.filter(
      (b) => Number(b.stock || 0) > 0 && Number(b.stock || 0) <= Number(b.lowStockLimit || b.low_stock_limit || 0)
    );

    const assetValuation = inventoryBatches.reduce(
      (sum, b) => sum + Number(b.cost || 0) * Number(b.stock || 0),
      0
    );

    const masterMap = new Map(masterItems.map((m) => [Number(m.id), m]));
    const criticalItems = [...outOfStock, ...lowStock].slice(0, 5).map((b) => {
      const m = masterMap.get(Number(b.masterId || b.master_id)) || {};
      return {
        code: b.code || b.variant_code,
        partName: m.partName || m.part_name || 'ITEM',
        oem: m.oem || '',
        stock: Number(b.stock || 0),
      };
    });

    // 7-Day Sales Trend
    const trendLabels = [];
    const trendValues = [];
    const today = new Date();
    for (let offset = 6; offset >= 0; offset--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      trendLabels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
      trendValues.push(
        salesTransactions
          .filter((t) => (t.date || '').startsWith(key))
          .reduce((s, t) => s + Number(t.grandTotal || t.grand_total || 0), 0)
      );
    }

    // Top Selling Items Share
    const itemSalesMap = {};
    salesTransactions.forEach((t) => {
      const items = t.items || t.transaction_items || [];
      items.forEach((i) => {
        const label = `${i.partName || i.part_name || 'ITEM'} (${i.batchCode || i.batch_code || i.oem || ''})`;
        itemSalesMap[label] = (itemSalesMap[label] || 0) + Number(i.qty || i.quantity || 0);
      });
    });

    const sortedTop = Object.entries(itemSalesMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const topLabels = sortedTop.map(([label]) => label);
    const topData = sortedTop.map(([, qty]) => qty);

    return {
      todayGross,
      todayProfit,
      outCount: outOfStock.length,
      lowCount: lowStock.length,
      totalAlerts: outOfStock.length + lowStock.length,
      assetValuation,
      criticalItems,
      recentSales: salesTransactions.slice(0, 5),
      trendLabels,
      trendValues,
      topLabels: topLabels.length > 0 ? topLabels : ['No sales recorded'],
      topData: topData.length > 0 ? topData : [1],
    };
  }, [masterItems, inventoryBatches, salesTransactions]);

  return (
    <div className="space-y-5">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-zinc-300 border-l-4 border-l-[#FF6600]">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
            <span>TODAY'S GROSS SALES</span>
            <TrendingUp className="w-4 h-4 text-[#FF6600]" />
          </div>
          <div className="text-2xl font-extrabold text-zinc-900 mt-1.5">
            ₱{stats.todayGross.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Kabuuan ng Benta Ngayon</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-300">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
            <span>TODAY'S NET PROFIT</span>
            <DollarSign className="w-4 h-4 text-green-600" />
          </div>
          <div className="text-2xl font-extrabold text-green-600 mt-1.5">
            ₱{stats.todayProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">Malinis na Tubo Ngayon</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-300 border-l-4 border-l-red-600">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
            <span>STOCK ALERT WARNINGS</span>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          <div className="text-2xl font-extrabold text-red-600 mt-1.5">{stats.totalAlerts} Items</div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {stats.outCount} Out of Stock | {stats.lowCount} Low Stock
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-300">
          <div className="flex justify-between items-center text-xs font-semibold text-zinc-500">
            <span>TOTAL INVENTORY VALUATION</span>
            <Package className="w-4 h-4 text-zinc-600" />
          </div>
          <div className="text-2xl font-extrabold text-zinc-900 mt-1.5">
            ₱{stats.assetValuation.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {masterItems.length} Masters | {inventoryBatches.length} Variants
          </div>
        </div>
      </div>

      {/* 4 Quick Actions Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => navigate('/pos')}
          className="flex items-center gap-3 p-4 rounded-xl bg-[#1A1A1A] text-white text-left hover:-translate-y-0.5 transition cursor-pointer"
        >
          <ShoppingCart className="w-6 h-6 text-[#FF6600] shrink-0" />
          <div>
            <strong className="block text-xs font-bold">Open Checkout POS</strong>
            <span className="block text-[11px] text-zinc-400">Scan or search variants for sale</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/inventory')}
          className="flex items-center gap-3 p-4 rounded-xl bg-white border border-zinc-300 hover:border-[#FF6600] text-left hover:-translate-y-0.5 transition cursor-pointer"
        >
          <Boxes className="w-6 h-6 text-[#FF6600] shrink-0" />
          <div>
            <strong className="block text-xs font-bold text-zinc-900">Central Inventory</strong>
            <span className="block text-[11px] text-zinc-500">Check stocks, restock & barcodes</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/master-items')}
          className="flex items-center gap-3 p-4 rounded-xl bg-white border border-zinc-300 hover:border-[#FF6600] text-left hover:-translate-y-0.5 transition cursor-pointer"
        >
          <PackagePlus className="w-6 h-6 text-[#FF6600] shrink-0" />
          <div>
            <strong className="block text-xs font-bold text-zinc-900">New Master Item</strong>
            <span className="block text-[11px] text-zinc-500">Register new part OEM & specs</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/reports')}
          className="flex items-center gap-3 p-4 rounded-xl bg-white border border-zinc-300 hover:border-[#FF6600] text-left hover:-translate-y-0.5 transition cursor-pointer"
        >
          <BarChart3 className="w-6 h-6 text-[#FF6600] shrink-0" />
          <div>
            <strong className="block text-xs font-bold text-zinc-900">Financial Analytics</strong>
            <span className="block text-[11px] text-zinc-500">Drill-down yearly, monthly & daily</span>
          </div>
        </button>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-zinc-300">
          <div className="mb-3">
            <h3 className="text-sm font-extrabold text-zinc-900">7-Day Sales Performance Trend</h3>
            <p className="text-xs text-zinc-500">Gross sales performance over the last 7 days</p>
          </div>
          <div className="h-64">
            <Line
              data={{
                labels: stats.trendLabels,
                datasets: [
                  {
                    label: 'Daily Sales (₱)',
                    data: stats.trendValues,
                    borderColor: '#FF6600',
                    backgroundColor: 'rgba(255, 102, 0, 0.12)',
                    fill: true,
                    tension: 0.3,
                    borderWidth: 2.5,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } },
              }}
            />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-zinc-300 flex flex-col">
          <div className="mb-3">
            <h3 className="text-sm font-extrabold text-zinc-900">Top Selling Items Share</h3>
            <p className="text-xs text-zinc-500">Units sold distribution</p>
          </div>
          <div className="h-64 flex-1">
            <Doughnut
              data={{
                labels: stats.topLabels,
                datasets: [
                  {
                    data: stats.topData,
                    backgroundColor: ['#FF6600', '#1A1A1A', '#16A34A', '#D97706', '#64748B'],
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } },
              }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Tables Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Critical Reorder List */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-300">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900">Critical Reorder List</h3>
              <p className="text-xs text-zinc-500">Variants at or below stock limit</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="text-xs font-bold text-[#FF6600] hover:underline cursor-pointer"
            >
              View All ➔
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-[11px] font-bold text-zinc-500 uppercase">
                  <th className="py-2 pr-2">Variant Code</th>
                  <th className="py-2 px-2">Item / OEM</th>
                  <th className="py-2 px-2">Stock</th>
                  <th className="py-2 pl-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {stats.criticalItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500 font-semibold">
                      ✅ All items have healthy stock levels!
                    </td>
                  </tr>
                ) : (
                  stats.criticalItems.map((item) => (
                    <tr key={item.code} className="hover:bg-zinc-50">
                      <td className="py-2.5 pr-2 font-mono font-extrabold text-[#FF6600]">{item.code}</td>
                      <td className="py-2.5 px-2 font-semibold text-zinc-800">
                        {item.partName} ({item.oem})
                      </td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            item.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                          }`}
                        >
                          {item.stock} PCS
                        </span>
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/inventory?q=${encodeURIComponent(item.code)}`)}
                          className="text-[11px] font-bold text-[#FF6600] hover:underline cursor-pointer"
                        >
                          Restock
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Checkout Activity */}
        <div className="bg-white p-5 rounded-2xl border border-zinc-300">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-sm font-extrabold text-zinc-900">Recent Checkout Activity</h3>
              <p className="text-xs text-zinc-500">Latest POS sales transactions</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/sales-log')}
              className="text-xs font-bold text-[#FF6600] hover:underline cursor-pointer"
            >
              Full Log ➔
            </button>
          </div>

          <div className="divide-y divide-zinc-100">
            {stats.recentSales.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">No transactions logged yet.</div>
            ) : (
              stats.recentSales.map((t, i) => (
                <div key={t.id || t.txnNumber || i} className="py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono font-extrabold text-xs text-zinc-900">
                      {t.txnNumber || t.txn_number || `TXN-${t.id || i + 1}`}
                    </div>
                    <div className="text-[11px] text-zinc-500">{t.time || t.date}</div>
                  </div>
                  <div className="text-sm font-black text-green-600">
                    ₱{Number(t.grandTotal || t.grand_total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}