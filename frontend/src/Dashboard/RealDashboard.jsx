import React, { useEffect, useState, useMemo } from 'react';
import { 
  Layers, TrendingUp, TrendingDown, Users, Skull, 
  Database, Scale, ShoppingBag, 
  LineChart as ChartIcon, Activity, 
  FlaskConical, Wallet, PieChart as PieIcon,
  Clock, Sun, Moon, BarChart3, ArrowUpRight, ArrowDownRight,
  GitCompare, X, Eye, Pill, HeartPulse, CheckCircle,
  Package, Home, Settings, Save, ClipboardList, Utensils, Truck,
  Bell, AlertTriangle, ShoppingCart, ArrowRight, Info,
  ChevronRight, Calendar, DollarSign, Target, Package as Sack
} from 'lucide-react';
import { auth, db } from '../firebase'; 
import { ref, onValue } from 'firebase/database';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ReferenceLine, BarChart, Bar, ComposedChart, Line
} from 'recharts';

const FEED_COLORS = {
    Booster: '#22c55e',
    Starter: '#15803d',
    Finisher: '#eab308',
};

const calculateDaysStrict = (startDateStr) => {
    if (!startDateStr) return 1;
    const [startYear, startMonth, startDay] = startDateStr.split('-').map(Number);
    const start = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    return Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

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
                <span className={isBetter ? 'text-green-600' : 'text-red-600'}>vs Last Batch</span>
              </>
            ) : <span className="text-gray-400">No previous data</span>}
          </div>
        </div>
        <div className={`absolute top-5 right-5 opacity-20 ${colorClass}`}><Eye size={16} /></div>
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
                      {compareData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
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
                    <Area type="monotone" dataKey={graphKey} stroke={barColor} strokeWidth={2} fill={`url(#grad-${graphKey})`} activeDot={{ r: 3 }} />
                  </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
      </div>
    </div>
  );
};

