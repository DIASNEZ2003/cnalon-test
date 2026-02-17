import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, User, Package, Pill, HeartPulse, Scale, ClipboardList, Layers, Banknote, 
  TrendingUp, TrendingDown, Users, CheckCircle, Database, Wallet, Filter, Calendar
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
            (u.firstName || "").toLowerCase() === name.toLowerCase() || 
            (u.username || "").toLowerCase() === name.toLowerCase() ||
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
            ? Object.values(rawBatches || {}) 
            : Object.values(rawBatches || {}).filter(b => b.batchName === selectedBatch);

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
        const searchStr = ((r.batchName || "") + (r.subtitle || "") + (r.user || "") + (r.type || "")).toLowerCase();
        return matchesType && matchesBatch && searchStr.includes(searchQuery.toLowerCase());
    });

    if (loading) return <div className="p-10 font-black text-[#3B0A0A] text-xl tracking-widest animate-pulse uppercase">Syncing Records...</div>;

    return (
        <div className="bg-gray-50 h-full w-full p-6 animate-fade-in font-sans text-gray-800">
            
            {/* --- TOP HEADER & SEARCH BAR --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4 flex-1">
                    <div className="p-2.5 bg-red-50 rounded-xl">
                        <ClipboardList size={22} className="text-[#3B0A0A]" />
                    </div>
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search historical logs..." 
                            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-900 outline-none text-xs transition-all font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                        <Filter size={14} className="text-gray-400" />
                        <select 
                            className="bg-transparent text-[11px] font-bold outline-none cursor-pointer" 
                            value={selectedBatch} 
                            onChange={(e) => setSelectedBatch(e.target.value)}
                        >
                            {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                        <Layers size={14} className="text-gray-400" />
                        <select 
                            className="bg-transparent text-[11px] font-bold outline-none cursor-pointer"
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                        >
                            {FILTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
                
                {/* --- MAIN DATA TABLE --- */}
                <div className="xl:col-span-3 space-y-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50/50 border-b border-gray-100">
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Entry Details</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Category</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Performed By</th>
                                        <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {filteredData.length === 0 ? (
                                        <tr><td colSpan="4" className="py-20 text-center text-gray-300 text-xs font-medium uppercase tracking-widest">No matching history found</td></tr>
                                    ) : filteredData.map((item) => {
                                        const userImg = getUserProfileImage(item.user);
                                        return (
                                            <tr key={item.id} className="hover:bg-gray-50/40 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-col">
                                                        <span className="text-[10px] text-red-900 font-bold uppercase tracking-wider mb-0.5">{item.batchName}</span>
                                                        <span className="text-sm font-black text-gray-800 tracking-tight uppercase">{item.subtitle}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${
                                                        item.type === 'Sales' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
                                                    }`}>
                                                        {item.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center">
                                                            {userImg ? <img src={userImg} className="w-full h-full object-cover" /> : <User size={14} className="text-gray-400" />}
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-600">@{item.user}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase">{item.date}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* --- ANALYTICS SIDEBAR --- */}
                <div className="xl:col-span-1">
                    <div className="sticky top-6 space-y-6">
                        <div className="bg-[#3B0A0A] p-6 rounded-[32px] shadow-2xl text-white border border-white/5 relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-1 text-orange-400 uppercase font-black text-[9px] tracking-widest">
                                    <TrendingUp size={12}/> Analysis
                                </div>
                                <h1 className="text-xl font-black mb-6 tracking-tighter uppercase">{selectedBatch}</h1>
                                
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                        <div className="flex items-center gap-2"><TrendingUp size={16} className="text-emerald-400"/> <span className="text-[10px] font-bold text-gray-400 uppercase">Revenue</span></div>
                                        <span className="text-base font-black text-emerald-400">₱{batchStats.sales.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/5 pb-2">
                                        <div className="flex items-center gap-2"><TrendingDown size={16} className="text-rose-400"/> <span className="text-[10px] font-bold text-gray-400 uppercase">Cost</span></div>
                                        <span className="text-base font-black text-rose-400">₱{batchStats.expenses.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                        <div className="flex items-center gap-2"><Wallet size={16} className="text-orange-400"/> <span className="text-[10px] font-bold text-gray-400 uppercase">Net Profit</span></div>
                                        <span className="text-lg font-black text-white">₱{batchStats.profit.toLocaleString()}</span>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                            <Database size={14} className="text-orange-300 mb-1"/>
                                            <p className="text-[8px] font-black text-gray-500 uppercase">Feeds</p>
                                            <p className="text-xs font-black">{batchStats.feed.toFixed(1)}kg</p>
                                        </div>
                                        <div className="bg-white/5 p-3 rounded-2xl border border-white/10 flex flex-col items-center text-center">
                                            <HeartPulse size={14} className="text-red-400 mb-1"/>
                                            <p className="text-[8px] font-black text-gray-500 uppercase">Deaths</p>
                                            <p className="text-xs font-black text-red-400">{batchStats.mort}</p>
                                        </div>
                                    </div>

                                    <div className="mt-4 bg-orange-500/10 p-4 rounded-3xl border border-orange-500/20 text-center">
                                        <Users size={20} className="mx-auto text-orange-400 mb-1"/>
                                        <p className="text-[9px] font-black text-orange-200 uppercase tracking-widest">Total Stocking</p>
                                        <p className="text-2xl font-black text-white">{batchStats.startPop}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>{`
                @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default Records;