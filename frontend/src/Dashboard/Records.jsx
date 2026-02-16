import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, User, Package, Pill, HeartPulse, Scale, ClipboardList, Layers, Banknote, 
  TrendingUp, TrendingDown, Users, CheckCircle, Database, Wallet
} from 'lucide-react';
import { auth, db } from '../firebase'; 
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged } from "firebase/auth";

const Records = () => {
    const [loading, setLoading] = useState(true);
    const [rawBatches, setRawBatches] = useState({});
    const [allUsers, setAllUsers] = useState([]); 
    const [filterType, setFilterType] = useState("All");
    const [selectedBatch, setSelectedBatch] = useState("All Batches");
    const [searchQuery, setSearchQuery] = useState("");
    const isMounted = useRef(true);

    const FILTER_TYPES = ["All", "Feed", "Vitamins", "Mortality", "Weight", "Sales"];

    useEffect(() => {
        isMounted.current = true;
        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const batchesRef = ref(db, 'global_batches');
                onValue(batchesRef, (snapshot) => {
                    if (isMounted.current) {
                        setRawBatches(snapshot.exists() ? snapshot.val() : {});
                        setLoading(false);
                    }
                });

                const usersRef = ref(db, 'users');
                onValue(usersRef, (snapshot) => {
                    if (isMounted.current && snapshot.exists()) {
                        const data = snapshot.val();
                        setAllUsers(Object.keys(data).map(uid => ({ uid, ...data[uid] })));
                    }
                });
            } else {
                if (isMounted.current) setLoading(false);
            }
        });
        return () => { isMounted.current = false; unsubscribeAuth(); };
    }, []);

    const getUserProfileImage = (name) => {
        if (!name) return null;
        const found = allUsers.find(u => 
            u.firstName?.toLowerCase() === name.toLowerCase() || 
            u.username?.toLowerCase() === name.toLowerCase() ||
            (name.toLowerCase() === "admin" && u.role === "admin")
        );
        return found?.profileImage || found?.profilePicture || null;
    };

    const batchOptions = useMemo(() => {
        const names = Object.values(rawBatches || {}).map(b => b.batchName).filter(Boolean);
        return ["All Batches", ...names];
    }, [rawBatches]);

    const batchStats = useMemo(() => {
        let sales = 0, expenses = 0, feed = 0, vits = 0, mort = 0, harvested = 0, startPop = 0;
        const targetBatches = selectedBatch === "All Batches" 
            ? Object.values(rawBatches) 
            : Object.values(rawBatches).filter(b => b.batchName === selectedBatch);

        targetBatches.forEach(b => {
            startPop += Number(b.startingPopulation || 0);
            if (b.sales) Object.values(b.sales).forEach(s => { sales += Number(s.totalAmount || 0); harvested += Number(s.quantity || 0); });
            if (b.expenses) Object.values(b.expenses).forEach(e => expenses += Number(e.amount || 0));
            if (b.feed_logs) Object.values(b.feed_logs).forEach(f => feed += (Number(f.am || 0) + Number(f.pm || 0)));
            if (b.daily_vitamin_logs) Object.values(b.daily_vitamin_logs).forEach(v => vits += (Number(v.am_amount || 0) + Number(v.pm_amount || 0)));
            if (b.mortality_logs) Object.values(b.mortality_logs).forEach(m => mort += (Number(m.am || 0) + Number(m.pm || 0)));
        });
        return { sales, expenses, profit: sales - expenses, feed, vits, mort, harvested, startPop };
    }, [rawBatches, selectedBatch]);

    const allRecords = useMemo(() => {
        const flattened = [];
        Object.entries(rawBatches || {}).forEach(([batchId, batch]) => {
            const batchName = batch.batchName || "Batch";
            const forecast = batch.feedForecast || [];

            if (batch.feed_logs) {
                Object.entries(batch.feed_logs).forEach(([date, log]) => {
                    let typeLabel = "Feed";
                    const dayNum = Math.round((new Date(date) - new Date(batch.dateCreated)) / 86400000) + 1;
                    const match = forecast.find(f => f.day === dayNum);
                    if (match) typeLabel = match.feedType;
                    flattened.push({ id: `f-${batchId}-${date}`, type: 'Feed', feedLabel: typeLabel, batchName, date, timestamp: log.timestamp || 0, subtitle: `${typeLabel}: ${Number(log.am || 0) + Number(log.pm || 0)} kg`, user: log.updaterName || "System" });
                });
            }
            if (batch.mortality_logs) {
                Object.entries(batch.mortality_logs).forEach(([date, log]) => {
                    flattened.push({ id: `m-${batchId}-${date}`, type: 'Mortality', batchName, date, timestamp: log.timestamp || 0, subtitle: `Mortality: ${Number(log.am || 0) + Number(log.pm || 0)} heads`, user: log.updaterName || "System" });
                });
            }
            if (batch.daily_vitamin_logs) {
                Object.entries(batch.daily_vitamin_logs).forEach(([date, log]) => {
                    flattened.push({ id: `v-${batchId}-${date}`, type: 'Vitamins', batchName, date, timestamp: log.timestamp || 0, subtitle: `Supplement: ${Number(log.am_amount || 0) + Number(log.pm_amount || 0)} dose`, user: log.updaterName || "System" });
                });
            }
            if (batch.weight_logs) {
                Object.entries(batch.weight_logs).forEach(([date, log]) => {
                    flattened.push({ id: `w-${batchId}-${date}`, type: 'Weight', batchName, date, timestamp: log.timestamp || 0, subtitle: `Avg Weight: ${log.averageWeight}${log.unit || 'g'}`, user: log.updaterName || "System" });
                });
            }
            if (batch.sales) {
                Object.entries(batch.sales).forEach(([sId, s]) => {
                    flattened.push({ id: `s-${batchId}-${sId}`, type: 'Sales', batchName, date: s.dateOfPurchase, timestamp: s.timestamp || 0, subtitle: `Sold ${s.quantity} heads - ₱${s.totalAmount?.toLocaleString()}`, user: "Admin" });
                });
            }
        });
        return flattened.sort((a, b) => b.timestamp - a.timestamp);
    }, [rawBatches]);

    const filteredData = allRecords.filter(r => {
        const matchesType = filterType === "All" || r.type === filterType;
        const matchesBatch = selectedBatch === "All Batches" || r.batchName === selectedBatch;
        const searchStr = (r.batchName + r.subtitle + r.user + r.type).toLowerCase();
        return matchesType && matchesBatch && searchStr.includes(searchQuery.toLowerCase());
    });

    if (loading) return <div className="p-10 font-black text-red-900 text-xl tracking-widest animate-pulse">SYNCING RECORDS...</div>;

    return (
        <div className="flex flex-col lg:flex-row gap-6 mx-0 max-w-[1400px] animate-fade-in p-4">
            
            {/* LEFT SIDE: LOGS (STAYS BIG) */}
            <div className="flex-1">
                <div className="mb-6 space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-4 top-4 text-gray-400" size={22} />
                            <input 
                                type="text" placeholder="Search history..."
                                className="w-full rounded-2xl border-2 border-gray-100 bg-white py-4 pl-14 pr-4 text-lg font-bold outline-none focus:border-red-900 shadow-sm"
                                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <select 
                                value={selectedBatch}
                                onChange={(e) => setSelectedBatch(e.target.value)}
                                className="appearance-none bg-white border-2 border-gray-100 text-gray-700 font-black text-sm rounded-2xl py-4 pl-6 pr-12 outline-none focus:border-red-900 shadow-sm cursor-pointer"
                            >
                                {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
                        {FILTER_TYPES.map((type) => (
                            <button key={type} onClick={() => setFilterType(type)} className={`rounded-xl px-8 py-3 text-sm font-black uppercase border transition-all ${filterType === type ? 'bg-red-900 text-white border-red-900 shadow-lg scale-105' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>{type}</button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {filteredData.map((item) => {
                        const userImg = getUserProfileImage(item.user);
                        return (
                            <div key={item.id} className="flex items-center rounded-[32px] border border-gray-100 bg-white p-5 shadow-sm hover:border-red-200 transition-all group">
                                <div className="mr-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gray-50 border border-gray-100">
                                    {item.type === 'Feed' && <Package size={28} className="text-orange-600" />}
                                    {item.type === 'Vitamins' && <Pill size={28} className="text-blue-600" />}
                                    {item.type === 'Mortality' && <HeartPulse size={28} className="text-red-600" />}
                                    {item.type === 'Weight' && <Scale size={28} className="text-purple-600" />}
                                    {item.type === 'Sales' && <Banknote size={28} className="text-emerald-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-black uppercase text-gray-400 tracking-widest">{item.date}</span>
                                        <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase ${item.type === 'Sales' ? 'text-emerald-700 bg-emerald-50' : 'text-red-900 bg-red-50'}`}>{item.type}</span>
                                    </div>
                                    <h3 className="truncate text-lg font-black text-gray-800 uppercase tracking-tight leading-none mb-1">{item.batchName}</h3>
                                    <p className="truncate text-base font-bold text-gray-500">{item.subtitle}</p>
                                </div>
                                <div className="ml-6 shrink-0 flex items-center gap-3 px-4 py-2 rounded-2xl bg-gray-50 border border-gray-100 transition-all">
                                    <div className="w-10 h-10 rounded-full bg-white overflow-hidden border-2 border-white shadow-md flex items-center justify-center">
                                        {userImg ? <img src={userImg} className="w-full h-full object-cover" /> : <User size={20} className="text-gray-300" />}
                                    </div>
                                    <span className="text-xs font-black text-gray-600 tracking-tight">@{item.user}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* RIGHT SIDE: ANALYTICS (CORNER ALIGNED & SMALLER) */}
            <div className="w-full lg:w-72 shrink-0">
                <div className="sticky top-4 space-y-4">
                    <div className="bg-[#3B0A0A] p-6 rounded-[35px] shadow-2xl text-white border border-white/5 relative overflow-hidden">
                        <div className="relative z-10">
                            <h2 className="text-[9px] font-black uppercase text-orange-400 tracking-[3px] mb-1">{selectedBatch}</h2>
                            <h1 className="text-xl font-black mb-6 tracking-tighter">Quick Stats</h1>
                            
                            <div className="space-y-4">
                                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400"/> <span className="text-[10px] font-bold text-gray-400 uppercase">Sales</span></div>
                                    <span className="text-base font-black text-emerald-400">₱{batchStats.sales.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                    <div className="flex items-center gap-2"><TrendingDown size={16} className="text-rose-400"/> <span className="text-[10px] font-bold text-gray-400 uppercase">Expenses</span></div>
                                    <span className="text-base font-black text-rose-400">₱{batchStats.expenses.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                    <div className="flex items-center gap-2"><Wallet size={16} className="text-orange-400"/> <span className="text-[10px] font-bold text-gray-400 uppercase">Profit</span></div>
                                    <span className="text-lg font-black text-white">₱{batchStats.profit.toLocaleString()}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                        <Database size={14} className="text-orange-300 mb-1"/>
                                        <p className="text-[8px] font-black text-gray-500 uppercase">Feeds</p>
                                        <p className="text-xs font-black">{batchStats.feed.toFixed(1)}kg</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                        <Pill size={14} className="text-blue-300 mb-1"/>
                                        <p className="text-[8px] font-black text-gray-500 uppercase">Vitamins</p>
                                        <p className="text-xs font-black">{batchStats.vits.toFixed(1)}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                        <HeartPulse size={14} className="text-red-400 mb-1"/>
                                        <p className="text-[8px] font-black text-gray-500 uppercase">Mortality</p>
                                        <p className="text-xs font-black text-red-400">{batchStats.mort}</p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                        <CheckCircle size={14} className="text-emerald-400 mb-1"/>
                                        <p className="text-[8px] font-black text-gray-500 uppercase">Harvest</p>
                                        <p className="text-xs font-black">{batchStats.harvested}</p>
                                    </div>
                                </div>

                                <div className="mt-4 bg-orange-500/10 p-4 rounded-3xl border border-orange-500/20 text-center">
                                    <Users size={20} className="mx-auto text-orange-400 mb-1"/>
                                    <p className="text-[9px] font-black text-orange-200 uppercase tracking-widest">Starting Pop.</p>
                                    <p className="text-2xl font-black text-white">{batchStats.startPop}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{` .no-scrollbar::-webkit-scrollbar { display: none; } `}</style>
        </div>
    );
};

export default Records;