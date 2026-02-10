import React, { useEffect, useState, useMemo } from 'react';
  import { 
    Layers, TrendingUp, TrendingDown, Users, Skull, 
    Database, Scale, ShoppingBag, 
    LineChart as ChartIcon, Activity, 
    FlaskConical, Wallet, PieChart as PieIcon,
    Clock, Sun, Moon, BarChart3, ArrowUpRight, ArrowDownRight,
    GitCompare, X, Eye, Pill, HeartPulse, CheckCircle
  } from 'lucide-react';
  import { auth, db } from '../firebase'; 
  import { ref, onValue } from 'firebase/database';
  import { 
    AreaChart, Area, XAxis, YAxis, CartesianGrid, 
    Tooltip, ResponsiveContainer, Legend,
    PieChart, Pie, Cell, ReferenceLine, BarChart, Bar, ComposedChart
  } from 'recharts';

  // --- SUB-COMPONENT: REUSABLE METRIC CARD WITH HOVER GRAPH ---
  const MetricCard = ({ title, value, unit, icon: Icon, colorClass, bgClass, barColor, prevValue, isCurrency = false, isInverse = false }) => {
    const formattedValue = isCurrency 
      ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value)
      : value;

    const graphData = [
      { name: 'Last', value: Number(prevValue) || 0, color: '#94a3b8' }, // Gray
      { name: 'Now', value: Number(value) || 0, color: barColor }       // Colored
    ];

    // Determine if trend is "Good" (Green) or "Bad" (Red)
    const diff = Number(value) - Number(prevValue);
    const isBetter = isInverse ? diff < 0 : diff > 0;
    
    const CustomGraphTooltip = ({ active, payload }) => {
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

    return (
      <div className="relative group bg-white rounded-2xl shadow-sm border border-gray-100 h-36 transition-all duration-300">
        
        {/* --- STATE 1: NORMAL VIEW --- */}
        <div className="absolute inset-0 p-5 flex flex-col justify-between">
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
              {/* Simple trend indicator */}
              {prevValue !== undefined && prevValue !== 0 ? (
                <>
                  {isBetter ? <ArrowUpRight size={14} className="text-green-600"/> : <ArrowDownRight size={14} className="text-red-600"/>}
                  <span className={isBetter ? 'text-green-600' : 'text-red-600'}>
                      vs Last Batch
                  </span>
                </>
              ) : <span className="text-gray-400">No data</span>}
            </div>
          </div>
          {/* HINT ICON */}
          <div className={`absolute top-5 right-5 opacity-20 group-hover:opacity-40 transition-opacity ${colorClass}`}>
            <Eye size={16} />
          </div>
        </div>

        {/* --- STATE 2: HOVER MODAL VIEW --- */}
        <div className="absolute inset-0 z-50 bg-white rounded-2xl shadow-2xl p-4 opacity-0 invisible group-hover:visible group-hover:opacity-100 transition-all duration-300 transform translate-y-4 group-hover:translate-y-0 border-2 border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-1 pb-2 border-b border-gray-50">
              <p className="text-[10px] font-black text-gray-600 uppercase">{title} Comparison</p>
              <span className={`text-[9px] text-white px-1.5 py-0.5 rounded font-bold`} style={{ backgroundColor: barColor }}>VS LAST</span>
            </div>
            <div className="flex-1 w-full h-full min-h-0 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={graphData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                  {/* 1. DARKER GRID LINES */}
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  {/* 2. VISIBLE AXIS LINE */}
                  <XAxis dataKey="name" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 700 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b' }} tickFormatter={(val) => val >= 1000 ? `${val/1000}k` : val} />
                  <Tooltip content={<CustomGraphTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} />
                  {/* 3. REFERENCE LINE */}
                  <ReferenceLine y={Number(prevValue)} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={35}>
                    {graphData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
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
    const [inventoryForecast, setInventoryForecast] = useState([]); // Stores the dynamic forecast
    const [loadingForecast, setLoadingForecast] = useState(false);
    const [currentUser, setCurrentUser] = useState(null); 
    const [loading, setLoading] = useState(true); 
    const [showCompareModal, setShowCompareModal] = useState(false); 

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

    // 2. Load Data (Firebase Realtime)
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

          let totalExp = 0, totalSales = 0, feedKilos = 0, vitaminGrams = 0, harvestedHeads = 0;

          if (firstActive) {
            if (firstActive.expenses) {
              Object.values(firstActive.expenses).forEach(exp => {
                const cost = (Number(exp.amount) * Number(exp.quantity || 1));
                totalExp += cost;
              });
            }

            if (firstActive.usedFeeds) {
              Object.values(firstActive.usedFeeds).forEach(f => {
                feedKilos += Number(f.quantity || 0);
                if (f.pricePerUnit) totalExp += (Number(f.pricePerUnit) * Number(f.quantity));
              });
            }

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

    // 3. Load Forecasts (Feed & Inventory)
    useEffect(() => {
      const getForecasts = async () => {
        if (activeBatch && activeBatch.id && currentUser) {
          setLoadingForecast(true);
          try {
            const token = await currentUser.getIdToken();
            
            // A. Feed Forecast
            const feedRes = await fetch(`${backendUrl}/get-feed-forecast/${activeBatch.id}`, { 
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } 
            });
            if (feedRes.ok) {
                const res = await feedRes.json();
                setForecastData(res.forecast);
            }

            // B. Inventory Forecast (Dynamic from Expenses)
            const invRes = await fetch(`${backendUrl}/get-inventory-forecast/${activeBatch.id}`, { 
              headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } 
            });
            if (invRes.ok) {
                const invData = await invRes.json();
                setInventoryForecast(invData);
            }

          } catch (err) {
            console.error("Forecast Error:", err);
          } finally {
            setLoadingForecast(false);
          }
        }
      };
      getForecasts();
    }, [activeBatch, currentUser]);

    // --- HELPER: CALCULATE METRICS FOR ANY BATCH ---
    const getBatchMetrics = (batch) => {
      if (!batch) return null;

      let sales = 0, expenses = 0, harvestQty = 0, feedKilos = 0, vitaminGrams = 0;
      
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
      if (batch.usedVitamins) {
          Object.values(batch.usedVitamins).forEach(v => {
              vitaminGrams += Number(v.quantity || 0);
              expenses += (Number(v.pricePerUnit || 0) * Number(v.quantity || 0));
          });
      }

      const startPop = batch.startingPopulation || 0;
      const mortalityRate = startPop > 0 ? ((ESTIMATED_MORTALITY / startPop) * 100).toFixed(1) : 0;
      const estWeight = (startPop - ESTIMATED_MORTALITY) * 1.5; 
      const fcr = estWeight > 0 ? (feedKilos / estWeight).toFixed(2) : "0.00";
      
      const finalPop = startPop;

      return {
          name: batch.batchName,
          population: startPop,
          sales: sales,
          expenses: expenses,
          profit: sales - expenses,
          mortalityRate: mortalityRate,
          fcr: fcr,
          harvested: harvestQty,
          feedKilos: feedKilos,
          vitaminGrams: vitaminGrams,
          finalPop: finalPop
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

    // --- UPDATED: VITAMIN CHART DATA (Includes Unit & 30-Day Limit) ---
    const dailyVitaminChartData = useMemo(() => {
        // Prioritize Inventory Forecast (Dynamic), fall back to saved (Static)
        const sourceData = (inventoryForecast.length > 0) ? inventoryForecast : (activeBatch?.vitaminForecast || []);
        
        const MAX_DAYS = 30; // Changed from 35 to 30 as requested
        const data = [];
        
        for(let d=1; d<=MAX_DAYS; d++){
            // Find active items for this day
            const activeItems = sourceData.filter(item => d >= item.startDay && d <= item.endDay);
            
            let totalDosage = 0;
            let names = [];
            // Capture the unit of the first active item to display in graph
            let displayUnit = "";
            
            activeItems.forEach(i => {
                totalDosage += i.dailyAmount;
                names.push(i.name);
                if(!displayUnit && i.unit) displayUnit = i.unit;
            });
            
            data.push({
                day: d,
                dosage: totalDosage,
                activeNames: names.join(', '),
                count: activeItems.length,
                unit: displayUnit || "units"
            });
        }
        return data;
    }, [activeBatch, inventoryForecast]);

    // Calculate Today's Vitamin Status
    const todayVitaminStats = useMemo(() => {
        if (!currentBatchDay) return { names: [], totalTarget: 0, actual: 0 };
        
        const sourceData = (inventoryForecast.length > 0) ? inventoryForecast : (activeBatch?.vitaminForecast || []);
        
        // Target
        const activeItems = sourceData.filter(item => currentBatchDay >= item.startDay && currentBatchDay <= item.endDay);
        const totalTarget = activeItems.reduce((acc, curr) => acc + curr.dailyAmount, 0);
        
        // Actual (From Yellow Box Logs)
        let actualUsed = 0;
        if (activeBatch?.vitamin_logs && activeBatch.vitamin_logs[currentBatchDay]) {
            const logs = activeBatch.vitamin_logs[currentBatchDay];
            actualUsed = Object.values(logs).reduce((a, b) => a + Number(b), 0);
        }
        
        return {
            names: activeItems.map(i => i.name),
            totalTarget: totalTarget,
            actual: actualUsed,
            unit: activeItems.length > 0 ? activeItems[0].unit : ''
        };
    }, [activeBatch, inventoryForecast, currentBatchDay]);


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
    const avgWeight = 0.00; 
    const estimatedTotalBiomass = (currentPop * 1.5) + (stats.qtyHarvested * 1.6);
    const fcr = estimatedTotalBiomass > 0 ? (stats.totalFeedKilos / estimatedTotalBiomass).toFixed(2) : "0.00";
    const progress = calculateProgress(activeBatch.dateCreated, activeBatch.expectedCompleteDate);
    const daysLeft = getRemainingDays(activeBatch.expectedCompleteDate);

    // --- COMPARISON LOGIC ---
    const currentMetrics = getBatchMetrics(activeBatch);
    const prevMetrics = getBatchMetrics(previousBatch);

    // --- CUSTOM TOOLTIPS ---
    const CustomFeedTooltip = ({ active, payload, label }) => {
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

    // UPDATED: Now shows the real unit (g/ml) instead of "units"
    const CustomVitaminTooltip = ({ active, payload, label }) => {
      if (active && payload && payload.length) {
        const data = payload[0].payload;
        if (data.dosage === 0) return null;
        return (
          <div className="bg-white p-3 rounded-lg shadow-xl border border-gray-100 z-50">
            <p className="text-[10px] font-bold text-gray-400 uppercase">Day {label}</p>
            <p className="text-xs font-black text-teal-600 mb-1">{data.activeNames}</p>
            <p className="text-[10px] font-bold text-gray-500">Total Dose: {data.dosage.toFixed(1)} {data.unit}</p>
          </div>
        );
      }
      return null;
    };

    return (
      <div className="flex-1 bg-gray-50 -mt-7 p-4 overflow-y-auto pb-20 relative">
        
        {/* --- HEADER --- */}
        <div className="bg-[#3B0A0A] p-6 rounded-2xl shadow-xl text-white mb-8 relative overflow-hidden group">
          <div className="relative z-10 flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers size={20} className="text-orange-400"/><h1 className="text-2xl font-bold uppercase">{activeBatch.batchName}</h1>
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
        <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Financial Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          
          {/* 1. SALES (BLUE) - WITH HOVER */}
          <MetricCard 
            title="Total Sales" 
            value={stats.sales} 
            prevValue={prevMetrics ? prevMetrics.sales : 0} 
            icon={ShoppingBag} 
            colorClass="text-blue-700" 
            bgClass="bg-blue-50" 
            barColor="#2563eb" 
            isCurrency={true}
          />

          {/* 2. NET PROFIT (GREEN/RED) - WITH HOVER */}
          <MetricCard 
            title="Net Profit" 
            value={netIncome} 
            prevValue={prevMetrics ? prevMetrics.profit : 0} 
            icon={Wallet} 
            colorClass={netIncome >= 0 ? "text-emerald-700" : "text-red-700"} 
            bgClass={netIncome >= 0 ? "bg-emerald-50" : "bg-red-50"} 
            barColor={netIncome >= 0 ? "#10b981" : "#ef4444"} 
            isCurrency={true}
          />

          {/* 3. EXPENSES (RED) - WITH HOVER */}
          <MetricCard 
            title="Total Expenses" 
            value={stats.expenses} 
            prevValue={prevMetrics ? prevMetrics.expenses : 0} 
            icon={TrendingDown} 
            colorClass="text-red-700" 
            bgClass="bg-red-50" 
            barColor="#dc2626" 
            isCurrency={true}
            isInverse={true} // Lower is better
          />
        </div>

        {/* --- SECTION 2: PRODUCTION METRICS (6 Items) - ALL WITH HOVER --- */}
        <h2 className="text-gray-400 font-bold text-xs uppercase tracking-widest mb-4 ml-1">Batch Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          
          {/* 1. LIVE POPULATION */}
          <MetricCard 
            title="Live Pop." 
            value={currentPop} 
            prevValue={prevMetrics ? prevMetrics.harvested : 0} // Comparing vs Last Batch Harvested
            unit="heads"
            icon={Users} 
            colorClass="text-cyan-700" 
            bgClass="bg-cyan-50" 
            barColor="#0891b2"
          />

          {/* 2. MORTALITY */}
          <MetricCard 
            title="Mortality" 
            value={ESTIMATED_MORTALITY} 
            prevValue={prevMetrics ? (prevMetrics.population * (prevMetrics.mortalityRate/100)) : 0} 
            unit="heads"
            icon={Skull} 
            colorClass="text-red-600" 
            bgClass="bg-red-50" 
            barColor="#dc2626"
            isInverse={true}
          />

          {/* 3. USED FEEDS */}
          <MetricCard 
            title="Feed Used" 
            value={stats.totalFeedKilos} 
            prevValue={prevMetrics ? prevMetrics.feedKilos : 0} 
            unit="kg"
            icon={Database} 
            colorClass="text-indigo-700" 
            bgClass="bg-indigo-50" 
            barColor="#4f46e5"
          />

          {/* 4. USED VITAMINS */}
          <MetricCard 
            title="Vitamins" 
            value={stats.totalVitaminGrams} 
            prevValue={prevMetrics ? prevMetrics.vitaminGrams : 0} 
            unit="g/ml"
            icon={FlaskConical} 
            colorClass="text-teal-700" 
            bgClass="bg-teal-50" 
            barColor="#0d9488"
          />

          {/* 5. AVERAGE WEIGHT */}
          <MetricCard 
            title="Avg Weight" 
            value={avgWeight} 
            prevValue={0} // No historical data for weight in this logic yet
            unit="kg"
            icon={Scale} 
            colorClass="text-amber-700" 
            bgClass="bg-amber-50" 
            barColor="#d97706"
          />

          {/* 6. FCR */}
          <MetricCard 
            title="F.C.R." 
            value={fcr} 
            prevValue={prevMetrics ? prevMetrics.fcr : 0} 
            unit=""
            icon={Activity} 
            colorClass="text-purple-700" 
            bgClass="bg-purple-50" 
            barColor="#7e22ce"
            isInverse={true}
          />

        </div>

        {/* --- SECTION 3: FEED CHART SECTION --- */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-50">
              <div className="flex items-center gap-2"><div className="p-2 bg-indigo-50 rounded-lg"><ChartIcon size={18} className="text-indigo-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Feed Consumption Forecast</h3><p className="text-[10px] text-gray-400 font-bold uppercase italic"></p></div></div>
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
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} /><YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} /><Tooltip content={<CustomFeedTooltip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} /><Area name="Feed Intake" type="monotone" dataKey="targetKilos" stroke="#6366f1" fill="url(#feedColor)" strokeWidth={3} /><ReferenceLine x={currentBatchDay} stroke="#f97316" strokeWidth={2} strokeDasharray="3 3" label={{ position: 'top', value: 'Today', fill: '#f97316', fontSize: 10, fontWeight: 'bold' }} />
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

        {/* --- SECTION 4: VITAMIN & MEDICINE FORECAST (NEW) --- */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b pb-4 border-gray-50">
              <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-50 rounded-lg"><Pill size={18} className="text-teal-600" /></div>
                  <div>
                      <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Vitamins Consumption Forecast</h3>
                    
                  </div>
              </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* --- Chart --- */}
              <div className="lg:col-span-3 h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={dailyVitaminChartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#9ca3af'}} />
                      <Tooltip content={<CustomVitaminTooltip />} />
                      <Bar dataKey="dosage" fill="#14b8a6" radius={[4, 4, 0, 0]} barSize={15} name="Dosage (Units/g)" />
                      <ReferenceLine x={currentBatchDay} stroke="#f97316" strokeWidth={2} strokeDasharray="3 3" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              {/* --- UPDATED: Today's Medicine Panel (AM/PM SPLIT LIKE FEED) --- */}
              <div className="lg:col-span-1 bg-teal-900 rounded-2xl p-4 shadow-xl text-white">
                <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
                    <Clock size={14} className="text-teal-400" />
                    <h4 className="text-[10px] font-black uppercase tracking-widest">Today's Split (D{currentBatchDay})</h4>
                </div>
                
                {todayVitaminStats.names.length > 0 ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 text-[8px] font-black text-white/40 uppercase px-1">
                            <span>Recommend</span><span className="text-right">Actual Used</span>
                        </div>
                        
                        {/* AM Period */}
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

                        {/* PM Period */}
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

                        {/* Progress & Active Meds Footer */}
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

        {/* --- CHARTS ROW --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PIE CHART */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6"><div className="p-2 bg-rose-50 rounded-lg"><PieIcon size={18} className="text-rose-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">Expense Overview</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest"></p></div></div>
              <div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expensePieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>{expensePieData.map((entry, index) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(value)} /><Legend iconType="circle" /></PieChart></ResponsiveContainer></div>
          </div>

          {/* HISTORY CHART */}
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-6"><div className="p-2 bg-blue-50 rounded-lg"><BarChart3 size={18} className="text-blue-600" /></div><div><h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">History Comparison</h3><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Net Income Across Batches</p></div></div>
              <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={historyComparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
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