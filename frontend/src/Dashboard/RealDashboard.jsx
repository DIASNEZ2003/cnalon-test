import React, { useEffect, useState, useMemo } from 'react';
import { 
  Layers, TrendingUp, TrendingDown, Users, Skull, 
  Database, Scale, ShoppingBag, 
  LineChart as ChartIcon, Activity, 
  FlaskConical, Wallet, PieChart as PieIcon,
  Clock, Sun, Moon, BarChart3, ArrowUpRight, ArrowDownRight,
  GitCompare, X, Eye, Pill, HeartPulse, CheckCircle,
  Package, Home, Settings, Save, ClipboardList, Utensils, Truck,
  Bell, AlertTriangle, Plus, ArrowRight, Info,
  ChevronRight, Calendar, DollarSign, Target, Package as Sack,
  Droplets, Beaker, Syringe, Tablet, Sun as SunIcon, Calculator
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

const VITAMIN_COLORS = {
    'Electrolytes': '#3b82f6',
    'Biotin/Niacin/Riboflavin': '#8b5cf6',
    'Multi V / Multivi Plus': '#ec4899',
    'Vit ADE': '#f59e0b',
    'Others': '#6b7280'
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

// Helper function to save to localStorage
const saveToLocalStorage = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
};

// Helper function to load from localStorage
const loadFromLocalStorage = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(key);
    return saved !== null ? JSON.parse(saved) : defaultValue;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return defaultValue;
  }
};

