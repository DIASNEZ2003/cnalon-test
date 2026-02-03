import React, { useEffect, useState, useMemo } from 'react';
import { 
  Layers, TrendingUp, TrendingDown, Users, Skull, 
  Database, Scale, ShoppingBag, 
  LineChart as ChartIcon, DollarSign, Activity, 
  CheckCircle, FlaskConical, UserCheck, Wallet, PieChart as PieIcon,
  Clock, Sun, Moon, BarChart3
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
  const [allBatchesData, setAllBatchesData] = useState([]); 
  const [forecastData, setForecastData] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [loading, setLoading] = useState(true); 

  // --- CONSTANTS ---
  const ESTIMATED_MORTALITY = 0; 
  const PIE_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899'];

  // --- DERIVED STATS ---
  const [stats, setStats] = useState({
    expenses: 0,
    sales: 0,
    totalFeedKilos: 0, 
    totalVitaminGrams: 0, 
    qtyHarvested: 0, 
    activeSystemUsers: 0  
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

  // 2. Load Data & Fetch Users
  useEffect(() => {
    if (!currentUser) return;

    const fetchUsers = async () => {
      try {
        const token = await currentUser.getIdToken();
        const res = await fetch(`${backendUrl}/get-users`, {
           headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const users = await res.json();
          setStats(prev => ({ ...prev, activeSystemUsers: users.length }));
        }
      } catch (err) {
        console.error("Error fetching users:", err);
      }
    };
    fetchUsers();

    const batchesRef = ref(db, 'global_batches');
    const unsubscribe = onValue(batchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allBatches = snapshot.val();
        const batchList = Object.entries(allBatches).map(([id, data]) => ({ id, ...data }));
        
        const firstActive = batchList.find(b => b.status === 'active');
        setActiveBatch(firstActive);
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

          // --- MODIFIED: USE usedFeeds DATABASE ---
          if (firstActive.usedFeeds) {
            Object.values(firstActive.usedFeeds).forEach(f => {
              feedKilos += Number(f.quantity || 0);
              // Adding cost of consumed feeds to total expenses if price is available
              if (f.pricePerUnit) totalExp += (Number(f.pricePerUnit) * Number(f.quantity));
            });
          }

          // --- MODIFIED: USE usedVitamins DATABASE ---
          if (firstActive.usedVitamins) {
            Object.values(firstActive.usedVitamins).forEach(v => {
              vitaminGrams += Number(v.quantity || 0);
              // Adding cost of consumed vitamins to total expenses if price is available
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
    
    // Check usedFeeds for today's entry
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
        // Add cost from separate used collections for history if applicable
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
    // Add Used Feeds and Vitamins to the Pie Chart Breakdown
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

  const netIncome = stats.sales - stats.expenses;
  const startPop = activeBatch.startingPopulation || 0;
  const currentPop = startPop - stats.qtyHarvested - ESTIMATED_MORTALITY;
  const mortalityRate = startPop > 0 ? ((ESTIMATED_MORTALITY / startPop) * 100).toFixed(1) : 0;
  const totalWeightProduced = 0, fcr = "0.00";
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

  return (
    <div className="flex-1 bg-gray-50 -mt-7 p-4 overflow-y-auto pb-20">
      
      {/* --- HEADER --- */}
      <div className="bg-[#3B0A0A] p-6 rounded-2xl shadow-xl text-white mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2">
               <Layers size={20} className="text-orange-400"/><h1 className="text-2xl font-bold uppercase tracking-wide">{activeBatch.batchName}</h1>
            </div>
            <p className="text-white/60 text-xs mt-1 uppercase font-bold tracking-wider">Active Batch Dashboard</p>
          </div>
          <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded border border-green-500/30 font-bold uppercase">{activeBatch.status}</span>
        </div>
        <div className="w-full bg-black/30 h-3 rounded-full overflow-hidden backdrop-blur-sm">
          <div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-500 shadow-lg" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-2 text-xs font-bold text-white/50 uppercase">
             <span>Started: {activeBatch.dateCreated}</span>
             <span className="text-orange-300">Harvest: {activeBatch.expectedCompleteDate} ({daysLeft} days left)</span>
        </div>
      </div>

      {/* --- SECTION 1: FINANCIAL & USERS --- */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Financial & Admin Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-slate-50 text-slate-600 rounded-lg"><UserCheck size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Active Users</span></div>
            <div><h3 className="text-2xl font-black text-slate-700">{stats.activeSystemUsers}</h3><p className="text-[10px] text-gray-400 font-bold">System Accounts</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Expenses</span></div>
            <div><h3 className="text-xl font-black text-rose-700">{formatCurrency(stats.expenses)}</h3><p className="text-[10px] text-gray-400 font-bold">Total Cost</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ShoppingBag size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Sales</span></div>
            <div><h3 className="text-xl font-black text-emerald-700">{formatCurrency(stats.sales)}</h3><p className="text-[10px] text-gray-400 font-bold">Total Revenue</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wallet size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Net Profit</span></div>
            <div><h3 className={`text-xl font-black ${netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatCurrency(netIncome)}</h3><p className="text-[10px] text-gray-400 font-bold">Profit / Loss</p></div>
        </div>
      </div>

      {/* --- SECTION 2: PRODUCTION METRICS --- */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Production Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Database size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Feed Used</span></div>
            <div><h3 className="text-2xl font-black text-indigo-700">{stats.totalFeedKilos.toFixed(1)}</h3><p className="text-[10px] text-gray-400 font-bold">Kilograms</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-teal-50 text-teal-600 rounded-lg"><FlaskConical size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Vitamins</span></div>
            <div><h3 className="text-2xl font-black text-teal-700">{stats.totalVitaminGrams.toFixed(1)}</h3><p className="text-[10px] text-gray-400 font-bold">Grams / ml</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Started</span></div>
            <div><h3 className="text-2xl font-black text-gray-800">{startPop}</h3><p className="text-[10px] text-gray-400 font-bold">Heads</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Harvested</span></div>
            <div><h3 className="text-2xl font-black text-green-700">{stats.qtyHarvested}</h3><p className="text-[10px] text-gray-400 font-bold">Heads Sold</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-red-50 text-red-600 rounded-lg"><Skull size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Mortality</span></div>
            <div><h3 className="text-2xl font-black text-red-600">{ESTIMATED_MORTALITY}</h3><p className="text-[10px] text-red-400 font-bold">{mortalityRate}% Rate</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><Users size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Live Birds</span></div>
            <div><h3 className="text-2xl font-black text-cyan-700">{currentPop}</h3><p className="text-[10px] text-gray-400 font-bold">Current Count</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Scale size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">Net Weight</span></div>
            <div><h3 className="text-2xl font-black text-amber-700">{totalWeightProduced}</h3><p className="text-[10px] text-gray-400 font-bold">Kilograms</p></div>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start"><span className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Activity size={18}/></span><span className="text-[10px] font-bold text-gray-400 uppercase">FCR</span></div>
            <div><h3 className="text-2xl font-black text-gray-400">{fcr}</h3><p className="text-[10px] text-gray-400 font-bold">Target: 1.5 - 1.7</p></div>
        </div>
      </div>

      {/* --- FEED CHART WITH MAROON DUAL VIEW TABLE --- */}
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
                <div className="mt-4 pt-4 border-t border-white/10"><div className="flex justify-between text-[9px] font-black text-white/40 uppercase mb-2"><span>Daily Coverage</span><span>{((todayFeedStats.actual / todayFeedStats.recommended) * 100).toFixed(0)}%</span></div><div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-700" style={{ width: `${Math.min((todayFeedStats.actual / todayFeedStats.recommended) * 100, 100)}%` }} /></div><div className="flex justify-between mt-3 text-[10px] font-black"><span className="text-orange-300 uppercase tracking-tighter">{todayFeedStats.type}</span><span className="text-white">Day {currentBatchDay}</span></div></div>
            </div>
        </div>
      </div>

      {/* --- SECTION 3: CHARTS ROW --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PIE CHART */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6"><div className="p-2 bg-rose-50 rounded-lg"><PieIcon size={18} className="text-rose-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Expense Distribution</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Category Breakdown</p></div></div>
            <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expensePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{expensePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(value)} /><Legend iconType="circle" /></PieChart></ResponsiveContainer></div>
        </div>

        {/* HISTORY COMPARISON BAR CHART (STARTS AT ZERO) */}
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
    </div>
  );
};

export default RealDashboard;