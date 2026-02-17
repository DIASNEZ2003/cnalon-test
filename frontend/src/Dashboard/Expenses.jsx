import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  ShoppingBag, Calendar, DollarSign, Tag, 
  FileText, Hash, Edit2, Trash2, PlusCircle, 
  Check, AlertTriangle, Layers, User, Banknote, Package, Search, X, Filter
} from 'lucide-react';

// --- SUCCESS MODAL ---
const SuccessModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-center z-[140] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 text-center border border-gray-100">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-50 mb-4 border border-green-100">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-black text-gray-800 mb-1">SUCCESS</h3>
        <p className="text-xs text-gray-500 mb-6 font-medium">{message}</p>
        <button onClick={onClose} className="w-full bg-[#3B0A0A] text-white font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all active:scale-95">CONTINUE</button>
      </div>
    </div>
  );
};

// --- CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  let title = type === 'create' ? "Save Expense?" : "Delete Record?";
  let buttonColor = type === 'create' ? "bg-green-600" : "bg-red-600"; 
  let icon = type === 'create' ? <Check className="h-6 w-6 text-green-600" /> : <Trash2 className="h-6 w-6 text-red-600" />;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs border border-gray-100 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-50 mb-3 border">{icon}</div>
        <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">{title}</h3>
        <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">Please verify the details before proceeding.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-[10px] uppercase">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase shadow-lg ${buttonColor}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- FEED TYPE MODAL ---
