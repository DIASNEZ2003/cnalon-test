import React, { useEffect, useState, useMemo } from 'react';
import { 
  Layers, TrendingUp, TrendingDown, Users, Skull, 
  Database, Scale, ShoppingBag, 
  LineChart as ChartIcon, Activity, 
  FlaskConical, Wallet, PieChart as PieIcon,
  Clock, Sun, Moon, BarChart3, ArrowUpRight, ArrowDownRight,
  GitCompare, X, Eye, Pill, HeartPulse, CheckCircle,
  Package // Added this for the feeds icon
} from 'lucide-react';
import { auth, db } from '../firebase'; 
import { ref, onValue } from 'firebase/database';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ReferenceLine, BarChart, Bar, ComposedChart
} from 'recharts';

// --- HELPER: GET COLOR FOR VITAMIN NAME ---
const getVitaminColor = (name) => {
  if (!name) return '#14b8a6'; 
  const n = name.toLowerCase();
  if (n.includes('vetracin')) return '#10b981';      
  if (n.includes('amox')) return '#3b82f6';          
  if (n.includes('doxy')) return '#8b5cf6';          
  if (n.includes('electrolytes')) return '#f59e0b';  
  if (n.includes('broncho')) return '#ef4444';       
  if (n.includes('vitamin') || n.includes('multi')) return '#ec4899'; 
  if (n.includes('vaccine') || n.includes('ncd') || n.includes('gumboro')) return '#6366f1'; 
  return '#14b8a6'; 
};

// --- HELPER: STRICT DATE DIFFERENCE (Fixes the Day Count Issue) ---
const calculateDaysStrict = (startDateStr) => {
    if (!startDateStr) return 1;
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
};