const MetricCard = ({ title, value, unit, icon: Icon, colorClass, bgClass, barColor, prevValue, isCurrency = false, isInverse = false, graphData, graphKey, xKey = "day", isComparison = false }) => {
  const hasValue = value !== null && value !== undefined && value !== 0;
  const hasPrevValue = prevValue !== null && prevValue !== undefined && prevValue !== 0;
  
  const formattedValue = isCurrency 
    ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value || 0)
    : (typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : value || '0');

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
    <div className="relative group bg-white rounded-xl shadow-sm border border-gray-100 h-28 transition-all duration-300 overflow-hidden">
      <div className="absolute inset-0 p-4 flex flex-col justify-between z-10 bg-white group-hover:opacity-0 transition-opacity duration-300">
        <div className="flex justify-between items-start">
          <span className={`p-2 rounded-lg ${bgClass} ${colorClass}`}>
            <Icon size={16}/>
          </span>
          <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
        </div>
        <div>
          <h3 className={`text-xl font-black ${colorClass.replace('text-', 'text-opacity-90 text-')}`}>
            {hasValue ? formattedValue : '0'} <span className="text-[10px] font-normal text-gray-400">{unit}</span>
          </h3>
          <div className="flex items-center gap-1 mt-0.5 text-[10px] font-bold opacity-60">
            {hasPrevValue ? (
              <>
                {isBetter ? <ArrowUpRight size={12} className="text-green-600"/> : <ArrowDownRight size={12} className="text-red-600"/>}
                <span className={isBetter ? 'text-green-600' : 'text-red-600'}>vs Last Batch</span>
              </>
            ) : <span className="text-gray-400">No previous data</span>}
          </div>
        </div>
        <div className={`absolute top-4 right-4 opacity-20 ${colorClass}`}><Eye size={14} /></div>
      </div>

      <div className="absolute inset-0 z-20 bg-white p-2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-50 px-2 pt-1">
            <p className="text-[9px] font-black text-gray-600 uppercase">{title} Trend</p>
            <span className={`text-[8px] text-white px-1.5 py-0.5 rounded font-bold`} style={{ backgroundColor: barColor }}>
                {isComparison ? 'VS LAST' : (title === 'Avg Weight' ? 'WEEKLY' : '30 DAYS')}
            </span>
          </div>
          <div className="flex-1 w-full h-full min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              {isComparison ? (
                  <BarChart data={compareData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 700 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                    <Tooltip content={<CustomCompareTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={20}>
                      {compareData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                    </Bar>
                  </BarChart>
              ) : (
                  <AreaChart data={graphData || []} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`grad-${graphKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={barColor} stopOpacity={0.4}/>
                            <stop offset="95%" stopColor={barColor} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey={xKey} hide />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} domain={['auto', 'auto']} />
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
        <div className="relative group bg-white rounded-xl shadow-sm border border-gray-100 h-28 transition-all duration-300 overflow-hidden">
            <div className="absolute inset-0 p-3 flex flex-col justify-between z-10 bg-white group-hover:opacity-0 transition-opacity duration-300 text-center">
                <div className="flex flex-col items-center">
                    <div className="p-1.5 bg-indigo-50 rounded-full mb-1"><Home size={16} className="text-indigo-600" /></div>
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{title}</span>
                </div>
                <div>
                    <h3 className="text-xl font-black text-indigo-900">
                        {count > 0 ? count.toLocaleString() : '0'} <span className="text-[10px] font-normal text-gray-400">heads</span>
                    </h3>
                    <div className="w-full bg-gray-100 h-1 mt-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${count > 0 ? Math.min((count / capacity) * 100, 100) : 0}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="absolute inset-0 z-20 bg-white p-2 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                 <div className="flex justify-between items-center mb-1 pb-1 border-b border-gray-50 px-2 pt-1">
                    <p className="text-[9px] font-black text-gray-600 uppercase">{title} Stats</p>
                    <span className="text-[8px] text-white px-1 py-0.5 rounded font-bold bg-indigo-500">ESTIMATED</span>
                </div>
                <div className="flex-1 w-full h-full min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData || []} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8', fontWeight: 700 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 8, fill: '#94a3b8' }} />
                            <Tooltip content={<CustomPenTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.5 }} />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={16}>
                                {chartData?.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
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
  const [showVitaminTips, setShowVitaminTips] = useState(false);
  
  // State for History Comparison Chart
  const [historyMetric, setHistoryMetric] = useState('income');
  
  // Tab Navigation State
  const [activeTab, setActiveTab] = useState('financials');
  
  // Interactive Forecasting - Load from localStorage with default 1000
  const [nextBatchPop, setNextBatchPop] = useState(() => 
    loadFromLocalStorage('nextBatchPopulation', 1000)
  );

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
    },
    vitaminByType: {}
  });

  const [vitaminForecast, setVitaminForecast] = useState({});
  const [monthlyVitaminTrend, setMonthlyVitaminTrend] = useState({
    historical: [],
    forecast: [],
    trend: { direction: 'stable', rate: 0, average_monthly: 0 }
  });

  useEffect(() => {
    saveToLocalStorage('nextBatchPopulation', nextBatchPop);
  }, [nextBatchPop]);

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
          let vitaminTotals = {};
          
          if (firstActive.expenses) {
            Object.values(firstActive.expenses).forEach(exp => {
              totalExp += Number(exp.amount || 0);
              
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
              
              if (exp.category === 'Vitamins' || exp.category === 'Medications') {
                const vitaminName = exp.itemName || 'Others';
                const quantity = Number(exp.quantity || 0) * Number(exp.purchaseCount || 1);
                vitaminTotals[vitaminName] = (vitaminTotals[vitaminName] || 0) + quantity;
                vitaminGrams += quantity;
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
            },
            vitaminByType: vitaminTotals
          });

          calculateVitaminForecast(firstActive, batchList, vitaminTotals);
        }
      }
      setLoading(false); 
    });
    return () => unsubscribe();
  }, [currentUser]);

  const calculateVitaminForecast = (currentBatch, allBatches, currentVitaminTotals) => {
    const completedBatches = allBatches
      .filter(b => b.status === 'completed' && b.id !== currentBatch.id)
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
      .slice(0, 5); 
    
    const vitaminRates = {}; 
    let hasData = false;

    const vitaminCategories = {
      'Electrolytes': ['Electrolyte', 'Electrolytes', 'elyte', 'lyte'],
      'Biotin/Niacin/Riboflavin': ['Biotin', 'Niacin', 'Riboflavin', 'B-complex', 'B complex', 'Vitamin B'],
      'Multi V / Multivi Plus': ['Multi', 'Multivi', 'Multivitamin', 'MV', 'Multi V', 'Vitamins', 'Multivit'],
      'Vit ADE': ['ADE', 'Vit ADE', 'Vitamin ADE', 'ADE Vit', 'A D E'],
      'Others': [] 
    };

    const newForecast = {
      'Electrolytes': null,
      'Biotin/Niacin/Riboflavin': null,
      'Multi V / Multivi Plus': null,
      'Vit ADE': null,
      'Others': null
    };

    const currentPop = currentBatch.startingPopulation || 1000;

    if (completedBatches.length === 0) {
      Object.keys(vitaminCategories).forEach(category => {
        const keywords = vitaminCategories[category];
        
        let used = 0;
        Object.keys(currentVitaminTotals).forEach(vitName => {
          const matches = keywords.some(keyword => 
            vitName.toLowerCase().includes(keyword.toLowerCase())
          );
          if (matches) used += currentVitaminTotals[vitName];
        });
        
        const defaultRate = category === 'Electrolytes' ? 0.05 : 
                           category === 'Biotin/Niacin/Riboflavin' ? 0.03 :
                           category === 'Multi V / Multivi Plus' ? 0.1 :
                           category === 'Vit ADE' ? 0.07 : 0.04;
        
        const required = defaultRate * currentPop;
        const remaining = required - used;
        const percentage = required > 0 ? (used / required) * 100 : 0;
        const unit = category.includes('Multi') || category.includes('ADE') ? 'ml' : 'g';
        
        let status = 'good';
        let message = '';
        
        if (remaining > 0) {
          if (percentage < 30) {
            status = 'critical';
            message = ` CRITICAL: Add ${remaining.toFixed(1)}${unit} immediately`;
          } else if (percentage < 60) {
            status = 'warning';
            message = `Warning: Need ${remaining.toFixed(1)}${unit} soon`;
          } else if (percentage < 90) {
            status = 'good';
            message = `Stock OK: Need ${remaining.toFixed(1)}${unit} later`;
          } else {
            status = 'good';
            message = `Almost complete: Need ${remaining.toFixed(1)}${unit}`;
          }
        } else {
          status = 'excess';
          message = ` Sufficient (+${Math.abs(remaining).toFixed(1)}${unit} surplus)`;
        }
        
        newForecast[category] = {
          used,
          required,
          remaining: Math.max(0, remaining),
          percentage: Math.min(percentage, 100),
          status,
          message,
          unit,
          dosagePerBird: defaultRate
        };
      });
      
      setVitaminForecast(newForecast);
      return;
    }

    completedBatches.forEach((batch) => {
      const batchPop = batch.startingPopulation || 1;
      if (batch.expenses) {
        Object.values(batch.expenses).forEach(exp => {
          if (exp.category === 'Vitamins' || exp.category === 'Medications') {
            hasData = true;
            const vitaminName = exp.itemName || 'Others';
            const quantity = Number(exp.quantity || 0) * Number(exp.purchaseCount || 1);
            
            const ratePerBird = quantity / batchPop;
            
            if (!vitaminRates[vitaminName]) vitaminRates[vitaminName] = [];
            vitaminRates[vitaminName].push(ratePerBird);
          }
        });
      }
    });

    Object.keys(vitaminCategories).forEach(category => {
      const keywords = vitaminCategories[category];
      let totalRate = 0;
      let count = 0;
      let used = 0;
      
      Object.keys(currentVitaminTotals).forEach(vitName => {
        const matches = keywords.some(keyword => 
          vitName.toLowerCase().includes(keyword.toLowerCase())
        );
        if (matches) used += currentVitaminTotals[vitName];
      });
      
      if (hasData) {
        Object.keys(vitaminRates).forEach(vitName => {
          const matches = keywords.some(keyword => 
            vitName.toLowerCase().includes(keyword.toLowerCase())
          );
          if (matches) {
            vitaminRates[vitName].forEach(rate => {
              totalRate += rate;
              count++;
            });
          }
        });
      }
      
      if (count > 0) {
        const avgRate = totalRate / count;
        const required = avgRate * currentPop;
        const remaining = required - used;
        const percentage = required > 0 ? (used / required) * 100 : 0;
        const unit = category.includes('Multi') || category.includes('ADE') ? 'ml' : 'g';
        
        let status = 'good';
        let message = '';
        
        if (remaining > 0) {
          if (percentage < 30) {
            status = 'critical';
            message = ` CRITICAL: Add ${remaining.toFixed(1)}${unit} immediately`;
          } else if (percentage < 60) {
            status = 'warning';
            message = ` Warning: Need ${remaining.toFixed(1)}${unit} soon`;
          } else if (percentage < 90) {
            status = 'good';
            message = ` Stock OK: Need ${remaining.toFixed(1)}${unit} later`;
          } else {
            status = 'good';
            message = ` Almost complete: Need ${remaining.toFixed(1)}${unit}`;
          }
        } else {
          status = 'excess';
          message = ` Sufficient (+${Math.abs(remaining).toFixed(1)}${unit} surplus)`;
        }
        
        newForecast[category] = {
          used,
          required,
          remaining: Math.max(0, remaining),
          percentage: Math.min(percentage, 100),
          status,
          message,
          unit,
          dosagePerBird: avgRate
        };
      } else if (category === 'Others') {
        let othersUsed = 0;
        const unmatchedVitamins = [];
        
        Object.keys(currentVitaminTotals).forEach(vitName => {
          let matched = false;
          Object.keys(vitaminCategories).forEach(cat => {
            if (cat !== 'Others') {
              const matches = vitaminCategories[cat].some(keyword => 
                vitName.toLowerCase().includes(keyword.toLowerCase())
              );
              if (matches) matched = true;
            }
          });
          if (!matched) {
            othersUsed += currentVitaminTotals[vitName];
            unmatchedVitamins.push(vitName);
          }
        });
        
        if (othersUsed > 0 || unmatchedVitamins.length > 0) {
          newForecast[category] = {
            used: othersUsed,
            required: othersUsed * 1.2, 
            remaining: othersUsed * 0.2,
            percentage: 83,
            status: 'good',
            message: ` ${unmatchedVitamins.length} other vitamins in stock`,
            unit: 'units',
            dosagePerBird: 0.05
          };
        }
      }
    });
    
    setVitaminForecast(newForecast);

    const vitaminMonthlyData = {};
    completedBatches.forEach(batch => {
        const date = batch.dateCreated || '';
        const month = date.substring(0, 7);
        let totalVol = 0;
        if(batch.expenses) {
            Object.values(batch.expenses).forEach(exp => {
                if(exp.category === 'Vitamins' || exp.category === 'Medications') {
                    totalVol += (Number(exp.quantity||0) * Number(exp.purchaseCount||1));
                }
            });
        }
        if(!vitaminMonthlyData[month]) vitaminMonthlyData[month] = { total: 0, batches: 0 };
        vitaminMonthlyData[month].total += totalVol;
        vitaminMonthlyData[month].batches += 1;
    });

    const months = Object.keys(vitaminMonthlyData).sort();
    if (months.length > 0) {
        const historical = months.map(m => ({
            month: m,
            total: vitaminMonthlyData[m].total,
            batches: vitaminMonthlyData[m].batches
        }));
        
        setMonthlyVitaminTrend({
            historical,
            forecast: [], 
            trend: {
                direction: 'stable', rate: 0, average_monthly: 0
            }
        });
    }
  };

  useEffect(() => {
    const getForecasts = async () => {
      if (activeBatch && activeBatch.id && currentUser) {
        setLoadingForecast(true);
        try {
          const token = await currentUser.getIdToken();
          const feedRes = await fetch(`${backendUrl}/get-feed-forecast/${activeBatch.id}`, { 
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (feedRes.ok) {
              const data = await feedRes.json();
              const feed = data.feedForecast || [];
              const weight = data.weightForecast || [];
              
              const weightMap = {};
              weight.forEach(w => {
                const dayNum = parseInt(w.day.replace('Day ', ''));
                weightMap[dayNum] = w;
              });
              
              const mergedData = feed.map(f => {
                  const matchingWeight = weightMap[f.day];
                  return {
                      ...f,
                      day: f.day,
                      feedType: f.feedType,
                      targetKilos: f.targetKilos,
                      Booster: f.feedType === 'Booster' ? f.targetKilos : 0,
                      Starter: f.feedType === 'Starter' ? f.targetKilos : 0,
                      Finisher: f.feedType === 'Finisher' ? f.targetKilos : 0,
                      projectedWeight: matchingWeight ? matchingWeight.weight : null,
                      avgWeight: matchingWeight ? matchingWeight.avgWeight : null
                  };
              });
              
              setForecastData(mergedData);
          }
        } catch (err) { 
          console.error(err); 
        } finally { 
          setLoadingForecast(false); 
        }
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

  const handlePopulationChange = (e) => {
    const value = e.target.value;
    if (value === '') {
      setNextBatchPop('');
      return;
    }
    if (!isNaN(value) && value.trim() !== '') {
      setNextBatchPop(parseFloat(value));
    } else {
      setNextBatchPop(value);
    }
  };

  const getInputDisplayValue = () => {
    if (nextBatchPop === '' || nextBatchPop === null || nextBatchPop === undefined) {
      return '';
    }
    return nextBatchPop.toString();
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
      }
      return { daily, weekly };
  }, [activeBatch]);

  const penDistribution = useMemo(() => {
    if (!activeBatch) return [];
    const currentPopulationCount = (activeBatch.startingPopulation || 0) - stats.mortality - stats.qtyHarvested;
    if (currentPopulationCount <= 0) return [];
    
    const penCount = activeBatch.penCount || 5; 
    const basePerPen = Math.floor(currentPopulationCount / penCount);
    const remainder = currentPopulationCount % penCount;
    
    return Array.from({ length: penCount }, (_, i) => {
        const heads = i < remainder ? basePerPen + 1 : basePerPen;
        const ratio = heads / currentPopulationCount;
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
    return { 
      name: batch.batchName, 
      population: batch.startingPopulation || 0, 
      sales, 
      expenses, 
      profit: sales - expenses, 
      harvested: harvestQty, 
      feedKilos, 
      mortality: mort, 
      avgWeight: weight 
    };
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
    forecastData.forEach(d => { 
      if (d && d.feedType) {
        if (totals[d.feedType] !== undefined) {
          totals[d.feedType] += d.targetKilos || 0;
        }
        totals.Total += d.targetKilos || 0;
      }
    });
    return totals;
  }, [forecastData]);

  const expensePieData = useMemo(() => {
    if (!activeBatch?.expenses) return [];
    const categories = {};
    Object.values(activeBatch.expenses).forEach(exp => categories[exp.category] = (categories[exp.category] || 0) + Number(exp.amount || 0));
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [activeBatch]);

  const historyComparisonData = useMemo(() => {
    return allBatchesData
        .filter(b => b.status === 'completed' || b.status === 'active')
        .slice(0, 5)
        .reverse()
        .map(b => {
            let exp = 0, sale = 0, mort = 0;
            if (b.expenses) Object.values(b.expenses).forEach(e => exp += Number(e.amount || 0));
            if (b.sales) Object.values(b.sales).forEach(s => sale += Number(s.totalAmount || 0));
            if (b.mortality_logs) Object.values(b.mortality_logs).forEach(m => mort += (Number(m.am || 0) + Number(m.pm || 0)));
            return { 
              name: b.batchName, 
              income: sale - exp, 
              sales: sale,
              expenses: exp,
              mortality: mort,
              population: b.startingPopulation || 0,
              status: b.status 
            };
        }); 
  }, [allBatchesData]);

  const getFeedStatus = (feedType) => {
    const required = feedBreakdown[feedType] || 0;
    const purchased = stats.feedByType[feedType] || 0;
    const used = purchased;
    
    if (required === 0) {
      return { used: 0, required: 0, remaining: 0, percentage: 0, status: 'none', message: 'No forecast data' };
    }
    
    const percentage = (used / required) * 100;
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
      message = ` CRITICAL: Need ${remaining.toFixed(1)} kg urgently`;
    } else if (percentage < 60) {
      status = 'warning';
      message = ` Warning: Prepare ${remaining.toFixed(1)} kg soon`;
    } else if (percentage < 90) {
      status = 'good';
      message = `✓Stock OK: ${remaining.toFixed(1)} kg left`;
    } else {
      status = 'good';
      message = ` Almost complete: ${remaining.toFixed(1)} kg left`;
    }
    
    return { used, required, remaining, percentage, status, message };
  };

  if (loading) return <div className="p-8 text-center text-gray-400 font-bold text-sm">Loading Dashboard...</div>;
  if (!activeBatch) return <div className="p-8 text-center"><h3 className="text-lg font-bold text-red-900">No Active Batch</h3></div>;

  const currentPop = (activeBatch.startingPopulation || 0) - stats.qtyHarvested - stats.mortality;
  const currentMetrics = getBatchMetrics(activeBatch);
  const prevMetrics = getBatchMetrics(previousBatch);
  const formatCurrency = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);

  const formatHistoryTooltip = (value) => {
     if (historyMetric === 'income' || historyMetric === 'sales' || historyMetric === 'expenses') {
         return formatCurrency(value);
     }
     return value.toLocaleString();
  };

  const getMetricLabel = () => {
     switch(historyMetric) {
       case 'income': return 'Net Income';
       case 'sales': return 'Sales';
       case 'expenses': return 'Expenses';
       case 'mortality': return 'Mortality';
       case 'population': return 'Population';
       default: return 'Value';
     }
  };

  const CustomFeedTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      if (!data) return null;
      
      return ( 
        <div className="bg-white p-2.5 rounded-lg shadow-xl border border-gray-100 min-w-[180px]">
          <p className="text-[10px] font-bold text-gray-500 mb-0.5">Day {data.day}</p>
          <p className="text-xs font-black text-indigo-600 mb-1.5">{data.feedType || 'Feed'}</p>
          
          <div className="space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-gray-500">Feed Amount:</span>
              <span className="font-bold text-gray-800">{data.targetKilos?.toFixed(1) || '0'} kg</span>
            </div>
            
            {data.projectedWeight && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Est. Weight:</span>
                  <span className="font-bold text-purple-600">{data.projectedWeight} kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Avg/Bird:</span>
                  <span className="font-bold text-gray-800">{data.avgWeight} g</span>
                </div>
              </>
            )}
          </div>
        </div> 
      );
    } 
    return null;
  };

  const boosterStatus = getFeedStatus('Booster');
  const starterStatus = getFeedStatus('Starter');
  const finisherStatus = getFeedStatus('Finisher');

  const availableVitamins = Object.entries(vitaminForecast).filter(([key, value]) => value !== null);

  const TABS = [
    { id: 'financials', label: 'Financial Overview', icon: DollarSign },
    { id: 'performance', label: 'Batch Performance', icon: Activity },
    { id: 'feed', label: 'Feed Management', icon: Package },
    { id: 'vitamins', label: 'Vitamin Tracker', icon: FlaskConical },
  ];

  return (
    <div className="flex-1 bg-gray-50 -mt-7 p-3 md:p-4 overflow-y-auto pb-16 relative">
      {/* HEADER */}
      <div className="bg-[#3B0A0A] p-4 rounded-xl shadow-lg text-white mb-4 relative overflow-hidden">
        <div className="relative z-10 flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
              <Layers size={18} className="text-orange-400"/><h1 className="text-xl font-bold uppercase">{activeBatch.batchName}</h1>
              {previousBatch && <button onClick={() => setShowCompareModal(true)} className="ml-2 flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-lg text-[9px] uppercase font-bold transition-colors border border-white/10"><GitCompare size={10} /> Compare vs Last</button>}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group/notify">
                <button className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors relative">
                    <Bell size={14} />
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#3B0A0A]"></span>
                </button>
            </div>

            <button onClick={() => setShowSettingsModal(true)} className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-colors"><Settings size={14} /></button>
            <span className="text-[10px] text-orange-200 font-bold uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded">Day {currentBatchDay} / 30</span>
            <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30 font-bold uppercase">{activeBatch.status}</span>
          </div>
        </div>
        <div className="relative z-10 w-full bg-black/30 h-2 rounded-full overflow-hidden"><div className="bg-gradient-to-r from-orange-400 to-red-500 h-full transition-all duration-500 shadow-sm" style={{ width: `${progress}%` }} /></div>
        <div className="relative z-10 flex justify-between mt-1.5 text-[9px] font-bold text-white/50 uppercase"><span>Started: {activeBatch.dateCreated}</span><span className="text-orange-300">Harvest: {activeBatch.expectedCompleteDate}</span></div>
      </div>

      {/* TABS NAVIGATION */}
      <div className="flex overflow-x-auto gap-2 mb-4 pb-1 no-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-red-900 text-white shadow-sm' 
                : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- TAB CONTENT: FINANCIAL OVERVIEW --- */}
      {activeTab === 'financials' && (
        <div className="animate-fadeIn">
          <h2 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-3 ml-1">Financial Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <MetricCard title="Total Sales" value={stats.sales} prevValue={prevMetrics?.sales || 0} icon={ShoppingBag} colorClass="text-blue-700" bgClass="bg-blue-50" barColor="#2563eb" isCurrency={true} isComparison={true} />
            <MetricCard title="Net Profit" value={stats.sales - stats.expenses} prevValue={prevMetrics?.profit || 0} icon={Wallet} colorClass={stats.sales - stats.expenses >= 0 ? "text-emerald-700" : "text-red-700"} bgClass={stats.sales - stats.expenses >= 0 ? "bg-emerald-50" : "bg-red-50"} barColor="#10b981" isCurrency={true} isComparison={true} />
            <MetricCard title="Total Expenses" value={stats.expenses} prevValue={prevMetrics?.expenses || 0} icon={TrendingDown} colorClass="text-red-700" bgClass="bg-red-50" barColor="#dc2626" isCurrency={true} isInverse={true} isComparison={true} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Expense Overview Pie Chart */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 bg-rose-50 rounded-lg">
                  <PieIcon size={16} className="text-rose-600" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide">Expense Overview</h3>
                </div>
              </div>
              <div className="h-56 w-full">
                {expensePieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={expensePieData} 
                        cx="35%" 
                        cy="50%" 
                        innerRadius={50} 
                        outerRadius={80} 
                        paddingAngle={5} 
                        dataKey="value"
                      >
                        {expensePieData.map((entry, index) => 
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        )}
                      </Pie>
                      <Tooltip formatter={(v) => formatCurrency(v)} wrapperStyle={{ fontSize: '10px' }} />
                      <Legend 
                        layout="vertical" 
                        verticalAlign="middle" 
                        align="right"
                        iconType="circle" 
                        wrapperStyle={{ fontSize: '11px', lineHeight: '24px', paddingLeft: '10px' }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                    No expense data available
                  </div>
                )}
              </div>
            </div>
            
            {/* History Comparison Bar Chart */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-50 rounded-lg">
                    <BarChart3 size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide">History Comparison</h3>
                  </div>
                </div>
                {/* SELECTOR FOR CATEGORY */}
                <select 
                  value={historyMetric}
                  onChange={(e) => setHistoryMetric(e.target.value)}
                  className="text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="income">Net Income</option>
                  <option value="sales">Sales</option>
                  <option value="expenses">Expenses</option>
                  <option value="mortality">Mortality</option>
                  <option value="population">Population</option>
                </select>
              </div>
              <div className="h-56 w-full">
                {historyComparisonData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={historyComparisonData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
                      <Tooltip formatter={(v) => [formatHistoryTooltip(v), getMetricLabel()]} wrapperStyle={{ fontSize: '10px' }} />
                      <Bar dataKey={historyMetric} radius={[6, 6, 0, 0]} barSize={28}>
                        {historyComparisonData.map((entry, index) => 
                          <Cell key={`cell-${index}`} fill={entry.status === 'active' ? '#f97316' : '#3B0A0A'} />
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                    No historical data available
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB CONTENT: BATCH PERFORMANCE --- */}
      {activeTab === 'performance' && (
        <div className="animate-fadeIn">
          <h2 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-3 ml-1">Batch Performance</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <MetricCard title="Live Pop." value={currentPop} unit="heads" icon={Users} colorClass="text-cyan-700" bgClass="bg-cyan-50" barColor="#0891b2" graphData={batchTrendData.daily} graphKey="population" />
            <MetricCard title="Mortality" value={stats.mortality} unit="heads" icon={Skull} colorClass="text-red-600" bgClass="bg-red-50" barColor="#dc2626" graphData={batchTrendData.daily} graphKey="mortality" />
            <MetricCard title="Feed Used" value={stats.totalFeedKilos} unit="kg" icon={Package} colorClass="text-orange-700" bgClass="bg-orange-50" barColor="#f97316" graphData={batchTrendData.daily} graphKey="feed" />
            <MetricCard title="Vitamins" value={stats.totalVitaminGrams} unit="g/ml" icon={FlaskConical} colorClass="text-green-700" bgClass="bg-green-50" barColor="#16a34a" graphData={batchTrendData.daily} graphKey="vitamins" />
            <MetricCard title="Avg Weight" value={stats.avgWeight} unit="g" icon={Scale} colorClass="text-amber-700" bgClass="bg-amber-50" barColor="#d97706" graphData={batchTrendData.weekly} graphKey="weight" xKey="name" />
            <MetricCard title="Qty Harvested" value={stats.qtyHarvested} prevValue={prevMetrics?.harvested || 0} unit="heads" icon={CheckCircle} colorClass="text-emerald-700" bgClass="bg-emerald-50" barColor="#10b981" isComparison={true} />
          </div>

          {/* PEN STATUS */}
          {penDistribution.length > 0 && (
            <>
              <h2 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-3 ml-1">Pen Status</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                {penDistribution.map((pen) => (
                  <PenMetricCard key={pen.id} title={`Pen ${pen.id}`} count={pen.count} capacity={pen.capacity} chartData={pen.stats} />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: FEED MANAGEMENT --- */}
      {activeTab === 'feed' && (
        <div className="animate-fadeIn">
          {/* FULL WIDTH FORECAST CHART */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3 border-b pb-3 border-gray-50">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-50 rounded-lg"><Package size={16} className="text-orange-600" /></div>
                    <div>
                        <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide">Feed & Weight Forecast</h3>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest">Hover to see details</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                    <div className="px-2 py-1 bg-green-50 rounded-lg border border-green-100"><span className="block text-[8px] font-bold text-green-600 uppercase">Booster</span><span className="font-black text-gray-700">{feedBreakdown.Booster.toFixed(1)}</span></div>
                    <div className="px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-100"><span className="block text-[8px] font-bold text-emerald-600 uppercase">Starter</span><span className="font-black text-gray-700">{feedBreakdown.Starter.toFixed(1)}</span></div>
                    <div className="px-2 py-1 bg-yellow-50 rounded-lg border border-yellow-100"><span className="block text-[8px] font-bold text-yellow-600 uppercase">Finisher</span><span className="font-black text-gray-700">{feedBreakdown.Finisher.toFixed(1)}</span></div>
                    <div className="px-2 py-1 bg-indigo-600 rounded-lg border border-indigo-700 text-white"><span className="block text-[8px] font-bold uppercase opacity-80">Total</span><span className="font-black">{feedBreakdown.Total.toFixed(1)} kg</span></div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-4 h-56 w-full">
                  {!loadingForecast && forecastData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart 
                        data={forecastData} 
                        margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="day" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 9, fill: '#9ca3af'}}
                        />
                        <YAxis 
                          yAxisId="left" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 9, fill: '#9ca3af'}}
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{fontSize: 9, fill: '#8b5cf6'}}
                        />
                        <Tooltip content={<CustomFeedTooltip />} />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', paddingTop: '5px' }} />
                        <Area 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey="Booster" 
                          stackId="1" 
                          stroke={FEED_COLORS.Booster} 
                          fill={FEED_COLORS.Booster} 
                          strokeWidth={2} 
                          fillOpacity={0.6} 
                          name="Booster"
                        />
                        <Area 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey="Starter" 
                          stackId="1" 
                          stroke={FEED_COLORS.Starter} 
                          fill={FEED_COLORS.Starter} 
                          strokeWidth={2} 
                          fillOpacity={0.6} 
                          name="Starter"
                        />
                        <Area 
                          yAxisId="left" 
                          type="monotone" 
                          dataKey="Finisher" 
                          stackId="1" 
                          stroke={FEED_COLORS.Finisher} 
                          fill={FEED_COLORS.Finisher} 
                          strokeWidth={2} 
                          fillOpacity={0.6} 
                          name="Finisher"
                        />
                        <Line 
                          yAxisId="right" 
                          connectNulls 
                          type="monotone" 
                          dataKey="projectedWeight" 
                          name="Est. Batch Weight" 
                          stroke="#8b5cf6" 
                          strokeWidth={2} 
                          dot={{r: 3, fill: '#8b5cf6', strokeWidth: 1.5, stroke: '#fff'}} 
                          activeDot={{ r: 5 }} 
                        />
                        <ReferenceLine 
                          yAxisId="left" 
                          x={currentBatchDay} 
                          stroke="#f97316" 
                          strokeWidth={2} 
                          strokeDasharray="3 3" 
                          label={{ 
                            position: 'top', 
                            value: 'Today', 
                            fill: '#f97316', 
                            fontSize: 9, 
                            fontWeight: 'bold' 
                          }} 
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                      {loadingForecast ? 'Loading...' : 'No data available'}
                    </div>
                  )}
                </div>
            </div>
          </div>

          {/* FEED INSIGHT SECTION */}
          {(boosterStatus.required > 0 || starterStatus.required > 0 || finisherStatus.required > 0) && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3 border-b pb-3 border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-50 rounded-lg">
                    <Sack size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide">Feed Inventory Status</h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowFeedTips(!showFeedTips)}
                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                  >
                    <Info size={12} />
                    {showFeedTips ? 'Hide Tips' : 'Tips'}
                  </button>
                  
                  <button 
                    onClick={handleNavigateToExpenses}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm"
                  >
                    <Plus size={14} />
                    Manage
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {showFeedTips && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-blue-100 rounded-md">
                      <Info size={14} className="text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-blue-800 mb-1.5">Quick Tips</h4>
                      <ul className="space-y-1 text-[10px]">
                        <li className="flex items-start gap-1.5">
                          <div className="w-1 h-1 bg-blue-600 rounded-full mt-1"></div>
                          <span className="text-blue-700">Keep at least 3 days of feed stock to avoid interruptions.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <div className="w-1 h-1 bg-blue-600 rounded-full mt-1"></div>
                          <span className="text-blue-700">Check feed quality before each feeding.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Booster Card */}
                {boosterStatus.required > 0 && (
                  <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
                    boosterStatus.status === 'critical' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
                    boosterStatus.status === 'warning' ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300' :
                    'bg-gradient-to-br from-green-50 to-green-100 border-green-300'
                  }`}>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded-lg ${
                          boosterStatus.status === 'critical' ? 'bg-red-200' :
                          boosterStatus.status === 'warning' ? 'bg-amber-200' :
                          'bg-green-200'
                        }`}>
                          <Sack size={16} className={
                            boosterStatus.status === 'critical' ? 'text-red-700' :
                            boosterStatus.status === 'warning' ? 'text-amber-700' :
                            'text-green-700'
                          } />
                        </div>
                        <div>
                          <h4 className="font-black text-xs text-gray-800">Booster</h4>
                          <p className="text-[9px] text-gray-500">Days 1-10</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="relative w-12 h-12">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle cx="24" cy="24" r="20" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                            <circle cx="24" cy="24" r="20" stroke={boosterStatus.status === 'critical' ? '#ef4444' : boosterStatus.status === 'warning' ? '#f59e0b' : '#22c55e'} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 20}`} strokeDashoffset={`${2 * Math.PI * 20 * (1 - boosterStatus.percentage / 100)}`} className="transition-all duration-500" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-black">{Math.round(boosterStatus.percentage)}%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-gray-800">{boosterStatus.used.toFixed(1)}<span className="text-[9px] font-normal text-gray-500 ml-0.5">kg</span></p>
                          <p className="text-[9px] text-gray-500">of {boosterStatus.required.toFixed(1)} kg</p>
                        </div>
                      </div>

                      <div className={`p-2 rounded-lg mb-2 ${
                        boosterStatus.status === 'critical' ? 'bg-red-200/50' :
                        boosterStatus.status === 'warning' ? 'bg-amber-200/50' :
                        boosterStatus.status === 'excess' ? 'bg-blue-200/50' :
                        'bg-green-200/50'
                      }`}>
                        <div className="flex items-start gap-1.5">
                          {boosterStatus.status === 'critical' && <AlertTriangle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />}
                          {boosterStatus.status === 'warning' && <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                          {boosterStatus.status === 'good' && <CheckCircle size={12} className="text-green-600 flex-shrink-0 mt-0.5" />}
                          {boosterStatus.status === 'excess' && <CheckCircle size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />}
                          <p className={`text-[9px] font-bold ${
                            boosterStatus.status === 'critical' ? 'text-red-700' :
                            boosterStatus.status === 'warning' ? 'text-amber-700' :
                            boosterStatus.status === 'excess' ? 'text-blue-700' :
                            'text-green-700'
                          }`}>
                            {boosterStatus.message}
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={handleNavigateToExpenses}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus size={12} />
                        Add More
                      </button>
                    </div>
                  </div>
                )}

                {/* Starter Card */}
                {starterStatus.required > 0 && (
                  <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
                    starterStatus.status === 'critical' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
                    starterStatus.status === 'warning' ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300' :
                    'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-300'
                  }`}>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded-lg ${
                          starterStatus.status === 'critical' ? 'bg-red-200' :
                          starterStatus.status === 'warning' ? 'bg-amber-200' :
                          'bg-emerald-200'
                        }`}>
                          <Sack size={16} className={
                            starterStatus.status === 'critical' ? 'text-red-700' :
                            starterStatus.status === 'warning' ? 'text-amber-700' :
                            'text-emerald-700'
                          } />
                        </div>
                        <div>
                          <h4 className="font-black text-xs text-gray-800">Starter</h4>
                          <p className="text-[9px] text-gray-500">Days 11-20</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="relative w-12 h-12">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle cx="24" cy="24" r="20" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                            <circle cx="24" cy="24" r="20" stroke={starterStatus.status === 'critical' ? '#ef4444' : starterStatus.status === 'warning' ? '#f59e0b' : '#15803d'} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 20}`} strokeDashoffset={`${2 * Math.PI * 20 * (1 - starterStatus.percentage / 100)}`} className="transition-all duration-500" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-black">{Math.round(starterStatus.percentage)}%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-gray-800">{starterStatus.used.toFixed(1)}<span className="text-[9px] font-normal text-gray-500 ml-0.5">kg</span></p>
                          <p className="text-[9px] text-gray-500">of {starterStatus.required.toFixed(1)} kg</p>
                        </div>
                      </div>

                      <div className={`p-2 rounded-lg mb-2 ${
                        starterStatus.status === 'critical' ? 'bg-red-200/50' :
                        starterStatus.status === 'warning' ? 'bg-amber-200/50' :
                        starterStatus.status === 'excess' ? 'bg-blue-200/50' :
                        'bg-emerald-200/50'
                      }`}>
                        <div className="flex items-start gap-1.5">
                          {starterStatus.status === 'critical' && <AlertTriangle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />}
                          {starterStatus.status === 'warning' && <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                          {starterStatus.status === 'good' && <CheckCircle size={12} className="text-emerald-600 flex-shrink-0 mt-0.5" />}
                          {starterStatus.status === 'excess' && <CheckCircle size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />}
                          <p className={`text-[9px] font-bold ${
                            starterStatus.status === 'critical' ? 'text-red-700' :
                            starterStatus.status === 'warning' ? 'text-amber-700' :
                            starterStatus.status === 'excess' ? 'text-blue-700' :
                            'text-emerald-700'
                          }`}>
                            {starterStatus.message}
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={handleNavigateToExpenses}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus size={12} />
                        Add More
                      </button>
                    </div>
                  </div>
                )}

                {/* Finisher Card */}
                {finisherStatus.required > 0 && (
                  <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
                    finisherStatus.status === 'critical' ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300' :
                    finisherStatus.status === 'warning' ? 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-300' :
                    'bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-300'
                  }`}>
                    <div className="p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`p-1.5 rounded-lg ${
                          finisherStatus.status === 'critical' ? 'bg-red-200' :
                          finisherStatus.status === 'warning' ? 'bg-amber-200' :
                          'bg-yellow-200'
                        }`}>
                          <Sack size={16} className={
                            finisherStatus.status === 'critical' ? 'text-red-700' :
                            finisherStatus.status === 'warning' ? 'text-amber-700' :
                            'text-yellow-700'
                          } />
                        </div>
                        <div>
                          <h4 className="font-black text-xs text-gray-800">Finisher</h4>
                          <p className="text-[9px] text-gray-500">Days 21-30</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <div className="relative w-12 h-12">
                          <svg className="w-12 h-12 transform -rotate-90">
                            <circle cx="24" cy="24" r="20" stroke="#e5e7eb" strokeWidth="4" fill="none" />
                            <circle cx="24" cy="24" r="20" stroke={finisherStatus.status === 'critical' ? '#ef4444' : finisherStatus.status === 'warning' ? '#f59e0b' : '#eab308'} strokeWidth="4" fill="none" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 20}`} strokeDashoffset={`${2 * Math.PI * 20 * (1 - finisherStatus.percentage / 100)}`} className="transition-all duration-500" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[10px] font-black">{Math.round(finisherStatus.percentage)}%</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-gray-800">{finisherStatus.used.toFixed(1)}<span className="text-[9px] font-normal text-gray-500 ml-0.5">kg</span></p>
                          <p className="text-[9px] text-gray-500">of {finisherStatus.required.toFixed(1)} kg</p>
                        </div>
                      </div>

                      <div className={`p-2 rounded-lg mb-2 ${
                        finisherStatus.status === 'critical' ? 'bg-red-200/50' :
                        finisherStatus.status === 'warning' ? 'bg-amber-200/50' :
                        finisherStatus.status === 'excess' ? 'bg-blue-200/50' :
                        'bg-yellow-200/50'
                      }`}>
                        <div className="flex items-start gap-1.5">
                          {finisherStatus.status === 'critical' && <AlertTriangle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />}
                          {finisherStatus.status === 'warning' && <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />}
                          {finisherStatus.status === 'good' && <CheckCircle size={12} className="text-yellow-600 flex-shrink-0 mt-0.5" />}
                          {finisherStatus.status === 'excess' && <CheckCircle size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />}
                          <p className={`text-[9px] font-bold ${
                            finisherStatus.status === 'critical' ? 'text-red-700' :
                            finisherStatus.status === 'warning' ? 'text-amber-700' :
                            finisherStatus.status === 'excess' ? 'text-blue-700' :
                            'text-yellow-700'
                          }`}>
                            {finisherStatus.message}
                          </p>
                        </div>
                      </div>

                      <button 
                        onClick={handleNavigateToExpenses}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Plus size={12} />
                        Add More
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Feed Critical Alert Banner */}
              {(() => {
                const criticalFeeds = [
                  boosterStatus.status === 'critical' ? 'Booster' : null,
                  starterStatus.status === 'critical' ? 'Starter' : null,
                  finisherStatus.status === 'critical' ? 'Finisher' : null
                ].filter(Boolean);

                if (criticalFeeds.length > 0) {
                  return (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-500" />
                        <div>
                          <p className="text-xs font-black text-red-800">Critical Feed Alert!</p>
                          <p className="text-[10px] text-red-600 font-medium leading-tight">
                            {criticalFeeds.join(', ')} {criticalFeeds.length > 1 ? 'are' : 'is'} running low.
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={handleNavigateToExpenses}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        Add Now
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* --- TAB CONTENT: VITAMIN TRACKER --- */}
      {activeTab === 'vitamins' && (
        <div className="animate-fadeIn">
          {availableVitamins.length > 0 ? (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3 border-b pb-3 border-gray-50">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-50 rounded-lg">
                    <FlaskConical size={16} className="text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-gray-800 uppercase tracking-wide">Vitamin Tracker</h3>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowVitaminTips(!showVitaminTips)}
                    className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all"
                  >
                    <Info size={12} />
                    {showVitaminTips ? 'Hide' : 'Tips'}
                  </button>
                  
                  <button 
                    onClick={handleNavigateToExpenses}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 shadow-sm"
                  >
                    <Plus size={14} />
                    Manage
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>

              {showVitaminTips && (
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <div className="p-1.5 bg-purple-100 rounded-md">
                      <Info size={14} className="text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-black text-purple-800 mb-1.5">Vitamin Insights</h4>
                      <ul className="space-y-1 text-[10px]">
                        <li className="flex items-start gap-1.5">
                          <div className="w-1 h-1 bg-purple-600 rounded-full mt-1"></div>
                          <span className="text-purple-700">Calculates needs based on previous batches.</span>
                        </li>
                        <li className="flex items-start gap-1.5">
                          <div className="w-1 h-1 bg-purple-600 rounded-full mt-1"></div>
                          <span className="text-purple-700">Enter "Next Population" below to forecast.</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* NEXT BATCH PLANNER INPUT */}
              <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-col md:flex-row items-center justify-between gap-3">
                 <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-white rounded-md border border-gray-200 shadow-sm text-indigo-600">
                        <Calculator size={16} />
                    </div>
                    <div>
                        <h4 className="text-xs font-black text-gray-800">Next batch planner</h4>
                    </div>
                 </div>
                 <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-300 focus-within:ring-1 focus-within:ring-purple-500">
                    <Users size={14} className="text-gray-400 ml-1.5" />
                    <input 
                        type="text"
                        className="w-24 p-1.5 text-xs font-bold text-gray-800 outline-none"
                        value={getInputDisplayValue()}
                        onChange={handlePopulationChange}
                        placeholder="Heads"
                    />
                 </div>
              </div>

              {/* Vitamin Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vitaminForecast['Electrolytes'] && (
                  <VitaminCard 
                    vitamin={vitaminForecast['Electrolytes']}
                    name="Electrolytes"
                    icon={Droplets}
                    color="blue"
                    nextBatchPop={typeof nextBatchPop === 'number' ? nextBatchPop : 0}
                    onNavigate={handleNavigateToExpenses}
                  />
                )}
                
                {vitaminForecast['Biotin/Niacin/Riboflavin'] && (
                  <VitaminCard 
                    vitamin={vitaminForecast['Biotin/Niacin/Riboflavin']}
                    name="Biotin Complex"
                    icon={Beaker}
                    color="purple"
                    nextBatchPop={typeof nextBatchPop === 'number' ? nextBatchPop : 0}
                    onNavigate={handleNavigateToExpenses}
                  />
                )}
                
                {vitaminForecast['Multi V / Multivi Plus'] && (
                  <VitaminCard 
                    vitamin={vitaminForecast['Multi V / Multivi Plus']}
                    name="Multi V"
                    icon={Pill}
                    color="pink"
                    nextBatchPop={typeof nextBatchPop === 'number' ? nextBatchPop : 0}
                    onNavigate={handleNavigateToExpenses}
                  />
                )}
                
                {vitaminForecast['Vit ADE'] && (
                  <VitaminCard 
                    vitamin={vitaminForecast['Vit ADE']}
                    name="Vit ADE"
                    icon={SunIcon}
                    color="orange"
                    nextBatchPop={typeof nextBatchPop === 'number' ? nextBatchPop : 0}
                    onNavigate={handleNavigateToExpenses}
                  />
                )}

                {vitaminForecast['Others'] && (
                  <VitaminCard 
                    vitamin={vitaminForecast['Others']}
                    name="Other Vitamins"
                    icon={FlaskConical}
                    color="gray"
                    nextBatchPop={typeof nextBatchPop === 'number' ? nextBatchPop : 0}
                    onNavigate={handleNavigateToExpenses}
                  />
                )}
              </div>

              {/* Vitamin Critical Alert Banner */}
              {(() => {
                const criticalVits = Object.entries(vitaminForecast)
                  .filter(([_, v]) => v && v.status === 'critical')
                  .map(([k]) => k === 'Biotin/Niacin/Riboflavin' ? 'Biotin Complex' : k);

                if (criticalVits.length > 0) {
                  return (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between animate-pulse">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={18} className="text-red-500" />
                        <div>
                          <p className="text-xs font-black text-red-800">Critical Vitamin Alert!</p>
                          <p className="text-[10px] text-red-600 font-medium leading-tight">
                            {criticalVits.join(', ')} {criticalVits.length > 1 ? 'are' : 'is'} running low.
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={handleNavigateToExpenses}
                        className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1.5 shadow-sm"
                      >
                        Add Now
                        <ArrowRight size={12} />
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            <div className="p-8 text-center">
              <h3 className="text-base font-bold text-gray-400">No Vitamin Data Available</h3>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-xs rounded-xl shadow-2xl overflow-hidden">
                <div className="bg-gray-900 p-3 text-white flex justify-between items-center">
                    <h3 className="font-bold text-xs uppercase flex items-center gap-1.5"><Settings size={14}/> Config</h3>
                    <button onClick={() => setShowSettingsModal(false)} className="hover:bg-white/20 p-1 rounded-full"><X size={14}/></button>
                </div>
                <div className="p-4 space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Starting Population</label>
                        <input type="number" className="w-full p-2 border border-gray-300 rounded-md text-xs font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none" 
                            value={settings.population} onChange={(e) => setSettings({...settings, population: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Number of Pens</label>
                        <input type="number" className="w-full p-2 border border-gray-300 rounded-md text-xs font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none" 
                            value={settings.pens} onChange={(e) => setSettings({...settings, pens: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Avg Starting Weight (g)</label>
                        <input type="number" step="0.1" className="w-full p-2 border border-gray-300 rounded-md text-xs font-bold text-gray-800 focus:ring-1 focus:ring-orange-500 outline-none" 
                            value={settings.weight} onChange={(e) => setSettings({...settings, weight: e.target.value})} />
                    </div>
                    <button onClick={handleUpdateSettings} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors mt-2">
                        <Save size={14} /> Save
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* COMPARE MODAL */}
      {showCompareModal && previousBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-sm rounded-xl shadow-2xl overflow-hidden">
                <div className="bg-red-900 p-3 text-white flex justify-between items-center">
                  <h3 className="font-bold text-sm">Batch Comparison</h3>
                  <button onClick={() => setShowCompareModal(false)}><X size={16}/></button>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-3 text-[10px] font-bold text-gray-400 border-b pb-1.5 mb-2">
                      <span>Metric</span>
                      <span className="text-center">Current</span>
                      <span className="text-center">Previous</span>
                    </div>
                    <div className="space-y-3 text-xs">
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
                        <div className="grid grid-cols-3">
                          <span>Expenses</span>
                          <span className="text-center font-black">{formatCurrency(currentMetrics.expenses)}</span>
                          <span className="text-center">{formatCurrency(prevMetrics.expenses)}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span>Profit</span>
                          <span className="text-center font-black">{formatCurrency(currentMetrics.profit)}</span>
                          <span className="text-center">{formatCurrency(prevMetrics.profit)}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span>Mortality</span>
                          <span className="text-center font-black">{currentMetrics.mortality}</span>
                          <span className="text-center">{prevMetrics.mortality}</span>
                        </div>
                        <div className="grid grid-cols-3">
                          <span>Avg Weight</span>
                          <span className="text-center font-black">{currentMetrics.avgWeight}g</span>
                          <span className="text-center">{prevMetrics.avgWeight}g</span>
                        </div>
                    </div>
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-[9px] font-bold text-gray-500 mb-1">SUMMARY</p>
                      <p className="text-xs">
                        {currentMetrics.profit > prevMetrics.profit ? (
                          <span className="text-green-600 font-black">↑ Improved by {formatCurrency(currentMetrics.profit - prevMetrics.profit)}</span>
                        ) : currentMetrics.profit < prevMetrics.profit ? (
                          <span className="text-red-600 font-black">↓ Decreased by {formatCurrency(prevMetrics.profit - currentMetrics.profit)}</span>
                        ) : (
                          <span className="text-gray-600 font-black">Similar to last batch</span>
                        )}
                      </p>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// Vitamin Card Component
const VitaminCard = ({ vitamin, name, icon: Icon, color, nextBatchPop, onNavigate }) => {
  const getColorClasses = () => {
    if (vitamin.status === 'critical') {
      return {
        bg: 'bg-red-50',
        border: 'border-red-300',
        gradient: 'from-red-50 to-red-100',
        iconBg: 'bg-red-200',
        iconColor: 'text-red-700',
        progress: '#ef4444',
        button: 'bg-red-600 hover:bg-red-700',
        textColor: 'text-red-800',
        badge: 'bg-red-600'
      };
    }
    
    switch(color) {
      case 'blue': return {
        bg: 'bg-blue-50',
        border: 'border-blue-300',
        gradient: 'from-blue-50 to-blue-100',
        iconBg: vitamin.status === 'warning' ? 'bg-amber-200' : 'bg-blue-200',
        iconColor: vitamin.status === 'warning' ? 'text-amber-700' : 'text-blue-700',
        progress: vitamin.status === 'warning' ? '#f59e0b' : '#3b82f6',
        button: vitamin.status === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700',
        textColor: vitamin.status === 'warning' ? 'text-amber-800' : 'text-blue-800',
        badge: vitamin.status === 'warning' ? 'bg-amber-600' : 'bg-blue-600'
      };
      case 'purple': return {
        bg: 'bg-purple-50',
        border: 'border-purple-300',
        gradient: 'from-purple-50 to-purple-100',
        iconBg: vitamin.status === 'warning' ? 'bg-amber-200' : 'bg-purple-200',
        iconColor: vitamin.status === 'warning' ? 'text-amber-700' : 'text-purple-700',
        progress: vitamin.status === 'warning' ? '#f59e0b' : '#8b5cf6',
        button: vitamin.status === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700',
        textColor: vitamin.status === 'warning' ? 'text-amber-800' : 'text-purple-800',
        badge: vitamin.status === 'warning' ? 'bg-amber-600' : 'bg-purple-600'
      };
      case 'pink': return {
        bg: 'bg-pink-50',
        border: 'border-pink-300',
        gradient: 'from-pink-50 to-pink-100',
        iconBg: vitamin.status === 'warning' ? 'bg-amber-200' : 'bg-pink-200',
        iconColor: vitamin.status === 'warning' ? 'text-amber-700' : 'text-pink-700',
        progress: vitamin.status === 'warning' ? '#f59e0b' : '#ec4899',
        button: vitamin.status === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-pink-600 hover:bg-pink-700',
        textColor: vitamin.status === 'warning' ? 'text-amber-800' : 'text-pink-800',
        badge: vitamin.status === 'warning' ? 'bg-amber-600' : 'bg-pink-600'
      };
      case 'orange': return {
        bg: 'bg-orange-50',
        border: 'border-orange-300',
        gradient: 'from-orange-50 to-orange-100',
        iconBg: vitamin.status === 'warning' ? 'bg-amber-200' : 'bg-orange-200',
        iconColor: vitamin.status === 'warning' ? 'text-amber-700' : 'text-orange-700',
        progress: vitamin.status === 'warning' ? '#f59e0b' : '#f97316',
        button: vitamin.status === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-orange-600 hover:bg-orange-700',
        textColor: vitamin.status === 'warning' ? 'text-amber-800' : 'text-orange-800',
        badge: vitamin.status === 'warning' ? 'bg-amber-600' : 'bg-orange-600'
      };
      case 'gray': return {
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        gradient: 'from-gray-50 to-gray-100',
        iconBg: vitamin.status === 'warning' ? 'bg-amber-200' : 'bg-gray-200',
        iconColor: vitamin.status === 'warning' ? 'text-amber-700' : 'text-gray-700',
        progress: vitamin.status === 'warning' ? '#f59e0b' : '#6b7280',
        button: vitamin.status === 'warning' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-gray-600 hover:bg-gray-700',
        textColor: vitamin.status === 'warning' ? 'text-amber-800' : 'text-gray-800',
        badge: vitamin.status === 'warning' ? 'bg-amber-600' : 'bg-gray-600'
      };
      default: return {
        bg: 'bg-gray-50',
        border: 'border-gray-300',
        gradient: 'from-gray-50 to-gray-100',
        iconBg: 'bg-gray-200',
        iconColor: 'text-gray-700',
        progress: '#6b7280',
        button: 'bg-gray-600 hover:bg-gray-700',
        textColor: 'text-gray-800',
        badge: 'bg-gray-600'
      };
    }
  };

  const colors = getColorClasses();
  const nextBatchPrediction = (vitamin.dosagePerBird * nextBatchPop).toFixed(1);
  
  const getStatusBadge = () => {
    switch(vitamin.status) {
      case 'critical': return 'CRITICAL';
      case 'warning': return 'WARN';
      case 'excess': return 'SURPLUS';
      case 'good': return 'GOOD';
      default: return 'OK';
    }
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
      vitamin.status === 'critical' ? 'border-red-400 shadow-md shadow-red-100' : 
      vitamin.status === 'warning' ? 'border-amber-400' : 
      `border-${colors.border}`
    } bg-gradient-to-br ${colors.gradient}`}>
      <div className={`absolute top-2 right-2 ${vitamin.status === 'critical' ? 'bg-red-600' : colors.badge} text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider`}>
        {getStatusBadge()}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className={`p-1.5 rounded-lg ${colors.iconBg}`}>
            <Icon size={16} className={colors.iconColor} />
          </div>
          <div>
            <h4 className={`font-black text-xs ${colors.textColor}`}>{name}</h4>
            <p className="text-[9px] text-gray-500">Need/bird: {vitamin.dosagePerBird.toFixed(3)} {vitamin.unit}</p>
          </div>
        </div>

        <div className="flex items-center justify-between mb-3">
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle cx="24" cy="24" r="20" stroke="#e5e7eb" strokeWidth="4" fill="none" />
              <circle
                cx="24"
                cy="24"
                r="20"
                stroke={colors.progress}
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 20}`}
                strokeDashoffset={`${2 * Math.PI * 20 * (1 - vitamin.percentage / 100)}`}
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black">{Math.round(vitamin.percentage)}%</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-gray-800">{vitamin.used.toFixed(1)}<span className="text-[9px] font-normal text-gray-500 ml-0.5">{vitamin.unit}</span></p>
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">of {vitamin.required.toFixed(1)} req.</p>
          </div>
        </div>

        <div className={`p-2 rounded-lg mb-2 ${
          vitamin.status === 'critical' ? 'bg-red-200/70 border border-red-300' :
          vitamin.status === 'warning' ? 'bg-amber-200/70 border border-amber-300' :
          vitamin.status === 'excess' ? 'bg-blue-200/70 border border-blue-300' :
          'bg-green-200/70 border border-green-300'
        }`}>
          <div className="flex items-start gap-1.5">
            {vitamin.status === 'critical' && <AlertTriangle size={12} className="text-red-600 flex-shrink-0 mt-0.5" />}
            {vitamin.status === 'warning' && <AlertTriangle size={12} className="text-amber-600 flex-shrink-0 mt-0.5" />}
            {vitamin.status === 'good' && <CheckCircle size={12} className="text-green-600 flex-shrink-0 mt-0.5" />}
            {vitamin.status === 'excess' && <CheckCircle size={12} className="text-blue-600 flex-shrink-0 mt-0.5" />}
            <p className={`text-[9px] font-bold leading-tight ${
              vitamin.status === 'critical' ? 'text-red-700' :
              vitamin.status === 'warning' ? 'text-amber-700' :
              vitamin.status === 'excess' ? 'text-blue-700' :
              'text-green-700'
            }`}>
              {vitamin.message}
            </p>
          </div>
        </div>

        <div className="mt-1 mb-2 bg-white/80 p-1.5 rounded-md border border-gray-200">
            <div className="flex justify-between items-center text-[9px]">
                <span className="text-gray-500 font-bold uppercase tracking-wide">Next ({nextBatchPop} hd)</span>
                <span className={`font-black ${vitamin.status === 'critical' ? 'text-red-600' : 'text-gray-800'}`}>
                  {nextBatchPrediction} {vitamin.unit}
                </span>
            </div>
            <div className="w-full bg-gray-200 h-1 mt-1 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${
                    vitamin.status === 'critical' ? 'bg-red-500' :
                    vitamin.status === 'warning' ? 'bg-amber-500' :
                    'bg-gray-400'
                  }`} 
                  style={{ width: '100%' }}
                ></div>
            </div>
        </div>

        <button 
          onClick={onNavigate}
          className={`w-full ${colors.button} text-white py-1.5 rounded-md text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-sm`}
        >
          <Plus size={12} />
          {vitamin.status === 'critical' ? 'ADD NOW' : 'Add More'}
        </button>
      </div>
    </div>
  );
};

export default RealDashboard;