const PenMetricCard = ({ title, count, capacity, chartData }) => {
    const CustomPenTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border border-gray-200 shadow-lg rounded-lg text-xs z-50">
                    <p className="font-bold text-gray-500 uppercase mb-1">{label}</p>
                    {payload.map((entry, index) => (
                        <p key={index} style={{ color: entry.color }} className="font-bold">
                            {entry.name}: {Number(entry.value).toLocaleString()}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="relative group bg-white rounded-2xl shadow-sm border border-gray-100 h-36 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 p-5 flex flex-col justify-between z-10 bg-white group-hover:opacity-0 transition-opacity duration-300 text-center">
                <div className="flex flex-col items-center">
                    <div className="p-2 bg-indigo-50 rounded-full mb-2"><Home size={20} className="text-indigo-600" /></div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
                </div>
                <div>
                    <h3 className="text-2xl font-black text-indigo-900">
                        {count.toLocaleString()} <span className="text-xs font-normal text-gray-400">heads</span>
                    </h3>
                    <div className="w-full bg-gray-100 h-1 mt-3 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${Math.min((count / capacity) * 100, 100)}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 z-20 bg-white p-2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-50 px-2 pt-1">
                    <p className="text-[10px] font-black text-gray-600 uppercase">{title} Stats</p>
                    <span className="text-[9px] text-white px-1.5 py-0.5 rounded font-bold bg-indigo-500">ESTIMATED</span>
                </div>
                <div className="flex-1 w-full h-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                            <Tooltip content={<CustomPenTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={20}>
                                {chartData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

const RealDashboard = ({ onNavigate }) => {
  const [activeBatch, setActiveBatch] = useState(null);
  const [previousBatch, setPreviousBatch] = useState(null); 
  const [allBatchesData, setAllBatchesData] = useState([]); 
  const [forecastData, setForecastData] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); 
  const [loading, setLoading] = useState(true); 
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [showFeedTips, setShowFeedTips] = useState(false);

  const [settings, setSettings] = useState({ population: 0, pens: 5, weight: 50 });
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
    feedByType: {
      Booster: 0,
      Starter: 0,
      Finisher: 0
    }
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
          setSettings({ 
              population: firstActive.startingPopulation || 0, 
              pens: firstActive.penCount || 5, 
              weight: firstActive.averageChickWeight || 50 
          });
          
          let totalExp = 0, totalSales = 0, feedKilos = 0, vitaminGrams = 0, harvestedHeads = 0, totalMortality = 0, currentWeight = 0;
          let boosterTotal = 0, starterTotal = 0, finisherTotal = 0;
          
          // Calculate expenses and feed by type
          if (firstActive.expenses) {
            Object.values(firstActive.expenses).forEach(exp => {
              totalExp += Number(exp.amount || 0);
              
              // Track feed by type
              if (exp.category === 'Feeds' && exp.feedType) {
                const quantity = Number(exp.quantity || 0) * Number(exp.purchaseCount || 1);
                if (exp.feedType === 'Booster') {
                  boosterTotal += quantity;
                } else if (exp.feedType === 'Starter') {
                  starterTotal += quantity;
                } else if (exp.feedType === 'Finisher') {
                  finisherTotal += quantity;
                }
                feedKilos += quantity;
              }
            });
          }
          
          if (firstActive.feed_logs) {
            Object.values(firstActive.feed_logs).forEach(log => {
              feedKilos += (Number(log.am || 0) + Number(log.pm || 0));
            });
          }
          
          if (firstActive.daily_vitamin_logs) {
            Object.values(firstActive.daily_vitamin_logs).forEach(log => {
              vitaminGrams += (Number(log.am_amount || 0) + Number(log.pm_amount || 0));
            });
          }
          
          if (firstActive.sales) {
            Object.values(firstActive.sales).forEach(sale => { 
              totalSales += Number(sale.totalAmount || 0); 
              harvestedHeads += Number(sale.quantity || 0); 
            });
          }
          
          if (firstActive.mortality_logs) {
            Object.values(firstActive.mortality_logs).forEach(log => {
              totalMortality += (Number(log.am || 0) + Number(log.pm || 0));
            });
          }
          
          if (firstActive.weight_logs) {
            const weights = Object.values(firstActive.weight_logs).sort((a,b) => b.day - a.day);
            if (weights.length > 0) currentWeight = Number(weights[0].averageWeight || 0); 
          }
          
          setStats({ 
            expenses: totalExp, 
            sales: totalSales, 
            totalFeedKilos: feedKilos, 
            totalVitaminGrams: vitaminGrams, 
            qtyHarvested: harvestedHeads, 
            mortality: totalMortality, 
            avgWeight: currentWeight,
            feedByType: {
              Booster: boosterTotal,
              Starter: starterTotal,
              Finisher: finisherTotal
            }
          });
        }
      }
      setLoading(false); 
    });
    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const getForecasts = async () => {
      if (activeBatch && activeBatch.id && currentUser) {
        setLoadingForecast(true);
        try {
          const token = await currentUser.getIdToken();
          const feedRes = await fetch(`${backendUrl}/get-feed-forecast/${activeBatch.id}`, { headers: { 'Authorization': `Bearer ${token}` }});
          if (feedRes.ok) {
              const data = await feedRes.json();
              const feed = data.feedForecast || [];
              const weight = data.weightForecast || [];
              const mergedData = feed.map(f => {
                  const matchingWeight = weight.find(w => w.day && parseInt(w.day.replace('Day ', '')) === f.day);
                  return {
                      ...f,
                      Booster: f.feedType === 'Booster' ? f.targetKilos : 0,
                      Starter: f.feedType === 'Starter' ? f.targetKilos : 0,
                      Finisher: f.feedType === 'Finisher' ? f.targetKilos : 0,
                      projectedWeight: matchingWeight ? matchingWeight.weight : null, 
                      avgWeight: matchingWeight ? matchingWeight.avgWeight : null
                  };
              });
              setForecastData(mergedData);
          }
        } catch (err) { console.error(err); } finally { setLoadingForecast(false); }
      }
    };
    getForecasts();
  }, [activeBatch, currentUser]);

  const handleUpdateSettings = async () => {
      if(!activeBatch) return;
      try {
          const token = await currentUser.getIdToken();
          await fetch(`${backendUrl}/update-batch-settings/${activeBatch.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ 
                  startingPopulation: parseInt(settings.population), 
                  penCount: parseInt(settings.pens), 
                  averageChickWeight: parseFloat(settings.weight) 
              })
          });
          setShowSettingsModal(false);
      } catch(err) { console.error(err); }
  };

  const handleNavigateToExpenses = () => {
    if (onNavigate) {
      onNavigate('Expenses');
    }
  };

  const batchTrendData = useMemo(() => {
      if (!activeBatch) return { daily: [], weekly: [] };
      const [startYear, startMonth, startDay] = activeBatch.dateCreated.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay);
      const daily = [];
      let currentPop = activeBatch.startingPopulation;
      for (let i = 0; i < 30; i++) {
          const date = new Date(start); 
          date.setDate(date.getDate() + i); 
          const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

  const penDistribution = useMemo(() => {
    if (!activeBatch) return [];
    const currentPopulationCount = (activeBatch.startingPopulation || 0) - stats.mortality - stats.qtyHarvested;
    const penCount = activeBatch.penCount || 5; 
    const basePerPen = Math.floor(currentPopulationCount / penCount);
    const remainder = currentPopulationCount % penCount;
    return Array.from({ length: penCount }, (_, i) => {
        const heads = i < remainder ? basePerPen + 1 : basePerPen;
        const ratio = currentPopulationCount > 0 ? heads / currentPopulationCount : 0;
        return {
            id: i + 1,
            count: heads,
            capacity: Math.ceil((activeBatch.startingPopulation || 0) / penCount),
            stats: [
                { name: 'Mort.', value: Math.round(stats.mortality * ratio) || 0, color: '#ef4444' }, 
                { name: 'Feed', value: Math.round(stats.totalFeedKilos * ratio) || 0, color: '#f97316' }, 
                { name: 'Vits', value: Math.round(stats.totalVitaminGrams * ratio) || 0, color: '#10b981' } 
            ]
        };
    });
  }, [activeBatch, stats]);

  const getBatchMetrics = (batch) => {
    if (!batch) return null;
    let sales = 0, expenses = 0, harvestQty = 0, feedKilos = 0, mort = 0, weight = 0;
    if (batch.expenses) Object.values(batch.expenses).forEach(e => expenses += Number(e.amount || 0));
    if (batch.sales) Object.values(batch.sales).forEach(s => { sales += Number(s.totalAmount || 0); harvestQty += Number(s.quantity || 0); });
    if (batch.feed_logs) Object.values(batch.feed_logs).forEach(f => feedKilos += (Number(f.am || 0) + Number(f.pm || 0)));
    if (batch.mortality_logs) Object.values(batch.mortality_logs).forEach(m => mort += (Number(m.am || 0) + Number(m.pm || 0)));
    if (batch.weight_logs) { const w = Object.values(batch.weight_logs).sort((a,b) => b.day - a.day); if(w.length > 0) weight = Number(w[0].averageWeight || 0); }
    return { name: batch.batchName, population: batch.startingPopulation || 0, sales, expenses, profit: sales - expenses, harvested: harvestQty, feedKilos, mortality: mort, avgWeight: weight };
  };

  const currentBatchDay = useMemo(() => calculateDaysStrict(activeBatch?.dateCreated), [activeBatch]);
  const progress = useMemo(() => {
    if (!activeBatch) return 0;
    const start = new Date(activeBatch.dateCreated).getTime();
    const end = new Date(activeBatch.expectedCompleteDate).getTime();
    const today = new Date().getTime();
    return Math.min(Math.round(((today - start) / (end - start)) * 100), 100);
  }, [activeBatch]);

  const feedBreakdown = useMemo(() => {
    const totals = { Booster: 0, Starter: 0, Finisher: 0, Total: 0 };
    forecastData.forEach(d => { if (totals[d.feedType] !== undefined) totals[d.feedType] += d.targetKilos; totals.Total += d.targetKilos; });
    return totals;
  }, [forecastData]);

  const expensePieData = useMemo(() => {
    if (!activeBatch?.expenses) return [];
    const categories = {};
    Object.values(activeBatch.expenses).forEach(exp => categories[exp.category] = (categories[exp.category] || 0) + Number(exp.amount || 0));
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

  const getFeedStatus = (feedType) => {
    const required = feedBreakdown[feedType] || 0;
    // Get actual purchased amount from expenses
    const purchased = stats.feedByType[feedType] || 0;
    
    // For now, used = purchased (simplified)
    const used = purchased;
    
    const percentage = required > 0 ? (used / required) * 100 : 0;
    const remaining = required - used;
    
    let status = 'good';
    let message = '';
    
    if (remaining < 0) {
      status = 'excess';
      message = `Excess of ${Math.abs(remaining).toFixed(1)} kg`;
    } else if (remaining === 0) {
      status = 'complete';
      message = 'Exactly on target';
    } else if (percentage < 30) {
      status = 'critical';
      message = `Need ${remaining.toFixed(1)} kg urgently`;
    } else if (percentage < 60) {
      status = 'warning';
      message = `Prepare ${remaining.toFixed(1)} kg soon`;
    } else {
      status = 'good';
      message = `Sufficient (${remaining.toFixed(1)} kg left)`;
    }
    
    return { used, required, remaining, percentage, status, message };
  };

  if (loading) return <div className="p-10 text-center text-gray-400 font-bold">Loading Dashboard...</div>;
  if (!activeBatch) return <div className="p-10 text-center"><h3 className="text-xl font-bold text-red-900">No Active Batch</h3></div>;

  const currentPop = (activeBatch.startingPopulation || 0) - stats.qtyHarvested - stats.mortality;
  const currentMetrics = getBatchMetrics(activeBatch);
  const prevMetrics = getBatchMetrics(previousBatch);
  const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  const CustomFeedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return ( 
        <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Day {label}</p>
            <p className="text-sm font-black text-indigo-600">{data.feedType}</p>
            {data.projectedWeight && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-purple-600">Est. Total Batch: {data.projectedWeight} kg</p>
                    <p className="text-[10px] text-gray-400">Est. Avg per Bird: {data.avgWeight} g</p>
                </div>
            )}
        </div> 
      );
    } 
    return null;
  };

  const boosterStatus = getFeedStatus('Booster');
  const starterStatus = getFeedStatus('Starter');
  const finisherStatus = getFeedStatus('Finisher');

  return (
    <div className="flex-1 bg-gray-50 -mt-7 p-4 overflow-y-auto pb-20 relative">
      {/* HEADER */}
      <div className="bg-[#3B0A0A] p-6 rounded-2xl shadow-xl text-white mb-8 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
              <Layers size={20} className="text-orange-400"/><h1 className="text-2xl font-bold uppercase">{activeBatch.batchName}</h1>
              {previousBatch && <button onClick={() => setShowCompareModal(true)} className="ml-2 flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg text-[10px] uppercase font-bold transition-colors border border-white/10"><GitCompare size={12} /> Compare vs Last</button>}
          </div>
          <div className="flex items-center gap-2">
            {/* NOTIFICATION ICON */}
            <div className="relative group/notify">
                <button className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors relative">
                    <Bell size={16} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-[#3B0A0A]"></span>
                </button>
                <div className="absolute top-full right-0 mt-2 scale-0 group-hover/notify:scale-100 transition-transform origin-top-right bg-white text-gray-800 text-[10px] font-bold py-1 px-2 rounded shadow-lg whitespace-nowrap z-50">
                    BATCH ALERTS
                </div>
            </div>

            <button onClick={() => setShowSettingsModal(true)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"><Settings size={16} /></button>
            <span className="text-xs text-orange-200 font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded">Day {currentBatchDay} / 30</span>
            <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded border border-green-500/30 font-bold uppercase">{activeBatch.status}</span>
          </div>
        </div>
        <div className="relative z-10 w-full bg-black/30 h-3 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-500 shadow-lg" style={{ width: `${progress}%` }} /></div>
        <div className="relative z-10 flex justify-between mt-2 text-xs font-bold text-white/50 uppercase"><span>Started: {activeBatch.dateCreated}</span><span className="text-orange-300">Harvest: {activeBatch.expectedCompleteDate}</span></div>
      </div>

      {/* METRICS */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Financial Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard title="Total Sales" value={stats.sales} prevValue={prevMetrics?.sales || 0} icon={ShoppingBag} colorClass="text-blue-700" bgClass="bg-blue-50" barColor="#2563eb" isCurrency={true} isComparison={true} />
        <MetricCard title="Net Profit" value={stats.sales - stats.expenses} prevValue={prevMetrics?.profit || 0} icon={Wallet} colorClass={stats.sales - stats.expenses >= 0 ? "text-emerald-700" : "text-red-700"} bgClass={stats.sales - stats.expenses >= 0 ? "bg-emerald-50" : "bg-red-50"} barColor="#10b981" isCurrency={true} isComparison={true} />
        <MetricCard title="Total Expenses" value={stats.expenses} prevValue={prevMetrics?.expenses || 0} icon={TrendingDown} colorClass="text-red-700" bgClass="bg-red-50" barColor="#dc2626" isCurrency={true} isInverse={true} isComparison={true} />
      </div>

      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Batch Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <MetricCard title="Live Pop." value={currentPop} unit="heads" icon={Users} colorClass="text-cyan-700" bgClass="bg-cyan-50" barColor="#0891b2" graphData={batchTrendData.daily} graphKey="population" />
        <MetricCard title="Mortality" value={stats.mortality} unit="heads" icon={Skull} colorClass="text-red-600" bgClass="bg-red-50" barColor="#dc2626" graphData={batchTrendData.daily} graphKey="mortality" />
        <MetricCard title="Feed Used" value={stats.totalFeedKilos} unit="kg" icon={Package} colorClass="text-orange-700" bgClass="bg-orange-50" barColor="#f97316" graphData={batchTrendData.daily} graphKey="feed" />
        <MetricCard title="Vitamins" value={stats.totalVitaminGrams} unit="g/ml" icon={FlaskConical} colorClass="text-green-700" bgClass="bg-green-50" barColor="#16a34a" graphData={batchTrendData.daily} graphKey="vitamins" />
        <MetricCard title="Avg Weight" value={stats.avgWeight} unit="g" icon={Scale} colorClass="text-amber-700" bgClass="bg-amber-50" barColor="#d97706" graphData={batchTrendData.weekly} graphKey="weight" xKey="name" />
        <MetricCard title="Qty Harvested" value={stats.qtyHarvested} prevValue={prevMetrics?.harvested || 0} unit="heads" icon={CheckCircle} colorClass="text-emerald-700" bgClass="bg-emerald-50" barColor="#10b981" isComparison={true} />
      </div>

      {/* PEN STATUS */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Pen Status</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {penDistribution.map((pen) => (
          <PenMetricCard key={pen.id} title={`Pen ${pen.id}`} count={pen.count} capacity={pen.capacity} chartData={pen.stats} />
        ))}
      </div>

      {/* FULL WIDTH FORECAST CHART */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-50">
            <div className="flex items-center gap-2">
                <div className="p-2 bg-orange-50 rounded-lg"><Package size={18} className="text-orange-600" /></div>
                <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Feed Consumption & Weight Forecast</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Left: Feed (KG) | Right: Est. Total Batch Weight (KG)</p>
                </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
                <div className="px-3 py-1 bg-green-50 rounded-lg border border-green-100"><span className="block text-[9px] font-bold text-green-600 uppercase">Booster</span><span className="font-black text-gray-700 text-sm">{feedBreakdown.Booster.toFixed(1)}</span></div>
                <div className="px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100"><span className="block text-[9px] font-bold text-emerald-600 uppercase">Starter</span><span className="font-black text-gray-700 text-sm">{feedBreakdown.Starter.toFixed(1)}</span></div>
                <div className="px-3 py-1 bg-yellow-50 rounded-lg border border-yellow-100"><span className="block text-[9px] font-bold text-yellow-600 uppercase">Finisher</span><span className="font-black text-gray-700 text-sm">{feedBreakdown.Finisher.toFixed(1)}</span></div>
                <div className="px-3 py-1 bg-indigo-600 rounded-lg border border-indigo-700 text-white"><span className="block text-[9px] font-bold uppercase opacity-80">Total</span><span className="font-black text-sm">{feedBreakdown.Total.toFixed(1)} kg</span></div>
            </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-4 h-80 w-full">
              {!loadingForecast && (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={forecastData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#8b5cf6'}} />
                    <Tooltip content={<CustomFeedTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Area yAxisId="left" type="monotone" dataKey="Booster" stackId="1" stroke={FEED_COLORS.Booster} fill={FEED_COLORS.Booster} strokeWidth={2} fillOpacity={0.6} />
                    <Area yAxisId="left" type="monotone" dataKey="Starter" stackId="1" stroke={FEED_COLORS.Starter} fill={FEED_COLORS.Starter} strokeWidth={2} fillOpacity={0.6} />
                    <Area yAxisId="left" type="monotone" dataKey="Finisher" stackId="1" stroke={FEED_COLORS.Finisher} fill={FEED_COLORS.Finisher} strokeWidth={2} fillOpacity={0.6} />
                    <Line yAxisId="right" connectNulls type="monotone" dataKey="projectedWeight" name="Est. Total Batch Weight (kg)" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff'}} activeDot={{ r: 6 }} />
                    <ReferenceLine yAxisId="left" x={currentBatchDay} stroke="#f97316" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#f97316', fontSize: 10, fontWeight: 'bold' }} />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
        </div>
      </div>

      {/* FEED INSIGHT SECTION - With Sack Icons */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        {/* Header with Sack Icon */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Sack size={18} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Feed Inventory Status</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Based on expenses and forecasts</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFeedTips(!showFeedTips)}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold transition-all"
            >
              <Info size={14} />
              {showFeedTips ? 'Hide Tips' : 'Tips'}
            </button>
            
            <button 
              onClick={handleNavigateToExpenses}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <ShoppingCart size={16} />
              Manage Feed Expenses
              <ArrowRight size={16} />
            </button>
          </div>
        </div>

        {/* Feed Tips Panel (Collapsible) */}
        {showFeedTips && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Info size={18} className="text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-black text-blue-800 mb-2">Quick Feed Tips</h4>
                <ul className="space-y-2 text-xs">
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 bg-blue-600 rounded-full mt-1.5"></div>
                    <span className="text-blue-700">Keep at least 3 days of feed stock to avoid interruptions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 bg-blue-600 rounded-full mt-1.5"></div>
                    <span className="text-blue-700">Check feed quality before each feeding</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <div className="w-1 h-1 bg-blue-600 rounded-full mt-1.5"></div>
                    <span className="text-blue-700">Record feed consumption daily to track efficiency</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Main Feed Insight Cards - With Sack Icons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Booster Card */}
          <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg ${
            boosterStatus.status === 'critical' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
            boosterStatus.status === 'warning' ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300' :
            'bg-gradient-to-br from-green-50 to-green-100 border-green-300'
          }`}>
            <div className="p-5">
              {/* Header with Sack Icon */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  boosterStatus.status === 'critical' ? 'bg-red-200' :
                  boosterStatus.status === 'warning' ? 'bg-amber-200' :
                  'bg-green-200'
                }`}>
                  <Sack size={22} className={
                    boosterStatus.status === 'critical' ? 'text-red-700' :
                    boosterStatus.status === 'warning' ? 'text-amber-700' :
                    'text-green-700'
                  } />
                </div>
                <div>
                  <h4 className="font-black text-base text-gray-800">Booster Feed</h4>
                  <p className="text-[10px] text-gray-500">High-protein starter</p>
                </div>
              </div>

              {/* Progress Circle */}
              <div className="flex items-center justify-between mb-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#e5e7eb"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke={boosterStatus.status === 'critical' ? '#ef4444' : boosterStatus.status === 'warning' ? '#f59e0b' : '#22c55e'}
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - boosterStatus.percentage / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-black">{Math.round(boosterStatus.percentage)}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-800">{boosterStatus.used.toFixed(1)}<span className="text-xs font-normal text-gray-500 ml-1">kg</span></p>
                  <p className="text-xs text-gray-500">of {boosterStatus.required.toFixed(1)} kg</p>
                </div>
              </div>

              {/* Status Message */}
              <div className={`p-3 rounded-xl mb-3 ${
                boosterStatus.status === 'critical' ? 'bg-red-200/50' :
                boosterStatus.status === 'warning' ? 'bg-amber-200/50' :
                boosterStatus.status === 'excess' ? 'bg-blue-200/50' :
                'bg-green-200/50'
              }`}>
                <div className="flex items-start gap-2">
                  {boosterStatus.status === 'critical' && <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />}
                  {boosterStatus.status === 'warning' && <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                  {boosterStatus.status === 'good' && <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />}
                  {boosterStatus.status === 'excess' && <CheckCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />}
                  <p className={`text-xs font-bold ${
                    boosterStatus.status === 'critical' ? 'text-red-700' :
                    boosterStatus.status === 'warning' ? 'text-amber-700' :
                    boosterStatus.status === 'excess' ? 'text-blue-700' :
                    'text-green-700'
                  }`}>
                    {boosterStatus.message}
                  </p>
                </div>
              </div>

              {/* Action Buttons - Only Buy button remains */}
              <div className="flex gap-2">
                <button 
                  onClick={handleNavigateToExpenses}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart size={14} />
                  Buy More
                </button>
              </div>
            </div>
          </div>

          {/* Starter Card */}
          <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg ${
            starterStatus.status === 'critical' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
            starterStatus.status === 'warning' ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300' :
            'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300'
          }`}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  starterStatus.status === 'critical' ? 'bg-red-200' :
                  starterStatus.status === 'warning' ? 'bg-amber-200' :
                  'bg-emerald-200'
                }`}>
                  <Sack size={22} className={
                    starterStatus.status === 'critical' ? 'text-red-700' :
                    starterStatus.status === 'warning' ? 'text-amber-700' :
                    'text-emerald-700'
                  } />
                </div>
                <div>
                  <h4 className="font-black text-base text-gray-800">Starter Feed</h4>
                  <p className="text-[10px] text-gray-500">Balanced nutrition</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke={starterStatus.status === 'critical' ? '#ef4444' : starterStatus.status === 'warning' ? '#f59e0b' : '#15803d'}
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - starterStatus.percentage / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-black">{Math.round(starterStatus.percentage)}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-800">{starterStatus.used.toFixed(1)}<span className="text-xs font-normal text-gray-500 ml-1">kg</span></p>
                  <p className="text-xs text-gray-500">of {starterStatus.required.toFixed(1)} kg</p>
                </div>
              </div>

              <div className={`p-3 rounded-xl mb-3 ${
                starterStatus.status === 'critical' ? 'bg-red-200/50' :
                starterStatus.status === 'warning' ? 'bg-amber-200/50' :
                starterStatus.status === 'excess' ? 'bg-blue-200/50' :
                'bg-emerald-200/50'
              }`}>
                <div className="flex items-start gap-2">
                  {starterStatus.status === 'critical' && <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />}
                  {starterStatus.status === 'warning' && <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                  {starterStatus.status === 'good' && <CheckCircle size={16} className="text-emerald-600 flex-shrink-0 mt-0.5" />}
                  {starterStatus.status === 'excess' && <CheckCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />}
                  <p className={`text-xs font-bold ${
                    starterStatus.status === 'critical' ? 'text-red-700' :
                    starterStatus.status === 'warning' ? 'text-amber-700' :
                    starterStatus.status === 'excess' ? 'text-blue-700' :
                    'text-emerald-700'
                  }`}>
                    {starterStatus.message}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={handleNavigateToExpenses}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart size={14} />
                  Buy More
                </button>
              </div>
            </div>
          </div>

          {/* Finisher Card */}
          <div className={`relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-lg ${
            finisherStatus.status === 'critical' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
            finisherStatus.status === 'warning' ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300' :
            'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300'
          }`}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2.5 rounded-xl ${
                  finisherStatus.status === 'critical' ? 'bg-red-200' :
                  finisherStatus.status === 'warning' ? 'bg-amber-200' :
                  'bg-yellow-200'
                }`}>
                  <Sack size={22} className={
                    finisherStatus.status === 'critical' ? 'text-red-700' :
                    finisherStatus.status === 'warning' ? 'text-amber-700' :
                    'text-yellow-700'
                  } />
                </div>
                <div>
                  <h4 className="font-black text-base text-gray-800">Finisher Feed</h4>
                  <p className="text-[10px] text-gray-500">Weight gain formula</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <div className="relative w-16 h-16">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="#e5e7eb" strokeWidth="6" fill="none" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke={finisherStatus.status === 'critical' ? '#ef4444' : finisherStatus.status === 'warning' ? '#f59e0b' : '#eab308'}
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * (1 - finisherStatus.percentage / 100)}`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-black">{Math.round(finisherStatus.percentage)}%</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-gray-800">{finisherStatus.used.toFixed(1)}<span className="text-xs font-normal text-gray-500 ml-1">kg</span></p>
                  <p className="text-xs text-gray-500">of {finisherStatus.required.toFixed(1)} kg</p>
                </div>
              </div>

              <div className={`p-3 rounded-xl mb-3 ${
                finisherStatus.status === 'critical' ? 'bg-red-200/50' :
                finisherStatus.status === 'warning' ? 'bg-amber-200/50' :
                finisherStatus.status === 'excess' ? 'bg-blue-200/50' :
                'bg-yellow-200/50'
              }`}>
                <div className="flex items-start gap-2">
                  {finisherStatus.status === 'critical' && <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />}
                  {finisherStatus.status === 'warning' && <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                  {finisherStatus.status === 'good' && <CheckCircle size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />}
                  {finisherStatus.status === 'excess' && <CheckCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />}
                  <p className={`text-xs font-bold ${
                    finisherStatus.status === 'critical' ? 'text-red-700' :
                    finisherStatus.status === 'warning' ? 'text-amber-700' :
                    finisherStatus.status === 'excess' ? 'text-blue-700' :
                    'text-yellow-700'
                  }`}>
                    {finisherStatus.message}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={handleNavigateToExpenses}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <ShoppingCart size={14} />
                  Buy More
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Critical Alert Banner */}
        {(boosterStatus.status === 'critical' || starterStatus.status === 'critical' || finisherStatus.status === 'critical') && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle size={20} className="text-red-500" />
              <div>
                <p className="text-sm font-black text-red-800">Critical Feed Alert!</p>
                <p className="text-xs text-red-600">Some feed types are running low. Order immediately.</p>
              </div>
            </div>
            <button 
              onClick={handleNavigateToExpenses}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"
            >
              Order Now
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* CHARTS ROW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-rose-50 rounded-lg">
              <PieIcon size={18} className="text-rose-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Expense Overview</h3>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={expensePieData} 
                  cx="50%" 
                  cy="50%" 
                  innerRadius={60} 
                  outerRadius={100} 
                  paddingAngle={5} 
                  dataKey="value"
                >
                  {expensePieData.map((entry, index) => 
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  )}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-blue-50 rounded-lg">
              <BarChart3 size={18} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">History Comparison</h3>
            </div>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historyComparisonData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [formatCurrency(v), 'Net Income']} />
                <Bar dataKey="income" radius={[10, 10, 0, 0]} barSize={40}>
                  {historyComparisonData.map((entry, index) => 
                    <Cell key={`cell-${index}`} fill={entry.status === 'active' ? '#f97316' : '#3B0A0A'} />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-gray-900 p-4 text-white flex justify-between items-center">
                    <h3 className="font-bold text-sm uppercase flex items-center gap-2"><Settings size={16}/> Configuration</h3>
                    <button onClick={() => setShowSettingsModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={16}/></button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Starting Population</label>
                        <input type="number" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none" 
                            value={settings.population} onChange={(e) => setSettings({...settings, population: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Number of Pens</label>
                        <input type="number" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none" 
                            value={settings.pens} onChange={(e) => setSettings({...settings, pens: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Avg Starting Weight (g)</label>
                        <input type="number" step="0.1" className="w-full p-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none" 
                            value={settings.weight} onChange={(e) => setSettings({...settings, weight: e.target.value})} />
                        <p className="text-[10px] text-gray-400 mt-1">Default: 33g - 50g</p>
                    </div>
                    <button onClick={handleUpdateSettings} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors">
                        <Save size={18} /> Save Configuration
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* COMPARE MODAL */}
      {showCompareModal && previousBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-red-900 p-4 text-white flex justify-between items-center">
                  <h3 className="font-bold text-lg">Batch Comparison</h3>
                  <button onClick={() => setShowCompareModal(false)}><X size={20}/></button>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-3 text-xs font-bold text-gray-400 border-b pb-2 mb-2">
                      <span>Metric</span>
                      <span className="text-center">Current</span>
                      <span className="text-center">Previous</span>
                    </div>
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-3">
                          <span>Pop.</span>
                          <span className="text-center font-black">{currentMetrics.population}</span>
                          <span className="text-center">{prevMetrics.population}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span>Sales</span>
                          <span className="text-center font-black">{formatCurrency(currentMetrics.sales)}</span>
                          <span className="text-center">{formatCurrency(prevMetrics.sales)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default RealDashboard;