// --- METRIC CARD ---
const MetricCard = ({ title, value, unit, icon: Icon, colorClass, bgClass, barColor, prevValue, isCurrency = false, isInverse = false, graphData, graphKey, xKey = "day", isComparison = false }) => {
  const formattedValue = isCurrency 
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
    : (typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value);

  const compareData = [
    { name: 'Last', value: Number(prevValue) || 0, color: '#94a3b8' }, 
    { name: 'Now', value: Number(value) || 0, color: barColor } 
  ];

  const diff = Number(value) - Number(prevValue);
  const isBetter = isInverse ? diff < 0 : diff > 0;
  
  const CustomCompareTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
          <p className="font-semibold text-gray-700">{payload[0].payload.name}</p>
          <p className="text-gray-900 font-bold">
            {isCurrency ? '₱' : ''}{Number(payload[0].value).toLocaleString()} {unit && !isCurrency ? unit : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomGraphTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
          return (
              <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
                  <p className="font-bold text-gray-500 uppercase mb-1">
                      {typeof label === 'number' ? `Day ${label}` : label}
                  </p>
                  <p className="font-black text-gray-800 text-sm">
                      {Number(payload[0].value).toLocaleString()} {unit}
                  </p>
              </div>
          );
      }
      return null;
  };

  return (
    <div className="relative group bg-white rounded-2xl shadow-sm border border-gray-100 h-36 transition-all duration-300 overflow-hidden">
      <div className="absolute inset-0 p-5 flex flex-col justify-between z-10 bg-white group-hover:opacity-0 transition-opacity duration-300">
        <div className="flex justify-between items-start">
          <span className={`p-2.5 rounded-xl ${bgClass} ${colorClass}`}>
            <Icon size={20}/>
          </span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        </div>
        <div>
          <h3 className={`text-2xl font-black ${colorClass.replace('text-', 'text-opacity-90 text-')}`}>
            {formattedValue} <span className="text-xs font-normal text-gray-400">{unit}</span>
          </h3>
          <div className="flex items-center gap-1 mt-1 text-xs font-bold opacity-60">
            {prevValue !== undefined && prevValue !== 0 ? (
              <>
                {isBetter ? <ArrowUpRight size={14} className="text-green-600"/> : <ArrowDownRight size={14} className="text-red-600"/>}
                <span className={isBetter ? 'text-green-600' : 'text-red-600'}>
                    vs Last Batch
                </span>
              </>
            ) : <span className="text-gray-400">No previous data</span>}
          </div>
        </div>
        <div className={`absolute top-5 right-5 opacity-20 ${colorClass}`}>
          <Eye size={16} />
        </div>
      </div>

      <div className="absolute inset-0 z-20 bg-white p-2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-50 px-2 pt-1">
            <p className="text-[10px] font-black text-gray-600 uppercase">{title} Trend</p>
            <span className={`text-[9px] text-white px-1.5 py-0.5 rounded font-bold`} style={{ backgroundColor: barColor }}>
                {isComparison ? 'VS LAST' : (title === 'Avg Weight' ? 'WEEKLY' : '30 DAYS')}
            </span>
          </div>
          
          <div className="flex-1 w-full h-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              {isComparison ? (
                  <BarChart data={compareData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomCompareTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={25}>
                      {compareData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
              ) : (
                  <AreaChart data={graphData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`grad-${graphKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={barColor} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={barColor} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={xKey} hide />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} domain={['auto', 'auto']} />
                    <Tooltip content={<CustomGraphTooltip />} cursor={{ stroke: barColor, strokeWidth: 1 }} />
                    <Area 
                        type="monotone" 
                        dataKey={graphKey} 
                        stroke={barColor} 
                        strokeWidth={2} 
                        fill={`url(#grad-${graphKey})`} 
                        activeDot={{ r: 3 }}
                    />
                  </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};

const RealDashboard = () => {
  const [activeBatch, setActiveBatch] = useState(null);
  const [previousBatch, setPreviousBatch] = useState(null); 
  const [allBatchesData, setAllBatchesData] = useState([]); 
  const [forecastData, setForecastData] = useState([]);
  const [inventoryForecast, setInventoryForecast] = useState([]); 
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [loading, setLoading] = useState(true); 
  const [showCompareModal, setShowCompareModal] = useState(false); 

  const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];
  const backendUrl = "http://localhost:8000";

  const [stats, setStats] = useState({
    expenses: 0,
    sales: 0,
    totalFeedKilos: 0, 
    totalVitaminGrams: 0, 
    qtyHarvested: 0,
    mortality: 0,
    avgWeight: 0,
  });

  // 1. Auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Load
  useEffect(() => {
    if (!currentUser) return;
    const batchesRef = ref(db, 'global_batches');
    const unsubscribe = onValue(batchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allBatches = snapshot.val();
        const batchList = Object.entries(allBatches)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
        
        const firstActive = batchList.find(b => b.status === 'active');
        const lastCompleted = batchList.find(b => b.status === 'completed');

        setActiveBatch(firstActive);
        setPreviousBatch(lastCompleted); 
        setAllBatchesData(batchList);

        if (firstActive) {
          let totalExp = 0, totalSales = 0, feedKilos = 0, vitaminGrams = 0, harvestedHeads = 0, totalMortality = 0, currentWeight = 0;
          if (firstActive.expenses) Object.values(firstActive.expenses).forEach(exp => totalExp += Number(exp.amount || 0));
          if (firstActive.feed_logs) Object.values(firstActive.feed_logs).forEach(log => feedKilos += (Number(log.am || 0) + Number(log.pm || 0)));
          if (firstActive.daily_vitamin_logs) Object.values(firstActive.daily_vitamin_logs).forEach(log => vitaminGrams += (Number(log.am_amount || 0) + Number(log.pm_amount || 0)));
          if (firstActive.sales) Object.values(firstActive.sales).forEach(sale => { totalSales += Number(sale.totalAmount || 0); harvestedHeads += Number(sale.quantity || 0); });
          if (firstActive.mortality_logs) Object.values(firstActive.mortality_logs).forEach(log => totalMortality += (Number(log.am || 0) + Number(log.pm || 0)));
          if (firstActive.weight_logs) {
            const weights = Object.values(firstActive.weight_logs).sort((a,b) => b.day - a.day);
            if (weights.length > 0) currentWeight = Number(weights[0].averageWeight || 0); 
          }
          setStats({ expenses: totalExp, sales: totalSales, totalFeedKilos: feedKilos, totalVitaminGrams: vitaminGrams, qtyHarvested: harvestedHeads, mortality: totalMortality, avgWeight: currentWeight });
        }
      }
      setLoading(false); 
    });
    return () => unsubscribe();
  }, [currentUser]);

  // 3. Forecasts
  useEffect(() => {
    const getForecasts = async () => {
      if (activeBatch && activeBatch.id && currentUser) {
        setLoadingForecast(true);
        try {
          const token = await currentUser.getIdToken();
          const feedRes = await fetch(`${backendUrl}/get-feed-forecast/${activeBatch.id}`, { headers: { 'Authorization': `Bearer ${token}` }});
          if (feedRes.ok) setForecastData((await feedRes.json()).forecast);
          const invRes = await fetch(`${backendUrl}/get-inventory-forecast/${activeBatch.id}`, { headers: { 'Authorization': `Bearer ${token}` }});
          if (invRes.ok) setInventoryForecast(await invRes.json());
        } catch (err) { console.error("Forecast Error:", err); } finally { setLoadingForecast(false); }
      }
    };
    getForecasts();
  }, [activeBatch, currentUser]);

  const batchTrendData = useMemo(() => {
      if (!activeBatch) return { daily: [], weekly: [] };
      const [startYear, startMonth, startDay] = activeBatch.dateCreated.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay);
      
      const daily = [];
      let currentPop = activeBatch.startingPopulation;
      for (let i = 0; i < 30; i++) {
          const date = new Date(start); 
          date.setDate(date.getDate() + i); 
          
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;

          const mort = activeBatch.mortality_logs?.[dateStr] ? (Number(activeBatch.mortality_logs[dateStr].am||0) + Number(activeBatch.mortality_logs[dateStr].pm||0)) : 0;
          const feed = activeBatch.feed_logs?.[dateStr] ? (Number(activeBatch.feed_logs[dateStr].am||0) + Number(activeBatch.feed_logs[dateStr].pm||0)) : 0;
          const vit = activeBatch.daily_vitamin_logs?.[dateStr] ? (Number(activeBatch.daily_vitamin_logs[dateStr].am_amount||0) + Number(activeBatch.daily_vitamin_logs[dateStr].pm_amount||0)) : 0;
          currentPop -= mort;
          daily.push({ day: i + 1, mortality: mort, population: currentPop, feed, vitamins: vit });
      }
      const weekly = [];
      if (activeBatch.weight_logs) {
          [1, 2, 3, 4].forEach(w => {
              const targetDay = w * 7;
              const logEntry = Object.values(activeBatch.weight_logs).find(l => l.day >= targetDay - 3 && l.day <= targetDay + 3);
              weekly.push({ name: `Week ${w}`, weight: logEntry ? Number(logEntry.averageWeight) : 0 });
          });
      } else { [1,2,3,4].forEach(w => weekly.push({ name: `Week ${w}`, weight: 0 })); }
      return { daily, weekly };
  }, [activeBatch]);

  const getBatchMetrics = (batch) => {
    if (!batch) return null;
    let sales = 0, expenses = 0, harvestQty = 0, feedKilos = 0, vitaminGrams = 0, mort = 0, weight = 0;
    if (batch.expenses) Object.values(batch.expenses).forEach(e => expenses += Number(e.amount || 0));
    if (batch.sales) Object.values(batch.sales).forEach(s => { sales += Number(s.totalAmount || 0); harvestQty += Number(s.quantity || 0); });
    if (batch.feed_logs) Object.values(batch.feed_logs).forEach(f => feedKilos += (Number(f.am || 0) + Number(f.pm || 0)));
    if (batch.daily_vitamin_logs) Object.values(batch.daily_vitamin_logs).forEach(v => vitaminGrams += (Number(v.am_amount || 0) + Number(v.pm_amount || 0)));
    if (batch.mortality_logs) Object.values(batch.mortality_logs).forEach(m => mort += (Number(m.am || 0) + Number(m.pm || 0)));
    if (batch.weight_logs) { const w = Object.values(batch.weight_logs).sort((a,b) => b.day - a.day); if(w.length > 0) weight = Number(w[0].averageWeight || 0); }
    const startPop = batch.startingPopulation || 0;
    const mortalityRate = startPop > 0 ? ((mort / startPop) * 100).toFixed(1) : 0;
    const estTotalBiomassKg = (((startPop - mort) * weight) + (harvestQty * weight)) / 1000; 
    const fcr = estTotalBiomassKg > 0 ? (feedKilos / estTotalBiomassKg).toFixed(2) : "0.00";
    return { name: batch.batchName, population: startPop, sales, expenses, profit: sales - expenses, mortalityRate, fcr, harvested: harvestQty, feedKilos, vitaminGrams, mortality: mort, avgWeight: weight };
  };

  const currentBatchDay = useMemo(() => {
    return calculateDaysStrict(activeBatch?.dateCreated);
  }, [activeBatch]);

  const daysLeft = useMemo(() => {
    if (!activeBatch?.expectedCompleteDate) return 0;
    const [tY, tM, tD] = activeBatch.expectedCompleteDate.split('-').map(Number);
    const target = new Date(tY, tM - 1, tD, 12, 0, 0);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  }, [activeBatch]);

  const progress = useMemo(() => {
    if (!activeBatch) return 0;
    const [sY, sM, sD] = activeBatch.dateCreated.split('-').map(Number);
    const [eY, eM, eD] = activeBatch.expectedCompleteDate.split('-').map(Number);
    const start = new Date(sY, sM - 1, sD, 12, 0, 0);
    const end = new Date(eY, eM - 1, eD, 12, 0, 0);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const totalDuration = end - start;
    const elapsed = today - start;
    if (totalDuration <= 0) return 0;
    return Math.min(Math.round((elapsed / totalDuration) * 100), 100);
  }, [activeBatch]);

  const todayFeedStats = useMemo(() => {
    if (!activeBatch || !forecastData.length) return { recommended: 0, actual: 0 };
    const rec = forecastData.find(d => d.day === currentBatchDay);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let act = 0;
    if (activeBatch.feed_logs && activeBatch.feed_logs[todayStr]) act = Number(activeBatch.feed_logs[todayStr].am || 0) + Number(activeBatch.feed_logs[todayStr].pm || 0);
    return { recommended: rec ? rec.targetKilos : 0, actual: act, type: rec ? rec.feedType : 'N/A' };
  }, [activeBatch, forecastData, currentBatchDay]);

  const todayVitaminStats = useMemo(() => {
      if (!currentBatchDay) return { names: [], totalTarget: 0, actual: 0 };
      const sourceData = (inventoryForecast.length > 0) ? inventoryForecast : (activeBatch?.vitaminForecast || []);
      const activeItems = sourceData.filter(item => currentBatchDay >= item.startDay && currentBatchDay <= item.endDay);
      const totalTarget = activeItems.reduce((acc, curr) => acc + curr.dailyAmount, 0);
      let actualUsed = 0;
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (activeBatch?.daily_vitamin_logs && activeBatch.daily_vitamin_logs[todayStr]) actualUsed = Number(activeBatch.daily_vitamin_logs[todayStr].am_amount || 0) + Number(activeBatch.daily_vitamin_logs[todayStr].pm_amount || 0);
      return { names: activeItems.map(i => i.name), totalTarget, actual: actualUsed, unit: activeItems.length > 0 ? activeItems[0].unit : '' };
  }, [activeBatch, inventoryForecast, currentBatchDay]);

  const dailyVitaminChartData = useMemo(() => {
      const sourceData = (inventoryForecast.length > 0) ? inventoryForecast : (activeBatch?.vitaminForecast || []);
      const data = [];
      for(let d=1; d<=30; d++){
          const activeItems = sourceData.filter(item => d >= item.startDay && d <= item.endDay);
          data.push({ day: d, dosage: activeItems.reduce((a,c)=>a+c.dailyAmount,0), activeNames: activeItems.map(i=>i.name).join(', '), unit: activeItems[0]?.unit || "units" });
      }
      return data;
  }, [activeBatch, inventoryForecast]);

  const feedBreakdown = useMemo(() => {
    const totals = { Booster: 0, Starter: 0, Finisher: 0, Total: 0 };
    forecastData.forEach(d => { if (totals[d.feedType] !== undefined) totals[d.feedType] += d.targetKilos; totals.Total += d.targetKilos; });
    return totals;
  }, [forecastData]);

  const expensePieData = useMemo(() => {
    if (!activeBatch) return [];
    const categories = {};
    if (activeBatch.expenses) Object.values(activeBatch.expenses).forEach(exp => categories[exp.category] = (categories[exp.category] || 0) + Number(exp.amount || 0));
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [activeBatch]);

  const historyComparisonData = useMemo(() => {
    return allBatchesData.filter(b => b.status === 'completed' || b.status === 'active').slice(-5).map(b => {
        let exp = 0, sale = 0;
        if (b.expenses) Object.values(b.expenses).forEach(e => exp += Number(e.amount || 0));
        if (b.sales) Object.values(b.sales).forEach(s => sale += Number(s.totalAmount || 0));
        return { name: b.batchName, income: sale - exp, status: b.status };
    });
  }, [allBatchesData]);

  if (!activeBatch) {
    if (loading) return <div className="p-10 text-center text-gray-400 font-bold">Loading Dashboard...</div>;
    return <div className="p-10 text-center"><h3 className="text-xl font-bold text-red-900">No Active Batch</h3></div>;
  }

  const startPop = activeBatch.startingPopulation || 0;
  const currentPop = startPop - stats.qtyHarvested - stats.mortality;
  const netIncome = stats.sales - stats.expenses;
  const currentMetrics = getBatchMetrics(activeBatch);
  const prevMetrics = getBatchMetrics(previousBatch);
  const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  const CustomFeedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return ( <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100"><p className="text-[10px] font-bold text-gray-400 uppercase">Day {label} {label === currentBatchDay ? '(Today)' : ''}</p><p className="text-sm font-black text-indigo-600">{data.feedType}</p><p className="text-xs font-bold text-gray-700">{payload[0].value} kg</p></div> );
    } return null;
  };

  const CustomVitaminTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload; if (data.dosage === 0) return null;
      return ( <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100 z-50"><p className="text-[10px] font-bold text-gray-400 uppercase">Day {label}</p><p className="text-xs font-black text-teal-600 mb-1">{data.activeNames}</p><p className="text-[10px] font-bold text-gray-500">Total: {data.dosage.toFixed(1)} {data.unit}</p></div> );
    } return null;
  };

  return (
    <div className="flex-1 bg-gray-50 -mt-7 p-4 overflow-y-auto pb-20 relative">
      
      {/* HEADER */}
      <div className="bg-[#3B0A0A] p-6 rounded-2xl shadow-xl text-white mb-8 relative overflow-hidden group">
        <div className="relative z-10 flex justify-between items-start mb-4">
          <div className="flex items-center gap-2"><Layers size={20} className="text-orange-400"/><h1 className="text-2xl font-bold uppercase">{activeBatch.batchName}</h1>{previousBatch && <button onClick={() => setShowCompareModal(true)} className="ml-2 flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg text-[10px] uppercase font-bold transition-colors border border-white/10"><GitCompare size={12} /> Compare vs Last</button>}</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-orange-200 font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded">Day {currentBatchDay} / 30</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded border border-green-500/30 font-bold uppercase">{activeBatch.status}</span>
          </div>
        </div>
        <div className="relative z-10 w-full bg-black/30 h-3 rounded-full overflow-hidden backdrop-blur-sm"><div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-500 shadow-lg" style={{ width: `${progress}%` }} /></div>
        <div className="relative z-10 flex justify-between mt-2 text-xs font-bold text-white/50 uppercase"><span>Started: {activeBatch.dateCreated}</span><span className="text-orange-300">Harvest: {activeBatch.expectedCompleteDate} ({daysLeft} days left)</span></div>
      </div>

      {/* METRICS - FINANCIAL */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Financial Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard title="Total Sales" value={stats.sales} prevValue={prevMetrics ? prevMetrics.sales : 0} icon={ShoppingBag} colorClass="text-blue-700" bgClass="bg-blue-50" barColor="#2563eb" isCurrency={true} isComparison={true} />
        <MetricCard title="Net Profit" value={netIncome} prevValue={prevMetrics ? prevMetrics.profit : 0} icon={Wallet} colorClass={netIncome >= 0 ? "text-emerald-700" : "text-red-700"} bgClass={netIncome >= 0 ? "bg-emerald-50" : "bg-red-50"} barColor={netIncome >= 0 ? "#10b981" : "#ef4444"} isCurrency={true} isComparison={true} />
        <MetricCard title="Total Expenses" value={stats.expenses} prevValue={prevMetrics ? prevMetrics.expenses : 0} icon={TrendingDown} colorClass="text-red-700" bgClass="bg-red-50" barColor="#dc2626" isCurrency={true} isInverse={true} isComparison={true} />
      </div>

      {/* --- SECTION 2: BATCH PERFORMANCE --- */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Batch Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <MetricCard title="Live Pop." value={currentPop} unit="heads" icon={Users} colorClass="text-cyan-700" bgClass="bg-cyan-50" barColor="#0891b2" graphData={batchTrendData.daily} graphKey="population" />
        <MetricCard title="Mortality" value={stats.mortality} unit="heads" icon={Skull} colorClass="text-red-600" bgClass="bg-red-50" barColor="#dc2626" graphData={batchTrendData.daily} graphKey="mortality" />
        {/* UPDATED FEEDS ICON TO PACKAGE (MATCHING SACK/BAG STYLE) */}
        <MetricCard title="Feed Used" value={stats.totalFeedKilos} unit="kg" icon={Package} colorClass="text-orange-700" bgClass="bg-orange-50" barColor="#f97316" graphData={batchTrendData.daily} graphKey="feed" />
        {/* UPDATED VITAMINS ICON TO FLASKCONICAL (MATCHING MEDKIT STYLE) */}
        <MetricCard title="Vitamins" value={stats.totalVitaminGrams} unit="g/ml" icon={FlaskConical} colorClass="text-green-700" bgClass="bg-green-50" barColor="#16a34a" graphData={batchTrendData.daily} graphKey="vitamins" />
        <MetricCard title="Avg Weight" value={stats.avgWeight} unit="g" icon={Scale} colorClass="text-amber-700" bgClass="bg-amber-50" barColor="#d97706" graphData={batchTrendData.weekly} graphKey="weight" xKey="name" />
        <MetricCard title="Qty Harvested" value={stats.qtyHarvested} prevValue={prevMetrics ? prevMetrics.harvested : 0} unit="heads" icon={CheckCircle} colorClass="text-emerald-700" bgClass="bg-emerald-50" barColor="#10b981" isComparison={true} />
      </div>

      {/* --- SECTION 3: FEED CHART SECTION --- */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-50">
            {/* UPDATED ICON BOX */}
            <div className="flex items-center gap-2"><div className="p-2 bg-orange-50 rounded-lg"><Package size={18} className="text-orange-600" /></div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Feed Consumption Forecast</h3></div>
            <div className="flex flex-wrap gap-2 text-xs">
                <div key="Booster" className="px-3 py-1 bg-yellow-50 rounded-lg border border-yellow-100"><span className="block text-[9px] font-bold text-yellow-600 uppercase">Booster</span><span className="font-black text-gray-700 text-sm">{feedBreakdown['Booster'] ? feedBreakdown['Booster'].toFixed(1) : '0.0'}</span></div>
                <div key="Starter" className="px-3 py-1 bg-orange-50 rounded-lg border border-orange-100"><span className="block text-[9px] font-bold text-orange-600 uppercase">Starter</span><span className="font-black text-gray-700 text-sm">{feedBreakdown['Starter'] ? feedBreakdown['Starter'].toFixed(1) : '0.0'}</span></div>
                <div key="Finisher" className="px-3 py-1 bg-red-50 rounded-lg border border-red-100"><span className="block text-[9px] font-bold text-red-600 uppercase">Finisher</span><span className="font-black text-gray-700 text-sm">{feedBreakdown['Finisher'] ? feedBreakdown['Finisher'].toFixed(1) : '0.0'}</span></div>
                <div className="px-3 py-1 bg-indigo-600 rounded-lg border border-indigo-700 text-white"><span className="block text-[9px] font-bold uppercase opacity-80">Total</span><span className="font-black text-sm">{feedBreakdown.Total.toFixed(1)} kg</span></div>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 h-64 w-full">
              {!loadingForecast && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="feedStroke" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#FACC15" />   
                            <stop offset="33%" stopColor="#FACC15" />  
                            <stop offset="33%" stopColor="#F97316" />  
                            <stop offset="73%" stopColor="#F97316" />  
                            <stop offset="73%" stopColor="#EF4444" />  
                            <stop offset="100%" stopColor="#EF4444" /> 
                        </linearGradient>
                        <linearGradient id="feedFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} /><Tooltip content={<CustomFeedTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Area name="Feed Intake" type="monotone" dataKey="targetKilos" stroke="url(#feedStroke)" fill="url(#feedFill)" strokeWidth={3} />
                    <ReferenceLine x={currentBatchDay} stroke="#f97316" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#f97316', fontSize: 10, fontWeight: 'bold' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="lg:col-span-1 bg-[#3B0A0A] rounded-2xl p-4 shadow-xl text-white">
                <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3"><Clock size={14} className="text-orange-400" /><h4 className="text-[10px] font-black uppercase tracking-widest">Today's Split (Day {currentBatchDay}/30)</h4></div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 text-[8px] font-black text-white/40 uppercase px-1"><span>Recommend</span><span className="text-right">Actual Used</span></div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5"><div className="flex items-center gap-1 text-[9px] font-black text-orange-300 uppercase mb-2"><Sun size={12}/> AM Period</div><div className="flex justify-between items-end"><span className="text-sm font-black">{(todayFeedStats.recommended / 2).toFixed(2)} <span className="text-[8px] text-white/40 font-normal">kg</span></span><span className="text-sm font-black text-white">{todayFeedStats.actual > (todayFeedStats.recommended / 2) ? (todayFeedStats.recommended / 2).toFixed(2) : todayFeedStats.actual.toFixed(2)} <span className="text-[8px] text-white/40 font-normal ml-1">kg</span></span></div></div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5"><div className="flex items-center gap-1 text-[9px] font-black text-indigo-300 uppercase mb-2"><Moon size={12}/> PM Period</div><div className="flex justify-between items-end"><span className="text-sm font-black">{(todayFeedStats.recommended / 2).toFixed(2)} <span className="text-[8px] text-white/40 font-normal">kg</span></span><span className="text-sm font-black text-white">{todayFeedStats.actual > (todayFeedStats.recommended / 2) ? (todayFeedStats.actual - (todayFeedStats.recommended / 2)).toFixed(2) : '0.00'} <span className="text-[8px] text-white/40 font-normal ml-1">kg</span></span></div></div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10"><div className="flex justify-between text-[9px] font-black text-white/40 uppercase mb-2"><span>Daily Coverage</span><span>{todayFeedStats.recommended > 0 ? ((todayFeedStats.actual / todayFeedStats.recommended) * 100).toFixed(0) : 0}%</span></div><div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-700" style={{ width: `${todayFeedStats.recommended > 0 ? Math.min((todayFeedStats.actual / todayFeedStats.recommended) * 100, 100) : 0}%` }} /></div><div className="flex justify-between mt-3 text-[10px] font-black"><span className="text-orange-300 uppercase tracking-tighter">{todayFeedStats.type}</span><span className="text-white">Day {currentBatchDay}</span></div></div>
            </div>
        </div>
      </div>

      {/* --- SECTION 4: VITAMIN & MEDICINE FORECAST --- */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-50">
            {/* UPDATED ICON BOX */}
            <div className="flex items-center gap-2">
                <div className="p-2 bg-green-50 rounded-lg"><FlaskConical size={18} className="text-green-600" /></div>
                <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Vitamins Consumption Forecast</h3>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyVitaminChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                    <Tooltip content={<CustomVitaminTooltip />} />
                    <Bar dataKey="dosage" radius={[4, 4, 0, 0]} barSize={15}>
                      {dailyVitaminChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={getVitaminColor(entry.activeNames)} />
                      ))}
                    </Bar>
                    <ReferenceLine x={currentBatchDay} stroke="#f97316" strokeWidth={2} strokeDasharray="3 3" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="lg:col-span-1 bg-teal-900 rounded-2xl p-4 shadow-xl text-white">
              <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                  <Clock size={14} className="text-teal-400" />
                  <h4 className="text-[10px] font-black uppercase tracking-widest">Today's Split (Day {currentBatchDay}/30)</h4>
              </div>
              
              {todayVitaminStats.names.length > 0 ? (
                  <div className="space-y-4">
                      <div className="grid grid-cols-2 text-[8px] font-black text-white/40 uppercase px-1">
                          <span>Recommend</span><span className="text-right">Actual Used</span>
                      </div>
                      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                          <div className="flex items-center gap-1 text-[9px] font-black text-teal-300 uppercase mb-2">
                              <Sun size={12}/> AM Period
                          </div>
                          <div className="flex justify-between items-end">
                              <span className="text-sm font-black">
                                  {(todayVitaminStats.totalTarget / 2).toFixed(2)} 
                                  <span className="text-[8px] text-white/40 font-normal ml-1">{todayVitaminStats.unit}</span>
                              </span>
                              <span className="text-sm font-black text-white">
                                  {todayVitaminStats.actual > (todayVitaminStats.totalTarget / 2) 
                                      ? (todayVitaminStats.totalTarget / 2).toFixed(2) 
                                      : todayVitaminStats.actual.toFixed(2)} 
                                  <span className="text-[8px] text-white/40 font-normal ml-1">{todayVitaminStats.unit}</span>
                              </span>
                          </div>
                      </div>
                      <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                          <div className="flex items-center gap-1 text-[9px] font-black text-emerald-300 uppercase mb-2">
                              <Moon size={12}/> PM Period
                          </div>
                          <div className="flex justify-between items-end">
                              <span className="text-sm font-black">
                                  {(todayVitaminStats.totalTarget / 2).toFixed(2)} 
                                  <span className="text-[8px] text-white/40 font-normal ml-1">{todayVitaminStats.unit}</span>
                              </span>
                              <span className="text-sm font-black text-white">
                                  {todayVitaminStats.actual > (todayVitaminStats.totalTarget / 2) 
                                      ? (todayVitaminStats.actual - (todayVitaminStats.totalTarget / 2)).toFixed(2) 
                                      : '0.00'} 
                                  <span className="text-[8px] text-white/40 font-normal ml-1">{todayVitaminStats.unit}</span>
                              </span>
                          </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/10">
                          <div className="flex justify-between text-[9px] font-black text-white/40 uppercase mb-2">
                              <span>Daily Coverage</span>
                              <span>{todayVitaminStats.totalTarget > 0 ? ((todayVitaminStats.actual / todayVitaminStats.totalTarget) * 100).toFixed(0) : 0}%</span>
                          </div>
                          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                              <div 
                                  className="bg-gradient-to-r from-teal-400 to-emerald-500 h-full transition-all duration-700" 
                                  style={{ width: `${todayVitaminStats.totalTarget > 0 ? Math.min((todayVitaminStats.actual / todayVitaminStats.totalTarget) * 100, 100) : 0}%` }} 
                              />
                          </div>
                          <div className="flex justify-between mt-3 text-[10px] font-black">
                              <span className="text-teal-300 uppercase tracking-tighter truncate max-w-[120px]">
                                  {todayVitaminStats.names.join(', ')}
                              </span>
                              <span className="text-white">Day {currentBatchDay}</span>
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-50 text-center space-y-2">
                      <CheckCircle size={32} />
                      <p className="text-xs font-bold uppercase">No Meds Required Today</p>
                  </div>
              )}
            </div>
        </div>
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"><div className="flex items-center gap-2 mb-6"><div className="p-2 bg-rose-50 rounded-lg"><PieIcon size={18} className="text-rose-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Expense Overview</h3></div></div><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expensePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">{expensePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(value)} /><Legend iconType="circle" /></PieChart></ResponsiveContainer></div></div>
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100"><div className="flex items-center gap-2 mb-6"><div className="p-2 bg-blue-50 rounded-lg"><BarChart3 size={18} className="text-blue-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">History Comparison</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Net Income Across Batches</p></div></div><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={historyComparisonData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [formatCurrency(value), 'Net Income']} /><Bar dataKey="income" radius={[10, 10, 0, 0]} barSize={40}>{historyComparisonData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.status === 'active' ? '#f97316' : '#3B0A0A'} />)}</Bar></BarChart></ResponsiveContainer></div></div>
      </div>

      {/* --- COMPARE MODAL --- */}
      {showCompareModal && previousBatch && currentMetrics && prevMetrics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-red-900 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-lg flex items-center gap-2"><GitCompare size={20}/> Batch Comparison</h3>
                    <button onClick={() => setShowCompareModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={20}/></button>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-3 text-xs font-bold text-gray-400 uppercase border-b pb-2 mb-2"><span>Metric</span><span className="text-center text-orange-600">{currentMetrics.name} (Current)</span><span className="text-center text-gray-600">{prevMetrics.name} (Last)</span></div>
                    <div className="space-y-4 text-sm text-gray-700">
                        <div className="grid grid-cols-3 items-center"><span className="font-bold">Starting Pop.</span><span className="text-center font-black">{currentMetrics.population}</span><span className="text-center">{prevMetrics.population}</span></div>
                        <div className="grid grid-cols-3 items-center border-t pt-3"><span className="font-bold">Total Sales</span><div className="text-center flex items-center justify-center gap-1"><span className={`font-black ${currentMetrics.sales < prevMetrics.sales ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(currentMetrics.sales)}</span></div><span className="text-center">{formatCurrency(prevMetrics.sales)}</span></div>
                        <div className="grid grid-cols-3 items-center"><span className="font-bold">Harvested</span><div className="text-center flex items-center justify-center gap-1"><span className="font-black">{stats.qtyHarvested} heads</span></div><span className="text-center">{prevMetrics.harvested} heads</span></div>
                    </div>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default RealDashboard;