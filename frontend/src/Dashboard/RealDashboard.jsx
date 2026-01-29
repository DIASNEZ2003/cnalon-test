import React, { useEffect, useState } from 'react';
import { Layers, TrendingUp, TrendingDown, Users, Skull, Database, FlaskConical, Scale, ShoppingBag, LineChart as ChartIcon } from 'lucide-react';
import { auth, db } from '../firebase'; 
import { ref, onValue } from 'firebase/database';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const RealDashboard = () => {
  const [activeBatch, setActiveBatch] = useState(null);
  const [forecastData, setForecastData] = useState([]);
  const [loadingForecast, setLoadingForecast] = useState(false);
  
  const [usedFeeds, setUsedFeeds] = useState("");
  const [usedVitamins, setUsedVitamins] = useState("");

  const [stats, setStats] = useState({
    expenses: 0,
    sales: 0,
    mortality: 0,
    weight: 0
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = ref(db, `users/${user.uid}`);
    
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.val();
        
        let firstActive = null;
        if (userData.batches) {
          const batchList = Object.entries(userData.batches).map(([id, data]) => ({ id, ...data }));
          firstActive = batchList.find(b => b.status === 'active');
          setActiveBatch(firstActive);
        }

        let totalExp = 0;
        let totalSales = 0;

        if (firstActive) {
          if (firstActive.expenses) {
            Object.values(firstActive.expenses).forEach(exp => {
              totalExp += (Number(exp.amount) * Number(exp.quantity || 1));
            });
          }
          if (firstActive.sales) {
            Object.values(firstActive.sales).forEach(sale => {
              totalSales += Number(sale.totalAmount || 0);
            });
          }
        }

        setStats(prev => ({
          ...prev,
          expenses: totalExp,
          sales: totalSales
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const getForecast = async () => {
      if (activeBatch && activeBatch.id) {
        setLoadingForecast(true);
        try {
          const user = auth.currentUser;
          const token = await user.getIdToken();
          const response = await fetch(`http://localhost:8000/get-feed-forecast/${activeBatch.id}`, {
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
  }, [activeBatch]);

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

  const calculatePhaseTotal = (startDay, endDay) => {
    return forecastData
      .filter(d => d.day >= startDay && d.day <= endDay)
      .reduce((sum, d) => sum + (d.targetKilos || 0), 0)
      .toFixed(2);
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Day {label}</p>
          <p className="text-sm font-black text-indigo-600">{data.feedType}</p>
          <p className="text-xs font-bold text-gray-700">{data.targetKilos} Kilos</p>
        </div>
      );
    }
    return null;
  };

  if (!activeBatch) return null;

  const progress = calculateProgress(activeBatch.dateCreated, activeBatch.expectedCompleteDate);
  const daysLeft = getRemainingDays(activeBatch.expectedCompleteDate);
  const netProfit = stats.sales - stats.expenses;
  const overallTotalKilos = forecastData.reduce((sum, d) => sum + (d.targetKilos || 0), 0).toFixed(2);

  return (
    <div className="flex-1 bg-gray-50 -mt-7 p-2 overflow-y-auto pb-10">
      
      {/* --- TOP ACTIVE BATCH BOX --- */}
      <div className="bg-[#3B0A0A] p-5 rounded-2xl shadow-lg text-white mb-6">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <Layers size={18} />
            <span className="ml-2 font-bold uppercase tracking-wider text-sm">{activeBatch.batchName}</span>
          </div>
          <span className="text-xs bg-green-500/20 text-green-400 px-3 py-1 rounded border border-green-500/30 font-bold uppercase">{activeBatch.status}</span>
        </div>
        <div className="w-full bg-white/20 h-4 rounded-full overflow-hidden">
          <div className="bg-white h-full transition-all duration-500 shadow-sm" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-3 text-xs items-end">
          <div className="flex flex-col">
            <span className="text-white/60 uppercase font-bold text-[10px]">Progress</span>
            <span className="font-mono text-base">{progress}%</span>
          </div>
          <div className="flex gap-8 text-right">
            <div className="flex flex-col">
              <span className="text-white/60 uppercase font-bold text-[10px]">Start Date</span>
              <span className="font-mono text-sm">{activeBatch.dateCreated}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white/60 uppercase font-bold text-[10px]">Est. Harvest</span>
              <span className="font-mono text-sm text-orange-300">{activeBatch.expectedCompleteDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* --- METRIC ROWS (Profit, Expenses, Sales, Population, Budget, Days Left) --- */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Net Profit</span>
          <p className={`text-sm font-black ${netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatCurrency(netProfit)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Expenses</span>
          <p className="text-sm font-black text-red-600">{formatCurrency(stats.expenses)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Total Sales</span>
          <p className="text-sm font-black text-emerald-600">{formatCurrency(stats.sales)}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Population</span>
          <p className="text-sm font-black text-gray-800">{activeBatch.startingPopulation}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-red-900 block mb-1">Vit. Budget</span>
          <p className="text-sm font-black text-red-900">₱{activeBatch.vitaminBudget || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 text-center text-orange-600">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Days Left</span>
          <p className="text-sm font-black">{daysLeft} d</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Used Feeds</span>
          <input type="number" placeholder="0.0" className="w-full text-center text-sm font-black text-amber-600 bg-transparent outline-none" value={usedFeeds} onChange={(e) => setUsedFeeds(e.target.value)} />
          <span className="text-[8px] text-gray-400 uppercase font-bold">kg</span>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Used Vitamins</span>
          <input type="number" placeholder="0" className="w-full text-center text-sm font-black text-purple-600 bg-transparent outline-none" value={usedVitamins} onChange={(e) => setUsedVitamins(e.target.value)} />
          <span className="text-[8px] text-gray-400 uppercase font-bold">grams</span>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 text-center">
          <span className="text-[9px] uppercase font-bold text-gray-400 block mb-1">Avg. Weight</span>
          <p className="text-sm font-black text-gray-800">0.0 <span className="text-[10px]">kg</span></p>
        </div>
      </div>

      {/* --- FEED CONSUMPTION CHART SECTION --- */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 mt-6 mb-10">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-indigo-50 rounded-lg"><ChartIcon size={16} className="text-indigo-600" /></div>
          <h3 className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Feed Forecast</h3>
        </div>

        <div className="h-48 w-full">
          {!loadingForecast && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="feedColor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" hide /><YAxis hide /><Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="targetKilos" stroke="#6366f1" fillOpacity={1} fill="url(#feedColor)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* --- PHASE SUMMARY TOTALS --- */}
        {!loadingForecast && forecastData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <h4 className="text-[10px] uppercase font-black text-gray-400 mb-3 tracking-widest text-center">Feed Consumption Summary</h4>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-blue-50 p-2 rounded-xl border border-blue-100 text-center">
                <span className="text-[9px] font-bold text-blue-600 block uppercase">Phase 1</span>
                <span className="text-xs font-black text-gray-800">Booster</span>
                <p className="text-[10px] font-bold text-blue-700 mt-1">{calculatePhaseTotal(1, 10)} kg</p>
              </div>
              <div className="bg-green-50 p-2 rounded-xl border border-green-100 text-center">
                <span className="text-[9px] font-bold text-green-600 block uppercase">Phase 2</span>
                <span className="text-xs font-black text-gray-800">Starter</span>
                <p className="text-[10px] font-bold text-green-700 mt-1">{calculatePhaseTotal(11, 23)} kg</p>
              </div>
              <div className="bg-orange-50 p-2 rounded-xl border border-orange-100 text-center">
                <span className="text-[9px] font-bold text-orange-600 block uppercase">Phase 3</span>
                <span className="text-xs font-black text-gray-800">Finisher</span>
                <p className="text-[10px] font-bold text-orange-700 mt-1">{calculatePhaseTotal(24, 30)} kg</p>
              </div>
            </div>

            {/* --- OVERALL TOTAL (FIXED COLOR TO MATCH STYLE) --- */}
            <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100 text-center">
               <span className="text-[9px] font-bold text-indigo-600 block uppercase">Overall Total Consumption</span>
               <p className="text-lg font-black text-indigo-900">{overallTotalKilos} <span className="text-xs font-normal">kg</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RealDashboard;