const FeedTypeModal = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[160] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs text-center border border-gray-100 animate-fade-in">
        <h3 className="text-sm font-black text-gray-900 mb-4 uppercase tracking-tighter">Select Feed Stage</h3>
        <div className="flex flex-col gap-2">
          {['Booster', 'Starter', 'Finisher'].map((type) => (
            <button key={type} onClick={() => onSelect(type)} className="w-full py-3 rounded-xl font-bold text-white bg-[#3B0A0A] hover:bg-red-900 transition text-[10px] uppercase tracking-widest">{type}</button>
          ))}
          <button onClick={onClose} className="mt-2 text-[10px] font-bold text-gray-400 hover:text-gray-700 uppercase tracking-widest">Cancel</button>
        </div>
      </div>
    </div>
  );
};

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [systemUsers, setSystemUsers] = useState([]); 
  const [personnelList, setPersonnelList] = useState([]); 
  const [activeBatchId, setActiveBatchId] = useState(null); 
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [feedModal, setFeedModal] = useState({ isOpen: false, targetId: null });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(null);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [formData, setFormData] = useState({ 
    category: 'Feeds', itemName: '', amount: '', count: '1', unitValue: '50', suffix: 'kgs', date: new Date().toISOString().split('T')[0] 
  });

  const backendUrl = "http://localhost:8000";

  const fetchStaffData = async (token) => {
    try {
      const userRes = await fetch(`${backendUrl}/get-users`, { headers: { "Authorization": `Bearer ${token}` }});
      if (userRes.ok) setSystemUsers(await userRes.json());
      const personnelRes = await fetch(`${backendUrl}/get-personnel`, { headers: { "Authorization": `Bearer ${token}` }});
      if (personnelRes.ok) setPersonnelList(await personnelRes.json());
    } catch (err) { console.error(err); }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      fetchStaffData(token);
      const batchRes = await fetch(`${backendUrl}/get-batches`, { headers: { "Authorization": `Bearer ${token}` }});
      if (batchRes.ok) {
        const batches = await batchRes.json();
        const active = batches.find(b => b.status === 'active');
        if (active) {
          setActiveBatchId(active.id);
          const expRes = await fetch(`${backendUrl}/get-expenses/${active.id}`, { headers: { "Authorization": `Bearer ${token}` }});
          if (expRes.ok) setExpenses(await expRes.json());
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => { if (user) fetchData(); else setLoading(false); });
    return () => unsubscribe();
  }, []);

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    let newSuffix = 'kgs';
    let defaultSize = '50';
    if (newCat === 'Vitamins') { newSuffix = 'g'; defaultSize = '100'; }
    else if (newCat === 'Items') { newSuffix = 'pcs'; defaultSize = '1'; }
    else if (newCat === 'Salary') { newSuffix = 'month'; defaultSize = '1'; }
    setFormData({ ...formData, category: newCat, suffix: newSuffix, unitValue: defaultSize, itemName: '' });
  };

  const handleAction = async () => {
    const { type, targetId } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, targetId: null });
    if (!activeBatchId && type === 'create') return;

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      const pCount = parseFloat(formData.count) || 1;
      const uSize = parseFloat(formData.unitValue) || 1;
      const totalQuantity = pCount * uSize;
      
      if (type === 'create') {
        const url = editMode ? `${backendUrl}/edit-expense` : `${backendUrl}/add-expense`;
        const method = editMode ? "PUT" : "POST";
        const body = {
           batchId: activeBatchId,
           category: formData.category,
           feedType: formData.category === 'Feeds' ? formData.feedType : null,
           itemName: formData.itemName,
           amount: parseFloat(formData.amount),
           date: formData.date,
           quantity: totalQuantity,
           purchaseCount: pCount,
           unit: formData.suffix 
        };
        if(editMode) body.expenseId = editMode;
        const response = await fetch(url, {
          method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body)
        });
        if (response.ok) {
          setSuccessMessage(editMode ? "Record Updated!" : "Expense Logged!");
          setFormData({ category: 'Feeds', itemName: '', amount: '', count: '1', unitValue: '50', suffix: 'kgs', date: new Date().toISOString().split('T')[0] });
          setEditMode(null); setIsFormOpen(false); fetchData();
        }
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-expense/${activeBatchId}/${targetId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }});
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const startEdit = (item) => {
    setEditMode(item.id);
    const count = parseFloat(item.purchaseCount) || 1;
    const sizePerPack = item.quantity / count;
    setFormData({ 
        category: item.category, itemName: item.itemName, amount: item.amount.toString(), 
        count: count.toString(), unitValue: sizePerPack.toString(), suffix: item.unit, date: item.date 
    });
    setIsFormOpen(true);
  };

  const quickSetFeedType = async (feedType) => {
    const expenseId = feedModal.targetId;
    setFeedModal({ isOpen: false, targetId: null });
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/update-expense-category`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ expenseId, batchId: activeBatchId, category: "Feeds", feedType })
      });
      if (response.ok) { setSuccessMessage(`Classification updated!`); fetchData(); }
    } catch (e) { console.error(e); }
  };

  const filteredExpenses = expenses.filter(i => {
    const matchesFilter = filter === 'All' || i.category === filter;
    const matchesSearch = i.itemName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const totalSpent = filteredExpenses.reduce((sum, i) => sum + ((parseFloat(i.purchaseCount) || 1) * parseFloat(i.amount || 0)), 0);

  return (
    <div className="bg-gray-50 h-full w-full p-6 animate-fade-in font-sans text-gray-800">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} onConfirm={handleAction} />
      <FeedTypeModal isOpen={feedModal.isOpen} onClose={() => setFeedModal({isOpen: false, targetId: null})} onSelect={quickSetFeedType} />

      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2.5 bg-red-50 rounded-xl"><ShoppingBag size={22} className="text-[#3B0A0A]" /></div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Search item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-900 outline-none text-xs transition-all font-medium"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            <Filter size={14} className="text-gray-400" />
            <select className="bg-transparent text-[11px] font-bold outline-none cursor-pointer" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="All">All Categories</option><option value="Feeds">Feeds</option><option value="Vitamins">Vitamins</option><option value="Items">Items</option><option value="Salary">Salary</option>
            </select>
          </div>
          <button 
            onClick={() => { setEditMode(null); setFormData({ category: 'Feeds', itemName: '', amount: '', count: '1', unitValue: '50', suffix: 'kgs', date: new Date().toISOString().split('T')[0] }); setIsFormOpen(true); }}
            className="bg-[#3B0A0A] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-900 transition-all flex items-center gap-2 shadow-lg active:scale-95"
          >
            <PlusCircle size={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* --- TOTAL SUMMARY BANNER --- */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 mb-6 flex justify-between items-center shadow-sm">
        <div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Batch Ledger</span>
          <h2 className="text-sm font-bold text-gray-500 uppercase">{filter} Expenses</h2>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-black text-[#3B0A0A] uppercase tracking-widest opacity-50">Total Outflow</span>
          <span className="text-4xl font-black text-[#3B0A0A]">₱{totalSpent.toLocaleString()}</span>
        </div>
      </div>

      {/* --- TABLE LAYOUT --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Item / Category</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Quantity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Unit Price</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Total Amount</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="5" className="py-20 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B0A0A] mx-auto"></div></td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr><td colSpan="5" className="py-20 text-center text-gray-300 text-xs font-medium uppercase tracking-widest">No expenses logged</td></tr>
              ) : filteredExpenses.map((item) => {
                const q = parseFloat(item.purchaseCount) || 1;
                const p = parseFloat(item.amount) || 0;
                return (
                  <tr key={item.id} className="hover:bg-gray-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-800">{item.itemName}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded text-white uppercase ${item.category === 'Feeds' ? 'bg-amber-600' : item.category === 'Salary' ? 'bg-blue-600' : 'bg-purple-600'}`}>{item.category}</span>
                            {item.feedType && <span className="text-[8px] font-bold bg-green-500 text-white px-1.5 py-0.5 rounded uppercase">{item.feedType}</span>}
                            <span className="text-[10px] text-gray-400 font-medium">{item.date}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-700">{q} {item.category === 'Salary' ? 'Month(s)' : 'Pack(s)'}</span>
                        <span className="text-[10px] text-gray-400">{item.category !== 'Salary' && `${item.quantity}${item.unit}`}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <span className="text-xs font-bold text-gray-500">₱{p.toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                        <span className="text-sm font-black text-[#3B0A0A]">₱{(q * p).toLocaleString()}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {item.category === 'Feeds' && (
                          <button onClick={() => setFeedModal({ isOpen: true, targetId: item.id })} className="p-2 text-green-600 hover:bg-green-50 rounded-lg" title="Classify"><Layers size={16} /></button>
                        )}
                        <button onClick={() => startEdit(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit"><Edit2 size={16} /></button>
                        <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: item.id })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD/EDIT MODAL --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 animate-fade-in">
            <div className={`p-4 flex justify-between items-center text-white ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/10 rounded-lg">{editMode ? <Edit2 size={18}/> : <PlusCircle size={18}/>}</div>
                <h2 className="font-bold text-sm tracking-tight">{editMode ? "EDIT EXPENSE" : "LOG NEW EXPENSE"}</h2>
              </div>
              <button onClick={() => setIsFormOpen(false)} className="hover:rotate-90 transition-transform duration-200"><X size={20} /></button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); setConfirmModal({isOpen: true, type: 'create'}); }} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Category</label>
                  <select className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" value={formData.category} onChange={handleCategoryChange}>
                    <option value="Feeds">Feeds</option><option value="Vitamins">Vitamins</option><option value="Items">Items</option><option value="Salary">Salary</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Date</label>
                  <input type="date" required value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2 text-xs outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">{formData.category === 'Salary' ? 'Personnel' : 'Item Name'}</label>
                {formData.category === 'Salary' ? (
                  <select required className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})}>
                    <option value="">Select Staff...</option>
                    <optgroup label="Technicians">
                        {systemUsers.filter(u => u.role !== 'admin').map((u) => <option key={u.uid} value={u.fullName || u.username}>{u.fullName || u.username} (Tech)</option>)}
                    </optgroup>
                    <optgroup label="Farmers">
                        {personnelList.filter(p => p.status === 'Active').map((p) => <option key={p.id} value={`${p.firstName} ${p.lastName}`}>{p.firstName} {p.lastName} (Staff)</option>)}
                    </optgroup>
                  </select>
                ) : (
                  <input type="text" required placeholder="Ex: Item Name" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Price / Unit</label>
                  <input type="number" required value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Packs/Qty</label>
                  <input type="number" required value={formData.count} onChange={(e) => setFormData({...formData, count: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Unit Detail (Size)</label>
                <div className="flex">
                  <input type="number" required disabled={formData.category === 'Items'} value={formData.unitValue} onChange={(e) => setFormData({...formData, unitValue: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-l-xl p-2.5 text-xs outline-none font-bold disabled:bg-gray-200" />
                  <select value={formData.suffix} onChange={(e) => setFormData({...formData, suffix: e.target.value})} className="bg-gray-100 text-gray-600 font-bold px-3 text-[10px] rounded-r-xl border-y border-r border-gray-100 outline-none uppercase">
                     {formData.category === 'Feeds' ? (<><option value="kgs">kgs</option><option value="lbs">lbs</option></>) : formData.category === 'Vitamins' ? (<><option value="g">g</option><option value="ml">ml</option></>) : (<option value="pcs">pcs</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 bg-gray-50 text-gray-500 font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-gray-100">Cancel</button>
                <button type="submit" className={`flex-1 text-white font-bold py-3 rounded-xl text-[10px] uppercase shadow-lg active:scale-95 ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>{editMode ? "Update" : "Confirm"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Expenses;