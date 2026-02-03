import React, { useEffect, useState, useMemo } from 'react';
import { 
  Layers, TrendingUp, TrendingDown, Users, Skull, 
  Database, Scale, ShoppingBag, 
  LineChart as ChartIcon, DollarSign, Activity, 
  CheckCircle, FlaskConical, UserCheck, Wallet 
} from 'lucide-react';
import { auth, db } from '../firebase'; 
import { ref, onValue } from 'firebase/database';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const RealDashboard = () => {
  const [activeBatch, setActiveBatch] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); 
  const [loading, setLoading] = useState(true); 

  // --- CONSTANTS ---
  const ESTIMATED_MORTALITY = 0; 

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

    // A. Fetch Active System Users
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

    // B. Listen to Batches
    const batchesRef = ref(db, 'global_batches');
    const unsubscribe = onValue(batchesRef, (snapshot) => {
      if (snapshot.exists()) {
        const allBatches = snapshot.val();
        
        const batchList = Object.entries(allBatches).map(([id, data]) => ({ id, ...data }));
        const firstActive = batchList.find(b => b.status === 'active');
        
        setActiveBatch(firstActive);

        // Calculate Totals
        let totalExp = 0;
        let totalSales = 0;
        let feedKilos = 0;
        let vitaminGrams = 0;
        let harvestedHeads = 0;

        if (firstActive) {
          // Expenses Logic
          if (firstActive.expenses) {
            Object.values(firstActive.expenses).forEach(exp => {
              const qty = Number(exp.quantity || 0);
              const cost = (Number(exp.amount) * Number(exp.quantity || 1));
              totalExp += cost;
              
              if (exp.category === 'Feeds') {
                feedKilos += qty;
              } else if (exp.category === 'Vitamins') {
                vitaminGrams += qty;
              }
            });
          }
          // Sales Logic
          if (firstActive.sales) {
            Object.values(firstActive.sales).forEach(sale => {
              totalSales += Number(sale.totalAmount || 0);
              harvestedHeads += Number(sale.quantity || 0);
            });
          }
        }

        setStats(prev => ({
          ...prev,
          expenses: totalExp,
          sales: totalSales,
          totalFeedKilos: feedKilos,
          totalVitaminGrams: vitaminGrams,
          qtyHarvested: harvestedHeads
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
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
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

  // --- NEW: CALCULATE FEED BREAKDOWN ---
  const feedBreakdown = useMemo(() => {
    const totals = { Booster: 0, Starter: 0, Finisher: 0, Total: 0 };
    forecastData.forEach(d => {
        const type = d.feedType;
        if (totals[type] !== undefined) {
            totals[type] += d.targetKilos;
        }
        totals.Total += d.targetKilos;
    });
    return totals;
  }, [forecastData]);

  // --- HELPERS ---
  const calculateProgress = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = new Date().getTime();
    if (now < start) return 0;
    if (now > end) return 100;
    const totalDuration = end - start;
    const elapsed = now - start;
    return Math.min(Math.round((elapsed / totalDuration) * 100), 100);
  };

  const getRemainingDays = (endDate) => {
    if (!endDate) return 0;
    const diff = new Date(endDate).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? days : 0;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
  };

  // --- CALCULATIONS ---
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
  
  // Mortality Logic
  const currentPop = startPop - stats.qtyHarvested - ESTIMATED_MORTALITY;
  const mortalityRate = startPop > 0 ? ((ESTIMATED_MORTALITY / startPop) * 100).toFixed(1) : 0;
  
  // Weights & FCR
  const totalWeightProduced = 0; 
  const fcr = "0.00";

  const progress = calculateProgress(activeBatch.dateCreated, activeBatch.expectedCompleteDate);
  const daysLeft = getRemainingDays(activeBatch.expectedCompleteDate);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Day {label}</p>
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
               <Layers size={20} className="text-orange-400"/>
               <h1 className="text-2xl font-bold uppercase tracking-wide">{activeBatch.batchName}</h1>
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
        
        {/* 1. Active Users */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-slate-50 text-slate-600 rounded-lg"><UserCheck size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Active Users</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-slate-700">{stats.activeSystemUsers}</h3>
                <p className="text-[10px] text-gray-400 font-bold">System Accounts</p>
            </div>
        </div>

        {/* 2. Expenses */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-rose-50 text-rose-600 rounded-lg"><TrendingDown size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Expenses</span>
            </div>
            <div>
                <h3 className="text-xl font-black text-rose-700">{formatCurrency(stats.expenses)}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Total Cost</p>
            </div>
        </div>

        {/* 3. Sales */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><ShoppingBag size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Sales</span>
            </div>
            <div>
                <h3 className="text-xl font-black text-emerald-700">{formatCurrency(stats.sales)}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Total Revenue</p>
            </div>
        </div>

        {/* 4. Net Profit */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Wallet size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Net Profit</span>
            </div>
            <div>
                <h3 className={`text-xl font-black ${netIncome >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatCurrency(netIncome)}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Profit / Loss</p>
            </div>
        </div>

      </div>

      {/* --- SECTION 2: PRODUCTION METRICS --- */}
      <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Production Metrics</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        
        {/* 5. Feed Used */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Database size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Feed Used</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-indigo-700">{stats.totalFeedKilos.toFixed(1)}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Kilograms</p>
            </div>
        </div>

        {/* 6. Vitamin Used */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-teal-50 text-teal-600 rounded-lg"><FlaskConical size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Vitamins</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-teal-700">{stats.totalVitaminGrams.toFixed(1)}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Grams / ml</p>
            </div>
        </div>

        {/* 7. Started */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Started</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-gray-800">{startPop}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Heads</p>
            </div>
        </div>

        {/* 8. Harvested */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-green-50 text-green-600 rounded-lg"><CheckCircle size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Harvested</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-green-700">{stats.qtyHarvested}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Heads Sold</p>
            </div>
        </div>

        {/* 9. Mortality */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-red-50 text-red-600 rounded-lg"><Skull size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Mortality</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-red-600">{ESTIMATED_MORTALITY}</h3>
                <p className="text-[10px] text-red-400 font-bold">{mortalityRate}% Rate</p>
            </div>
        </div>

        {/* 10. Live Birds */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-cyan-50 text-cyan-600 rounded-lg"><Users size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Live Birds</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-cyan-700">{currentPop}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Current Count</p>
            </div>
        </div>

        {/* 11. Total Weight */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Scale size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Net Weight</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-amber-700">{totalWeightProduced}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Kilograms</p>
            </div>
        </div>

        {/* 12. FCR */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between h-32">
            <div className="flex justify-between items-start">
                <span className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Activity size={18}/></span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">FCR</span>
            </div>
            <div>
                <h3 className="text-2xl font-black text-gray-400">{fcr}</h3>
                <p className="text-[10px] text-gray-400 font-bold">Target: 1.5 - 1.7</p>
            </div>
        </div>

      </div>

      {/* --- FEED CHART WITH BREAKDOWN --- */}
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
        
        {/* CHART HEADER + BREAKDOWN */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            {/* Title */}
            <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-50 rounded-lg"><ChartIcon size={18} className="text-indigo-600" /></div>
                <div>
                    <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Feed Consumption Forecast</h3>
                    <p className="text-[10px] text-gray-400 font-bold">Projected Intake per Day (kg)</p>
                </div>
            </div>

            {/* Total Breakdown (Top Left of Graph area logic) */}
            <div className="flex flex-wrap gap-2 text-xs">
                <div className="px-3 py-1 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="block text-[9px] font-bold text-amber-500 uppercase tracking-wide">Booster</span>
                    <span className="font-black text-amber-700 text-sm">{feedBreakdown.Booster.toFixed(1)}</span>
                </div>
                <div className="px-3 py-1 bg-indigo-50 rounded-lg border border-indigo-100">
                    <span className="block text-[9px] font-bold text-indigo-500 uppercase tracking-wide">Starter</span>
                    <span className="font-black text-indigo-700 text-sm">{feedBreakdown.Starter.toFixed(1)}</span>
                </div>
                <div className="px-3 py-1 bg-cyan-50 rounded-lg border border-cyan-100">
                    <span className="block text-[9px] font-bold text-cyan-500 uppercase tracking-wide">Finisher</span>
                    <span className="font-black text-cyan-700 text-sm">{feedBreakdown.Finisher.toFixed(1)}</span>
                </div>
                <div className="px-3 py-1 bg-gray-100 rounded-lg border border-gray-200">
                    <span className="block text-[9px] font-bold text-gray-500 uppercase tracking-wide">Total</span>
                    <span className="font-black text-gray-800 text-sm">{feedBreakdown.Total.toFixed(1)} kg</span>
                </div>
            </div>
        </div>

        <div className="h-64 w-full">
          {!loadingForecast && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="feedColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                    label={{ value: 'Day of Production', position: 'insideBottom', offset: -5, fontSize: 10, fill: '#9ca3af' }}
                />
                <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 10, fill: '#9ca3af'}} 
                    label={{ value: 'Kilos', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#9ca3af' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Area 
                    name="Feed Intake"
                    type="monotone" 
                    dataKey="targetKilos" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill="url(#feedColor)" 
                    strokeWidth={3} 
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

    </div>
  );
};

export default RealDashboard;