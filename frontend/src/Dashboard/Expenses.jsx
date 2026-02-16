import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  ShoppingBag, Calendar, DollarSign, Tag, 
  FileText, Hash, Edit2, Trash2, PlusCircle, 
  Check, AlertTriangle, Layers, User, Banknote, Package
} from 'lucide-react';

// --- SUCCESS MODAL ---
const SuccessModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-[#1a1a1a]/80 backdrop-blur-md flex items-center justify-center z-[110] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 text-center border border-gray-100">
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-50 mb-4 border border-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight uppercase">Success</h3>
        <p className="text-sm text-gray-500 mb-6 font-medium">{message}</p>
        <button onClick={onClose} className="w-full bg-[#3B0A0A] text-white font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all shadow-lg active:scale-95">CONTINUE</button>
      </div>
    </div>
  );
};

// --- CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  let title = type === 'create' ? "Save Expense?" : "Delete Record?";
  let buttonColor = type === 'create' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"; 
  let icon = type === 'create' ? <Check className="h-8 w-8 text-green-600" /> : <Trash2 className="h-8 w-8 text-red-600" />;
  return (
    <div className="fixed inset-0 bg-[#1a1a1a]/85 backdrop-blur-md flex items-center justify-center z-[110]">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 border border-gray-100 text-center">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-50 mb-4 border border-gray-100">{icon}</div>
        <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight uppercase">{title}</h3>
        <p className="text-sm text-gray-500 mb-8 px-4">Please verify the details before proceeding.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 font-bold px-4 py-3 rounded-xl hover:bg-gray-200 transition uppercase text-xs">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 text-white font-bold px-4 py-3 rounded-xl transition shadow-lg uppercase text-xs ${buttonColor}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- FEED TYPE MODAL ---
const FeedTypeModal = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-[#1a1a1a]/85 backdrop-blur-md flex items-center justify-center z-[120]">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 text-center border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4 uppercase tracking-tighter">Select Feed Stage</h3>
        <div className="flex flex-col gap-3">
          {['Booster', 'Starter', 'Finisher'].map((type) => (
            <button key={type} onClick={() => onSelect(type)} className="w-full py-3 rounded-xl font-bold text-white bg-[#3B0A0A] hover:bg-red-900 transition shadow-md uppercase tracking-wider text-xs">{type}</button>
          ))}
          <button onClick={onClose} className="mt-2 text-xs font-bold text-gray-500 hover:text-gray-700 uppercase tracking-wide">Cancel</button>
        </div>
      </div>
    </div>
  );
};

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  
  // --- STATE FOR BOTH LISTS ---
  const [systemUsers, setSystemUsers] = useState([]); 
  const [personnelList, setPersonnelList] = useState([]); 
  
  const [activeBatchId, setActiveBatchId] = useState(null); 
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [feedModal, setFeedModal] = useState({ isOpen: false, targetId: null });
  const [editMode, setEditMode] = useState(null);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({ 
    category: 'Feeds', itemName: '', amount: '', count: '1', unitValue: '50', suffix: 'kgs', date: new Date().toISOString().split('T')[0] 
  });

  const backendUrl = "http://localhost:8000";

  // --- FETCH BOTH LISTS ---
  const fetchStaffData = async (token) => {
    try {
      // 1. Get System Users (Technicians)
      const userRes = await fetch(`${backendUrl}/get-users`, { headers: { "Authorization": `Bearer ${token}` }});
      if (userRes.ok) setSystemUsers(await userRes.json());

      // 2. Get Personnel (Farmers)
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
      
      fetchStaffData(token); // Fetch combined staff list

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
    
    setFormData({ ...formData, category: newCat, suffix: newSuffix, unitValue: defaultSize, itemName: newCat === 'Salary' ? '' : formData.itemName });
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
          setSuccessMessage(editMode ? "Updated!" : "Saved!");
          setFormData({ category: 'Feeds', itemName: '', amount: '', count: '1', unitValue: '50', suffix: 'kgs', date: new Date().toISOString().split('T')[0] });
          setEditMode(null); fetchData();
        }
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-expense/${activeBatchId}/${targetId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }});
        fetchData();
      }
    } catch (e) { alert("Action failed"); }
  };

  const startEdit = (item) => {
    setEditMode(item.id);
    const count = parseFloat(item.purchaseCount) || 1;
    const sizePerPack = item.quantity / count;
    setFormData({ 
        category: item.category, itemName: item.itemName, amount: item.amount.toString(), 
        count: count.toString(), unitValue: sizePerPack.toString(), suffix: item.unit, date: item.date 
    });
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
      if (response.ok) { setSuccessMessage(`Set to ${feedType}!`); fetchData(); }
    } catch (e) { alert("Update failed"); }
  };

  const filteredExpenses = filter === 'All' ? expenses : expenses.filter(i => i.category === filter);
  const totalSpent = filteredExpenses.reduce((sum, i) => sum + ((parseFloat(i.purchaseCount) || 1) * parseFloat(i.amount || 0)), 0);

  return (
    <div className="bg-gray-50 h-[calc(100vh-100px)] w-full overflow-hidden font-sans text-gray-800 p-4">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} onConfirm={handleAction} />
      <FeedTypeModal isOpen={feedModal.isOpen} onClose={() => setFeedModal({isOpen: false, targetId: null})} onSelect={quickSetFeedType} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full overflow-hidden">
        {/* LEFT COLUMN: FORM */}
        <div className="lg:col-span-4 h-full overflow-hidden">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className={`p-5 text-white ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>
              <div className="flex items-center gap-3">
                <PlusCircle className="text-white h-6 w-6" />
                <h2 className="font-bold text-lg uppercase tracking-widest">{editMode ? 'Edit Entry' : 'New Expense'}</h2>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setConfirmModal({isOpen: true, type: 'create'}); }} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#3B0A0A] uppercase tracking-widest pl-1">Category</label>
                <select className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl p-3 outline-none font-bold" value={formData.category} onChange={handleCategoryChange}>
                  <option value="Feeds">Feeds</option><option value="Vitamins">Vitamins</option><option value="Items">Items</option><option value="Salary">Salary</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-[#3B0A0A] uppercase tracking-widest pl-1">{formData.category === 'Salary' ? 'Personnel' : 'Item Name'}</label>
                {formData.category === 'Salary' ? (
                  /* --- COMBINED DROPDOWN: USERS + PERSONNEL --- */
                  <select required className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl p-3 font-bold outline-none" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})}>
                    <option value="">Select Staff...</option>
                    
                    {/* OPTION GROUP: TECHNICIANS */}
                    <optgroup label="System Users (Technicians)">
                        {systemUsers.filter(u => u.role !== 'admin').map((u) => (
                            <option key={u.uid} value={u.fullName || u.username}>{u.fullName || u.username} (Tech)</option>
                        ))}
                    </optgroup>

                    {/* OPTION GROUP: PERSONNEL */}
                    <optgroup label="Farm Personnel">
                        {personnelList.filter(p => p.status === 'Active').map((p) => (
                            <option key={p.id} value={`${p.firstName} ${p.lastName}`}>
                                {p.firstName} {p.lastName} (Staff)
                            </option>
                        ))}
                    </optgroup>
                  </select>
                ) : (
                  <div className="relative"><FileText className="absolute left-3 top-3 text-gray-400 h-4 w-4" /><input type="text" required placeholder="Ex: Integra 3000" className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl pl-10 p-3 outline-none font-bold" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} /></div>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#3B0A0A] uppercase tracking-widest pl-1">Quantity</label>
                    <div className="relative group">
                      <Package className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                      <input type="number" required className="w-full bg-gray-50 border border-gray-200 text-sm rounded-xl pl-10 p-3 outline-none font-black" value={formData.count} onChange={(e) => setFormData({...formData, count: e.target.value})} />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-[#3B0A0A] uppercase tracking-widest pl-1">Unit</label>
                    <div className="flex">
                        {formData.category !== 'Items' && (
                          <input type="number" required placeholder="50" className="w-full bg-gray-50 border border-gray-200 text-sm rounded-l-xl p-3 outline-none font-black" value={formData.unitValue} onChange={(e) => setFormData({...formData, unitValue: e.target.value})} />
                        )}
                        <select value={formData.suffix} onChange={(e) => setFormData({...formData, suffix: e.target.value})} className={`bg-gray-200 text-gray-700 font-bold px-1 text-[10px] border-y border-r border-gray-200 outline-none w-20 text-center uppercase ${formData.category === 'Items' ? 'rounded-xl border-l h-[46px]' : 'rounded-r-xl'}`}>
                          {formData.category === 'Feeds' ? (<><option value="kgs">KGS</option><option value="lbs">LBS</option></>) : formData.category === 'Vitamins' ? (<><option value="g">G</option><option value="mg">MG</option><option value="ml">ML</option><option value="l">L</option></>) : (<><option value="pcs">PCS</option><option value="pack">PACK</option><option value="set">SET</option></>)}
                        </select>
                    </div>
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#3B0A0A] uppercase tracking-widest pl-1">Price / Pack</label>
                  <div className="relative"><DollarSign className="absolute left-3 top-3 text-gray-400 h-4 w-4" /><input type="number" required className="w-full bg-gray-50 border border-gray-200 text-[#3B0A0A] text-sm rounded-xl pl-10 p-3 outline-none font-black" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} /></div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-[#3B0A0A] uppercase tracking-widest pl-1">Date</label>
                  <input type="date" required className="w-full bg-gray-50 border border-gray-200 text-xs rounded-xl p-3 font-bold outline-none" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
              </div>
              
              <button type="submit" className={`w-full mt-4 text-white font-black rounded-xl py-4 transition-all shadow-lg active:scale-95 uppercase tracking-widest text-xs ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>{editMode ? 'Update' : 'Save'}</button>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: SCROLLABLE LEDGER */}
        <div className="lg:col-span-8 h-full flex flex-col overflow-hidden">
          <div className="flex justify-between items-end border-b border-gray-200 mb-4 pb-4 px-1 shrink-0">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#3B0A0A] mb-3"><ShoppingBag className="h-5 w-5" /> Batch Ledger</h2>
              <div className="flex gap-2">
                {['All', 'Feeds', 'Vitamins', 'Items', 'Salary'].map(cat => (<button key={cat} onClick={() => setFilter(cat)} className={`text-[10px] font-black px-4 py-2 rounded-xl transition-all border ${filter === cat ? 'bg-[#3B0A0A] text-white border-[#3B0A0A]' : 'bg-white text-gray-500 border-gray-200 hover:border-[#3B0A0A]'}`}>{cat}</button>))}
              </div>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Spent</span>
              <span className="text-3xl font-black text-[#3B0A0A]">₱{totalSpent.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pb-32 custom-scrollbar pr-2">
            {filteredExpenses.map((item) => {
              const q = parseFloat(item.purchaseCount) || 1;
              const p = parseFloat(item.amount) || 0;
              const rowTotal = q * p;
              return (
              <div key={item.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row items-center overflow-hidden">
                <div className="p-5 flex-1 w-full">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded-lg text-gray-500 uppercase tracking-tighter">{item.date}</span>
                    <span className={`text-[9px] font-black text-white px-2 py-1 rounded-md uppercase tracking-widest ${item.category === 'Feeds' ? 'bg-amber-600' : item.category === 'Salary' ? 'bg-blue-600' : 'bg-purple-600'}`}>{item.category}</span>
                    {item.feedType && <span className="text-[9px] font-bold bg-green-600 text-white px-2 py-1 rounded-md uppercase tracking-widest ml-2">{item.feedType}</span>}
                  </div>
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight leading-none mb-1">{item.itemName}</h3>
                      <p className="text-[11px] font-bold text-gray-400 uppercase">
                        {q} {item.category === 'Salary' ? 'Month(s)' : 'Pack(s)'} {item.category !== 'Salary' && `• ${item.quantity}${item.unit} total stock`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-[#3B0A0A]">₱{rowTotal.toLocaleString()}</p>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">₱{p.toLocaleString()} / Unit</p>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 p-4 border-l border-gray-100 flex md:flex-col gap-2 shrink-0">
                  {item.category === 'Feeds' && (
                    <button onClick={() => setFeedModal({ isOpen: true, targetId: item.id })} className="w-24 flex items-center justify-center gap-1 text-[10px] font-black text-green-700 bg-green-100 py-2 rounded-lg uppercase border border-green-200">Type</button>
                  )}
                  <button onClick={() => startEdit(item)} className="w-24 flex items-center justify-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 py-2 rounded-lg uppercase hover:bg-blue-100 transition-colors"><Edit2 size={12} /> Edit</button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: item.id })} className="w-24 flex items-center justify-center gap-1 text-[10px] font-black text-red-600 bg-red-50 py-2 rounded-lg uppercase hover:bg-red-100 transition-colors"><Trash2 size={12} /> Delete</button>
                </div>
              </div>
            )})}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;