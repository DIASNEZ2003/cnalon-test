import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Search, User, Package, Pill, HeartPulse, Scale, FileText, 
  TrendingUp, TrendingDown, Users, Database, Wallet, Filter, Download, DollarSign
} from 'lucide-react';
import { auth, db } from '../firebase'; 
import { ref, onValue } from 'firebase/database';
import { onAuthStateChanged } from "firebase/auth";
import * as XLSX from 'xlsx'; 

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
        
        // This filters the stats to ONLY show the currently selected batch
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

    const handleExportExcel = () => {
        // This ensures the Excel file ONLY contains the batch selected in the dropdown!
        const targetBatches = selectedBatch === "All Batches" 
            ? Object.values(rawBatches || {}) 
            : Object.values(rawBatches || {}).filter(b => b.batchName === selectedBatch);

        const feedsData = [];
        const vitaminsData = [];
        const mortalityData = [];
        const expensesData = [];
        const salesData = [];

        targetBatches.forEach(batch => {
            const bName = batch.batchName || "Unknown Batch";
            if (batch.feed_logs) Object.entries(batch.feed_logs).forEach(([date, log]) => feedsData.push({ "Batch": bName, "Date": date, "AM (kg)": Number(log.am || 0), "PM (kg)": Number(log.pm || 0), "Total (kg)": Number(log.am || 0) + Number(log.pm || 0), "Updated By": log.updaterName || "System" }));
            if (batch.daily_vitamin_logs) Object.entries(batch.daily_vitamin_logs).forEach(([date, log]) => vitaminsData.push({ "Batch": bName, "Date": date, "AM Dose": Number(log.am_amount || 0), "PM Dose": Number(log.pm_amount || 0), "Total Dose": Number(log.am_amount || 0) + Number(log.pm_amount || 0), "Updated By": log.updaterName || "System" }));
            if (batch.mortality_logs) Object.entries(batch.mortality_logs).forEach(([date, log]) => mortalityData.push({ "Batch": bName, "Date": date, "AM Deaths": Number(log.am || 0), "PM Deaths": Number(log.pm || 0), "Total Deaths": Number(log.am || 0) + Number(log.pm || 0), "Updated By": log.updaterName || "System" }));
            if (batch.expenses) Object.values(batch.expenses).forEach(exp => expensesData.push({ "Batch": bName, "Date": exp.date || "", "Category": exp.category || "", "Item Description": exp.itemName || exp.description || "", "Quantity": Number(exp.quantity || 0), "Amount (PHP)": Number(exp.amount || 0) }));
            if (batch.sales) Object.values(batch.sales).forEach(sale => salesData.push({ "Batch": bName, "Date": sale.dateOfPurchase || "", "Buyer Name": sale.buyerName || "", "Heads Sold": Number(sale.quantity || 0), "Total Amount (PHP)": Number(sale.totalAmount || 0) }));
        });

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(feedsData.length ? feedsData : [{Message: "No Data"}]), "Feeds");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vitaminsData.length ? vitaminsData : [{Message: "No Data"}]), "Vitamins");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mortalityData.length ? mortalityData : [{Message: "No Data"}]), "Mortality");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expensesData.length ? expensesData : [{Message: "No Data"}]), "Expenses");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(salesData.length ? salesData : [{Message: "No Data"}]), "Sales");

        XLSX.writeFile(wb, `Farm_Records_${selectedBatch === "All Batches" ? "All" : selectedBatch.replace(/\s+/g, '_')}.xlsx`);
    };

    const getTypeStyles = (type) => {
        switch(type) {
            case 'Feed': return { icon: Package, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100' };
            case 'Vitamins': return { icon: Pill, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' };
            case 'Mortality': return { icon: HeartPulse, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' };
            case 'Weight': return { icon: Scale, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' };
            case 'Sales': return { icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
            default: return { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50', border: 'border-gray-100' };
        }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50">
            <div className="w-8 h-8 border-4 border-red-900 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="font-bold text-[#3B0A0A] text-xs tracking-widest uppercase animate-pulse">Syncing Records...</p>
        </div>
    );

    return (
        <div className="bg-gray-50 min-h-full w-full p-3 md:p-4 animate-fade-in font-sans text-gray-800 flex flex-col gap-4">

            {/* --- COMPACT TOP ANALYTICS CARDS (6 CARDS) --- */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="p-1 bg-emerald-50 rounded-md text-emerald-600"><TrendingUp size={12}/></div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Revenue</span>
                    </div>
                    <span className="text-base font-black text-gray-800">₱{batchStats.sales.toLocaleString()}</span>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="p-1 bg-rose-50 rounded-md text-rose-600"><TrendingDown size={12}/></div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Expenses</span>
                    </div>
                    <span className="text-base font-black text-gray-800">₱{batchStats.expenses.toLocaleString()}</span>
                </div>
                
                {/* NET PROFIT CARD */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="p-1 bg-blue-50 rounded-md text-blue-600"><Wallet size={12}/></div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Net Profit</span>
                    </div>
                    <span className={`text-base font-black ${batchStats.profit >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                        ₱{batchStats.profit.toLocaleString()}
                    </span>
                </div>

                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="p-1 bg-orange-50 rounded-md text-orange-600"><Database size={12}/></div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Feeds</span>
                    </div>
                    <span className="text-base font-black text-gray-800">{batchStats.feed.toFixed(1)} <span className="text-[10px] font-medium text-gray-400">kg</span></span>
                </div>
                {/* VITAMINS CARD */}
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="p-1 bg-purple-50 rounded-md text-purple-600"><Pill size={12}/></div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Vitamins</span>
                    </div>
                    <span className="text-base font-black text-gray-800">{batchStats.vits.toFixed(1)} <span className="text-[10px] font-medium text-gray-400">dose</span></span>
                </div>
                <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="p-1 bg-red-50 rounded-md text-red-600"><HeartPulse size={12}/></div>
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Mortality</span>
                    </div>
                    <span className="text-base font-black text-gray-800">{batchStats.mort} <span className="text-[10px] font-medium text-gray-400">heads</span></span>
                </div>
            </div>

            {/* --- COMPACT CONTROLS / FILTERS --- */}
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row gap-3">
                    {/* Search Bar */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input 
                            type="text" 
                            placeholder="Search records by batch, category, or user..." 
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg focus:ring-1 focus:ring-red-900 outline-none text-xs transition-all font-bold text-gray-700"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    {/* Batch Dropdown */}
                    <div className="relative md:w-48 flex-shrink-0">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <select 
                            className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-lg focus:ring-1 focus:ring-red-900 outline-none text-xs transition-all font-bold text-gray-700 appearance-none cursor-pointer" 
                            value={selectedBatch} 
                            onChange={(e) => setSelectedBatch(e.target.value)}
                        >
                            {batchOptions.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 text-[10px]">▼</div>
                    </div>
                    {/* EXCEL EXPORT BUTTON */}
                    <button 
                        onClick={handleExportExcel}
                        className="flex items-center justify-center gap-1.5 bg-[#107c41] hover:bg-[#0c5e31] text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95 flex-shrink-0"
                    >
                        <Download size={14} /> Export Excel
                    </button>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mr-1 flex-shrink-0">Cat:</span>
                    {FILTER_TYPES.map(type => (
                        <button
                            key={type}
                            onClick={() => setFilterType(type)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-all duration-200 border flex-shrink-0 ${
                                filterType === type 
                                ? 'bg-[#3B0A0A] text-white border-[#3B0A0A] shadow-sm' 
                                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
                            }`}
                        >
                            {type}
                        </button>
                    ))}
                </div>
            </div>

            {/* --- COMPACT DATA TABLE --- */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex-1 overflow-hidden flex flex-col min-h-[300px]">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white shadow-sm z-10">
                            <tr className="bg-gray-50/80 border-b border-gray-100">
                                <th className="px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest w-1/3">Entry Details</th>
                                <th className="px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Category</th>
                                <th className="px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest">Recorded By</th>
                                <th className="px-4 py-2.5 text-[9px] font-bold text-gray-400 uppercase tracking-widest text-right">Date Logged</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="py-16 text-center">
                                        <FileText size={32} className="mx-auto text-gray-200 mb-2" />
                                        <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">No matching records found</p>
                                    </td>
                                </tr>
                            ) : filteredData.map((item) => {
                                const userImg = getUserProfileImage(item.user);
                                const style = getTypeStyles(item.type);
                                const Icon = style.icon || FileText;

                                return (
                                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors group">
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${style.bg} ${style.color} ${style.border}`}>
                                                    <Icon size={14} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">{item.batchName}</span>
                                                    <span className="text-xs font-black text-gray-800 tracking-tight">{item.subtitle}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider border ${style.bg} ${style.color} ${style.border}`}>
                                                {item.type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden border border-gray-200 flex items-center justify-center flex-shrink-0">
                                                    {userImg ? <img src={userImg} className="w-full h-full object-cover" alt="User" /> : <User size={10} className="text-gray-400" />}
                                                </div>
                                                <span className="text-[10px] font-bold text-gray-600">@{item.user}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 text-right">
                                            <span className="text-[10px] font-bold text-gray-800">
                                                {item.date}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
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