import React, { useEffect, useState, useMemo } from 'react';
import { 
  Layers, TrendingUp, TrendingDown, Users, Skull, 
  Database, Scale, ShoppingBag, 
  LineChart as ChartIcon, Activity, 
  FlaskConical, Wallet, PieChart as PieIcon,
  Clock, Sun, Moon, BarChart3, ArrowUpRight, ArrowDownRight,
  GitCompare, X
} from 'lucide-react';
import { auth, db } from '../firebase'; 
import { ref, onValue } from 'firebase/database';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, ReferenceLine, BarChart, Bar
} from 'recharts';

const RealDashboard = () => {
  const [activeBatch, setActiveBatch] = useState(null);
  const [previousBatch, setPreviousBatch] = useState(null); // NEW: Store previous batch
  const [allBatchesData, setAllBatchesData] = useState([]); 
  const [forecastData, setForecastData] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [loading, setLoading] = useState(true); 
  const [showCompareModal, setShowCompareModal] = useState(false); // NEW: Modal State

  // --- CONSTANTS ---
  const ESTIMATED_MORTALITY = 0; // Replace with real DB value if available
  const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

  // --- DERIVED STATS ---
  const [stats, setStats] = useState({
    expenses: 0,
    sales: 0,
    totalFeedKilos: 0, 
    totalVitaminGrams: 0, 
    qtyHarvested: 0, 
  });

  const backendUrl = "http://localhost:8000";

  // 1. Wait for Auth
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Data
  useEffect(() => {
    if (!currentUser) return;

    const batchesRef = ref(db, 'global_batches');
    const unsubscribe = onValue(batchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allBatches = snapshot.val();
        // Sort batches by date created (descending) to find the "Last" batch easily
        const batchList = Object.entries(allBatches)
          .map(([id, data]) => ({ id, ...data }))
          .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
        
        const firstActive = batchList.find(b => b.status === 'active');
        // Find the most recent COMPLETED batch for comparison
        const lastCompleted = batchList.find(b => b.status === 'completed');

        setActiveBatch(firstActive);
        setPreviousBatch(lastCompleted); // Set the previous batch
        setAllBatchesData(batchList);

        let totalExp = 0, totalSales = 0, feedKilos = 0, vitaminGrams = 0, harvestedHeads = 0;

        if (firstActive) {
          // --- CALCULATE REGULAR EXPENSES ---
          if (firstActive.expenses) {
            Object.values(firstActive.expenses).forEach(exp => {
              const cost = (Number(exp.amount) * Number(exp.quantity || 1));
              totalExp += cost;
            });
          }

          // --- CALCULATE USED FEEDS ---
          if (firstActive.usedFeeds) {
            Object.values(firstActive.usedFeeds).forEach(f => {
              feedKilos += Number(f.quantity || 0);
              if (f.pricePerUnit) totalExp += (Number(f.pricePerUnit) * Number(f.quantity));
            });
          }

          // --- CALCULATE USED VITAMINS ---
          if (firstActive.usedVitamins) {
            Object.values(firstActive.usedVitamins).forEach(v => {
              vitaminGrams += Number(v.quantity || 0);
              if (v.pricePerUnit) totalExp += (Number(v.pricePerUnit) * Number(v.quantity));
            });
          }

          if (firstActive.sales) {
            Object.values(firstActive.sales).forEach(sale => {
              totalSales += Number(sale.totalAmount || 0);
              harvestedHeads += Number(sale.quantity || 0);
            });
          }
        }

        setStats(prev => ({
          ...prev, expenses: totalExp, sales: totalSales, totalFeedKilos: feedKilos, 
          totalVitaminGrams: vitaminGrams, qtyHarvested: harvestedHeads
        }));
      }
      setLoading(false); 
    });

    return () => unsubscribe();
  }, [currentUser]);

  // 3. Load Feed Forecast
  useEffect(() => {
    const getForecast = async () => {
      if (activeBatch && activeBatch.id && currentUser) {
        setLoadingForecast(true);
        try {
          const token = await currentUser.getIdToken();
          const response = await fetch(`${backendUrl}/get-feed-forecast/${activeBatch.id}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
          });
          if (!response.ok) throw new Error('Failed to fetch');
          const result = await response.json();
          setForecastData(result.forecast);
        } catch (err) {
          console.error("Forecast Error:", err);
        } finally {
          setLoadingForecast(false);
        }
      }
    };
    getForecast();
  }, [activeBatch, currentUser]);

  // --- HELPER: CALCULATE METRICS FOR ANY BATCH ---
  const getBatchMetrics = (batch) => {
    if (!batch) return null;

    let sales = 0, expenses = 0, harvestQty = 0, feedKilos = 0;
    
    // Calculate totals for the batch passed in
    if (batch.sales) {
       Object.values(batch.sales).forEach(s => {
          sales += Number(s.totalAmount || 0);
          harvestQty += Number(s.quantity || 0);
       });
    }
    if (batch.expenses) Object.values(batch.expenses).forEach(e => expenses += (Number(e.amount) * Number(e.quantity || 1)));
    if (batch.usedFeeds) {
        Object.values(batch.usedFeeds).forEach(f => {
            feedKilos += Number(f.quantity || 0);
            expenses += (Number(f.pricePerUnit || 0) * Number(f.quantity || 0));
        });
    }
    if (batch.usedVitamins) Object.values(batch.usedVitamins).forEach(v => expenses += (Number(v.pricePerUnit || 0) * Number(v.quantity || 0)));

    const startPop = batch.startingPopulation || 0;
    const mortalityRate = startPop > 0 ? ((ESTIMATED_MORTALITY / startPop) * 100).toFixed(1) : 0;
    // Estimated FCR logic
    const estWeight = (startPop - ESTIMATED_MORTALITY) * 1.5; 
    const fcr = estWeight > 0 ? (feedKilos / estWeight).toFixed(2) : "0.00";

    return {
        name: batch.batchName,
        population: startPop,
        sales: sales,
        expenses: expenses,
        profit: sales - expenses,
        mortalityRate: mortalityRate,
        fcr: fcr,
        harvested: harvestQty
    };
  };

  // --- LOGIC: BATCH DAY & TODAY FEED STATS ---
  const currentBatchDay = useMemo(() => {
    if (!activeBatch?.dateCreated) return null;
    const start = new Date(activeBatch.dateCreated).setHours(0,0,0,0);
    const now = new Date().setHours(0,0,0,0);
    const diff = now - start;
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }, [activeBatch]);

  const todayFeedStats = useMemo(() => {
    if (!activeBatch || !forecastData.length) return { recommended: 0, actual: 0 };
    const recommendation = forecastData.find(d => d.day === currentBatchDay);
    const todayStr = new Date().toISOString().split('T')[0];
    let actualToday = 0;
    
    if (activeBatch.usedFeeds) {
        Object.values(activeBatch.usedFeeds).forEach(f => {
            if (f.date === todayStr) {
                actualToday += Number(f.quantity || 0);
            }
        });
    }
    return {
        recommended: recommendation ? recommendation.targetKilos : 0,
        actual: actualToday,
        type: recommendation ? recommendation.feedType : 'N/A'
    };
  }, [activeBatch, forecastData, currentBatchDay]);

  // --- LOGIC FOR HISTORY COMPARISON BAR CHART ---
  const historyComparisonData = useMemo(() => {
    return allBatchesData
      .filter(b => b.status === 'completed' || b.status === 'active')
      .map(b => {
        let exp = 0, sale = 0;
        if (b.expenses) Object.values(b.expenses).forEach(e => exp += (Number(e.amount) * Number(e.quantity || 1)));
        if (b.usedFeeds) Object.values(b.usedFeeds).forEach(f => exp += (Number(f.pricePerUnit || 0) * Number(f.quantity || 0)));
        if (b.usedVitamins) Object.values(b.usedVitamins).forEach(v => exp += (Number(v.pricePerUnit || 0) * Number(v.quantity || 0)));
        
        if (b.sales) Object.values(b.sales).forEach(s => sale += Number(s.totalAmount || 0));
        return { name: b.batchName, income: sale - exp, status: b.status };
      })
      .slice(-5);
  }, [allBatchesData]);

  // --- CALCULATE PIE CHART DATA ---
  const expensePieData = useMemo(() => {
    if (!activeBatch) return [];
    const categories = {};
    
    if (activeBatch.expenses) {
      Object.values(activeBatch.expenses).forEach(exp => {
        const cost = (Number(exp.amount) * Number(exp.quantity || 1));
        categories[exp.category] = (categories[exp.category] || 0) + cost;
      });
    }
    if (activeBatch.usedFeeds) {
        const feedCost = Object.values(activeBatch.usedFeeds).reduce((acc, f) => acc + (Number(f.pricePerUnit || 0) * Number(f.quantity || 0)), 0);
        if (feedCost > 0) categories['Feeds (Consumed)'] = (categories['Feeds (Consumed)'] || 0) + feedCost;
    }
    if (activeBatch.usedVitamins) {
        const vitCost = Object.values(activeBatch.usedVitamins).reduce((acc, v) => acc + (Number(v.pricePerUnit || 0) * Number(v.quantity || 0)), 0);
        if (vitCost > 0) categories['Vitamins (Consumed)'] = (categories['Vitamins (Consumed)'] || 0) + vitCost;
    }

    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [activeBatch]);

  const feedBreakdown = useMemo(() => {
    const totals = { Booster: 0, Starter: 0, Finisher: 0, Total: 0 };
    forecastData.forEach(d => {
        if (totals[d.feedType] !== undefined) totals[d.feedType] += d.targetKilos;
        totals.Total += d.targetKilos;
    });
    return totals;
  }, [forecastData]);

  const calculateProgress = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime(), end = new Date(endDate).getTime(), now = new Date().getTime();
    if (now < start) return 0;
    if (now > end) return 100;
    return Math.min(Math.round(((now - start) / (end - start)) * 100), 100);
  };

  const getRemainingDays = (endDate) => {
    if (!endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date().getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  if (!activeBatch) {
     if (loading) return <div className="p-10 text-center text-gray-400 font-bold">Loading Dashboard...</div>;
     return (
        <div className="p-10 text-center">
          <h3 className="text-xl font-bold text-red-900">No Active Batch</h3>
          <p className="text-gray-500 mt-2">Go to "Batch Control" to create or activate a batch.</p>
        </div>
     );
  }

  // --- CALCULATION LOGIC ---
  const netIncome = stats.sales - stats.expenses;
  const startPop = activeBatch.startingPopulation || 0;
  const currentPop = startPop - stats.qtyHarvested - ESTIMATED_MORTALITY;
  const mortalityRate = startPop > 0 ? ((ESTIMATED_MORTALITY / startPop) * 100).toFixed(1) : 0;
  
  // Avg Weight (Placeholder if not tracked, assuming 1.5kg avg for FCR calc)
  const avgWeight = 0.00; // Replace with real data if you track daily weights
  
  // FCR: Total Feed / ((Current Birds * Avg Weight) + (Harvested Birds * Avg Harvest Weight))
  const estimatedTotalBiomass = (currentPop * 1.5) + (stats.qtyHarvested * 1.6);
  const fcr = estimatedTotalBiomass > 0 ? (stats.totalFeedKilos / estimatedTotalBiomass).toFixed(2) : "0.00";

  const progress = calculateProgress(activeBatch.dateCreated, activeBatch.expectedCompleteDate);
  const daysLeft = getRemainingDays(activeBatch.expectedCompleteDate);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Day {label} {label === currentBatchDay ? '(Today)' : ''}</p>
          <p className="text-sm font-black text-indigo-600">{data.feedType}</p>
          <p className="text-xs font-bold text-gray-700">{payload[0].value} kg</p>
        </div>
      );
    }
    return null;
  };

  // --- COMPARISON LOGIC ---
  const currentMetrics = getBatchMetrics(activeBatch);
  const prevMetrics = getBatchMetrics(previousBatch);

  return (
    <div className="flex-1 bg-gray-50 -mt-7 p-4 overflow-y-auto pb-20 relative">
      
      {/* --- HEADER --- */}
      <div className="bg-[#3B0A0A] p-6 rounded-2xl shadow-xl text-white mb-8 relative overflow-hidden group">
        <div className="relative z-10 flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
               <Layers size={20} className="text-orange-400"/><h1 className="text-2xl font-bold uppercase tracking-wide">{activeBatch.batchName}</h1>
               {/* --- COMPARE BUTTON --- */}
               {previousBatch && (
                   <button 
                    onClick={() => setShowCompareModal(true)}
                    className="ml-2 flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white px-2 py-1 rounded-lg text-[10px] uppercase font-bold transition-colors border border-white/10"
                   >
                       <GitCompare size={12} /> Compare vs Last
                   </button>
               )}
            </div>
            <p className="text-white/60 text-xs mt-1 uppercase font-bold tracking-wider">Active Batch Dashboard</p>
          </div>
          <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded border border-green-500/30 font-bold uppercase">{activeBatch.status}</span>
        </div>
        <div className="relative z-10 w-full bg-black/30 h-3 rounded-full overflow-hidden backdrop-blur-sm">
          <div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-500 shadow-lg" style={{ width: `${progress}%` }} />
        </div>
        <div className="relative z-10 flex justify-between mt-2 text-xs font-bold text-white/50 uppercase">
             <span>Started: {activeBatch.dateCreated}</span>
             <span className="text-orange-300">Harvest: {activeBatch.expectedCompleteDate} ({daysLeft} days left)</span>
        </div>
      </div>

      {/* --- SECTION 1: FINANCIAL OVERVIEW (3 Cols) --- */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Financial Health</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        
        {/* 1. SALES (BLUE) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-36 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <span className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><ShoppingBag size={20}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Revenue</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-blue-700">{formatCurrency(stats.sales)}</h3>
                <div className="flex items-center gap-1 mt-1 text-xs font-bold text-blue-600/60">
                    <ArrowUpRight size={14} /> <span>Sales Record</span>
                </div>
            </div>
        </div>

        {/* 2. NET PROFIT (GREEN) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-36 hover:shadow-md transition-shadow relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${netIncome >= 0 ? 'from-emerald-50 to-transparent' : 'from-red-50 to-transparent'} rounded-bl-full -mr-4 -mt-4`}></div>
            <div className="flex justify-between items-start relative z-10">
                <span className={`p-2.5 rounded-xl ${netIncome >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}><Wallet size={20}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Net Profit</span>
            </div>
            <div className="relative z-10">
                <h3 className={`text-2xl font-black ${netIncome >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>{formatCurrency(netIncome)}</h3>
                <p className="text-[10px] text-gray-400 font-bold mt-1">Realized Gain/Loss</p>
            </div>
        </div>

        {/* 3. EXPENSES (RED) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-36 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <span className="p-2.5 bg-red-50 text-red-600 rounded-xl"><TrendingDown size={20}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Expenses</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-red-700">{formatCurrency(stats.expenses)}</h3>
                <div className="flex items-center gap-1 mt-1 text-xs font-bold text-red-600/60">
                    <ArrowDownRight size={14} /> <span>Operational Cost</span>
                </div>
            </div>
        </div>

      </div>

      {/* --- SECTION 2: PRODUCTION METRICS (6 Items - Reordered) --- */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Flock Performance</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        
        {/* 1. LIVE POPULATION */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:scale-[1.02] transition-transform">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Live Pop.</span>
                <Users size={16} className="text-cyan-500" />
            </div>
            <h3 className="text-xl font-black text-cyan-700">{currentPop} <span className="text-xs font-normal text-gray-400">heads</span></h3>
        </div>

        {/* 2. MORTALITY */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:scale-[1.02] transition-transform">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Mortality</span>
                <Skull size={16} className="text-red-500" />
            </div>
            <h3 className="text-xl font-black text-red-600">{ESTIMATED_MORTALITY} <span className="text-xs font-bold text-red-400">({mortalityRate}%)</span></h3>
        </div>

        {/* 3. USED FEEDS */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:scale-[1.02] transition-transform">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Feed Used</span>
                <Database size={16} className="text-indigo-500" />
            </div>
            <h3 className="text-xl font-black text-indigo-700">{stats.totalFeedKilos.toFixed(1)} <span className="text-xs font-normal text-gray-400">kg</span></h3>
        </div>

        {/* 4. USED VITAMINS */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:scale-[1.02] transition-transform">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Vitamins</span>
                <FlaskConical size={16} className="text-teal-500" />
            </div>
            <h3 className="text-xl font-black text-teal-700">{stats.totalVitaminGrams.toFixed(1)} <span className="text-xs font-normal text-gray-400">g/ml</span></h3>
        </div>

        {/* 5. AVERAGE WEIGHT */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:scale-[1.02] transition-transform">
            <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Avg Weight</span>
                <Scale size={16} className="text-amber-500" />
            </div>
            <h3 className="text-xl font-black text-amber-700">{avgWeight.toFixed(2)} <span className="text-xs font-normal text-gray-400">kg</span></h3>
        </div>

        {/* 6. FCR */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:scale-[1.02] transition-transform">
             <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase">F.C.R.</span>
                <Activity size={16} className="text-purple-500" />
            </div>
            <h3 className="text-xl font-black text-purple-700">{fcr}</h3>
        </div>
      </div>

      {/* --- FEED CHART SECTION --- */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-50">
            <div className="flex items-center gap-2"><div className="p-2 bg-indigo-50 rounded-lg"><ChartIcon size={18} className="text-indigo-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Feed Consumption Forecast</h3><p className="text-[10px] text-gray-400 font-bold uppercase italic">Batch Calendar Integration</p></div></div>
            <div className="flex flex-wrap gap-2 text-xs">
                {['Booster', 'Starter', 'Finisher'].map(type => (
                    <div key={type} className="px-3 py-1 bg-gray-50 rounded-lg border border-gray-100"><span className="block text-[9px] font-bold text-gray-400 uppercase">{type}</span><span className="font-black text-gray-700 text-sm">{feedBreakdown[type].toFixed(1)}</span></div>
                ))}
                <div className="px-3 py-1 bg-indigo-600 rounded-lg border border-indigo-700 text-white"><span className="block text-[9px] font-bold uppercase opacity-80">Total Batch</span><span className="font-black text-sm">{feedBreakdown.Total.toFixed(1)} kg</span></div>
            </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-3 h-64 w-full">
              {!loadingForecast && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={forecastData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <defs><linearGradient id="feedColor" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} /><Tooltip content={<CustomTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} /><Area name="Feed Intake" type="monotone" dataKey="targetKilos" stroke="#6366f1" fill="url(#feedColor)" strokeWidth={3} /><ReferenceLine x={currentBatchDay} stroke="#f97316" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#f97316', fontSize: 10, fontWeight: 'bold' }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="lg:col-span-1 bg-[#3B0A0A] rounded-2xl p-4 shadow-xl text-white">
                <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3"><Clock size={14} className="text-orange-400" /><h4 className="text-[10px] font-black uppercase tracking-widest">Today's Split (D{currentBatchDay})</h4></div>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 text-[8px] font-black text-white/40 uppercase px-1"><span>Recommend</span><span className="text-right">Actual Used</span></div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5"><div className="flex items-center gap-1 text-[9px] font-black text-orange-300 uppercase mb-2"><Sun size={12}/> AM Period</div><div className="flex justify-between items-end"><span className="text-sm font-black">{(todayFeedStats.recommended / 2).toFixed(2)} <span className="text-[8px] text-white/40 font-normal">kg</span></span><span className="text-sm font-black text-white">{todayFeedStats.actual > (todayFeedStats.recommended / 2) ? (todayFeedStats.recommended / 2).toFixed(2) : todayFeedStats.actual.toFixed(2)} <span className="text-[8px] text-white/40 font-normal ml-1">kg</span></span></div></div>
                    <div className="bg-black/20 p-3 rounded-xl border border-white/5"><div className="flex items-center gap-1 text-[9px] font-black text-indigo-300 uppercase mb-2"><Moon size={12}/> PM Period</div><div className="flex justify-between items-end"><span className="text-sm font-black">{(todayFeedStats.recommended / 2).toFixed(2)} <span className="text-[8px] text-white/40 font-normal">kg</span></span><span className="text-sm font-black text-white">{todayFeedStats.actual > (todayFeedStats.recommended / 2) ? (todayFeedStats.actual - (todayFeedStats.recommended / 2)).toFixed(2) : '0.00'} <span className="text-[8px] text-white/40 font-normal ml-1">kg</span></span></div></div>
                </div>
                <div className="mt-4 pt-4 border-t border-white/10"><div className="flex justify-between text-[9px] font-black text-white/40 uppercase mb-2"><span>Daily Coverage</span><span>{todayFeedStats.recommended > 0 ? ((todayFeedStats.actual / todayFeedStats.recommended) * 100).toFixed(0) : 0}%</span></div><div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-700" style={{ width: `${todayFeedStats.recommended > 0 ? Math.min((todayFeedStats.actual / todayFeedStats.recommended) * 100, 100) : 0}%` }} /></div><div className="flex justify-between mt-3 text-[10px] font-black"><span className="text-orange-300 uppercase tracking-tighter">{todayFeedStats.type}</span><span className="text-white">Day {currentBatchDay}</span></div></div>
            </div>
        </div>
      </div>

      {/* --- CHARTS ROW --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PIE CHART */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6"><div className="p-2 bg-rose-50 rounded-lg"><PieIcon size={18} className="text-rose-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Expense Distribution</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Category Breakdown</p></div></div>
            <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expensePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{expensePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(value)} /><Legend iconType="circle" /></PieChart></ResponsiveContainer></div>
        </div>

        {/* HISTORY CHART */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6"><div className="p-2 bg-blue-50 rounded-lg"><BarChart3 size={18} className="text-blue-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">History Comparison</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Net Income Across Batches</p></div></div>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historyComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} domain={[0, 'auto']} tickFormatter={(value) => `₱${value/1000}k`} />
                        <Tooltip formatter={(value) => [formatCurrency(value), 'Net Income']} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                        <Bar dataKey="income" radius={[10, 10, 0, 0]} barSize={40}>
                            {historyComparisonData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.status === 'active' ? '#f97316' : '#3B0A0A'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
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
                    <div className="grid grid-cols-3 text-xs font-bold text-gray-400 uppercase border-b pb-2 mb-2">
                        <span>Metric</span>
                        <span className="text-center text-orange-600">{currentMetrics.name} (Current)</span>
                        <span className="text-center text-gray-600">{prevMetrics.name} (Last)</span>
                    </div>

                    <div className="space-y-4 text-sm text-gray-700">
                        {/* 1. Population */}
                         <div className="grid grid-cols-3 items-center">
                            <span className="font-bold">Starting Pop.</span>
                            <span className="text-center font-black">{currentMetrics.population}</span>
                            <span className="text-center">{prevMetrics.population}</span>
                        </div>

                        {/* 2. Mortality */}
                         <div className="grid grid-cols-3 items-center">
                            <span className="font-bold">Mortality Rate</span>
                            <div className="text-center flex items-center justify-center gap-1">
                                <span className={`font-black ${parseFloat(currentMetrics.mortalityRate) > parseFloat(prevMetrics.mortalityRate) ? 'text-red-600' : 'text-green-600'}`}>{currentMetrics.mortalityRate}%</span>
                                {parseFloat(currentMetrics.mortalityRate) > parseFloat(prevMetrics.mortalityRate) ? <ArrowUpRight size={12} className="text-red-600"/> : <ArrowDownRight size={12} className="text-green-600"/>}
                            </div>
                            <span className="text-center">{prevMetrics.mortalityRate}%</span>
                        </div>

                         {/* 3. FCR */}
                         <div className="grid grid-cols-3 items-center">
                            <span className="font-bold">F.C.R.</span>
                            <div className="text-center flex items-center justify-center gap-1">
                                <span className={`font-black ${parseFloat(currentMetrics.fcr) > parseFloat(prevMetrics.fcr) ? 'text-red-600' : 'text-green-600'}`}>{currentMetrics.fcr}</span>
                            </div>
                            <span className="text-center">{prevMetrics.fcr}</span>
                        </div>
                        
                        {/* 4. Sales */}
                        <div className="grid grid-cols-3 items-center border-t pt-3">
                            <span className="font-bold">Total Sales</span>
                            <div className="text-center flex items-center justify-center gap-1">
                                <span className={`font-black ${currentMetrics.sales < prevMetrics.sales ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(currentMetrics.sales)}</span>
                            </div>
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