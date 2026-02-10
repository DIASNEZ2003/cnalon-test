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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 text-center transform transition-all scale-100 border border-gray-100">
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full bg-green-50 mb-4 border border-green-100">
          <Check className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-black text-gray-800 mb-2 tracking-tight">Success</h3>
        <p className="text-sm text-gray-500 mb-6 font-medium">{message}</p>
        <button 
          onClick={onClose}
          className="w-full bg-[#3B0A0A] text-white font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all shadow-lg active:scale-95"
        >
          CONTINUE
        </button>
      </div>
    </div>
  );
};

// --- CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  let title = "Confirm Action";
  let message = "Are you sure?";
  let buttonColor = "bg-red-600 hover:bg-red-700"; 
  let icon = <AlertTriangle className="h-8 w-8 text-orange-500" />;
  let buttonText = "Confirm";

  if (type === 'create') {
    title = "Save Expense?";
    message = "Please verify the details before saving this record.";
    buttonColor = "bg-green-600 hover:bg-green-700";
    icon = <Check className="h-8 w-8 text-green-600" />;
    buttonText = "Yes, Save Expense";
  } else if (type === 'delete') {
    title = "Delete Record?";
    message = "This action cannot be undone. It will be removed from your total costs.";
    icon = <Trash2 className="h-8 w-8 text-red-600" />;
    buttonText = "Yes, Delete";
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110]">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 border border-gray-100">
        <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-gray-50 mb-4 border border-gray-100">
          {icon}
        </div>
        <h3 className="text-xl font-black text-gray-800 text-center mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-8 px-4">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 font-bold px-4 py-3 rounded-xl hover:bg-gray-200 transition"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 text-white font-bold px-4 py-3 rounded-xl transition shadow-lg ${buttonColor}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- FEED TYPE MODAL ---
const FeedTypeModal = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[120]">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 text-center border border-gray-100">
        <h3 className="text-lg font-black text-gray-900 mb-4">Select Feed Stage</h3>
        <div className="flex flex-col gap-3">
          {['Booster', 'Starter', 'Finisher'].map((type) => (
            <button 
              key={type} 
              onClick={() => onSelect(type)} 
              className="w-full py-3 rounded-xl font-bold text-white bg-[#3B0A0A] hover:bg-red-900 transition shadow-md uppercase tracking-wider text-xs"
            >
              {type}
            </button>
          ))}
          <button onClick={onClose} className="mt-2 text-xs font-bold text-gray-500 hover:text-gray-700 uppercase tracking-wide">Cancel</button>
        </div>
      </div>
    </div>
  );
};

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [usersList, setUsersList] = useState([]); 
  const [activeBatchId, setActiveBatchId] = useState(null); 
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [feedModal, setFeedModal] = useState({ isOpen: false, targetId: null });
  const [editMode, setEditMode] = useState(null);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({ 
    category: 'Feeds', 
    feedType: 'Booster', 
    itemName: '', 
    description: '', 
    amount: '', 
    count: '1',      
    unitValue: '',   
    suffix: 'kgs',   
    date: new Date().toISOString().split('T')[0] 
  });

  const backendUrl = "http://localhost:8000";

  const fetchSystemUsers = async (token) => {
    try {
      const res = await fetch(`${backendUrl}/get-users`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      }
    } catch (err) { console.error("Error fetching users:", err); }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) { setLoading(false); return; }
      const token = await user.getIdToken();
      fetchSystemUsers(token);
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
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchData(); else setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    let newSuffix = 'kgs';
    let newFeedType = '';
    let newItemName = formData.itemName;

    if (newCat === 'Feeds') { newFeedType = 'Booster'; newSuffix = 'kgs'; } 
    else if (newCat === 'Vitamins') { newSuffix = 'g'; } 
    else if (newCat === 'Items') { newSuffix = 'pcs'; } 
    else if (newCat === 'Salary') { 
        newSuffix = 'month'; 
        newItemName = ''; 
    }
    
    setFormData({ 
      ...formData, 
      category: newCat, 
      suffix: newSuffix, 
      feedType: newFeedType, 
      itemName: newItemName,
      unitValue: newCat === 'Salary' ? '1' : '' 
    });
  };

  const handleAction = async () => {
    const { type, targetId } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, targetId: null });
    if (!activeBatchId && type === 'create') return;

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      
      const isCountOnly = formData.category === 'Salary';
      // Calculate Total Quantity
      const qty = isCountOnly 
        ? (parseFloat(formData.count) || 1) 
        : (parseFloat(formData.count) || 0) * (parseFloat(formData.unitValue) || 1);
      
      if (type === 'create') {
        const url = editMode ? `${backendUrl}/edit-expense` : `${backendUrl}/add-expense`;
        const method = editMode ? "PUT" : "POST";
        
        const body = {
           batchId: activeBatchId,
           category: formData.category,
           feedType: formData.category === 'Feeds' ? formData.feedType : null,
           itemName: formData.itemName,
           description: formData.description,
           amount: formData.amount,
           date: formData.date,
           quantity: qty,
           remaining: qty, // <--- ADDED: Initialize remaining equal to purchased quantity
           unit: formData.suffix 
        };
        
        if(editMode) body.expenseId = editMode;
        const response = await fetch(url, {
          method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          setSuccessMessage(editMode ? "Record Updated!" : "Expense Recorded!");
          setFormData({ category: 'Feeds', feedType: 'Booster', itemName: '', description: '', amount: '', count: '1', unitValue: '', suffix: 'kgs', date: new Date().toISOString().split('T')[0] });
          setEditMode(null); fetchData();
        }
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-expense/${activeBatchId}/${targetId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }});
        setSuccessMessage("Record Deleted!"); fetchData();
      }
    } catch (e) { alert("Action failed"); }
  };

  const quickSetCategory = async (feedType) => {
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

  const startEdit = (item) => {
    setEditMode(item.id);
    setFormData({ 
        category: item.category, 
        feedType: item.feedType || (item.category === 'Feeds' ? 'Booster' : ''),
        itemName: item.itemName, 
        description: item.description || '', 
        amount: item.amount, 
        count: '1', 
        unitValue: item.quantity, 
        suffix: item.unit, 
        date: item.date 
    });
  };

  const filteredExpenses = filter === 'All' ? expenses : expenses.filter(i => i.category === filter);
  const totalSpent = filteredExpenses.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.amount || 0)), 0);

  return (
    // MAIN CONTAINER: Fixed Height
    <div className="bg-gray-50 h-[calc(100vh-100px)] w-full overflow-hidden font-sans text-gray-800 p-4">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} onConfirm={handleAction} />
      <FeedTypeModal isOpen={feedModal.isOpen} onClose={() => setFeedModal({isOpen: false, targetId: null})} onSelect={quickSetCategory} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* --- LEFT COLUMN: FORM --- */}
        <div className="lg:col-span-1 h-full overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className={`p-5 ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm"><PlusCircle className="text-white h-6 w-6" /></div>
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide">{editMode ? 'Edit Record' : 'New Expense'}</h2>
                  <p className="text-white/60 text-xs uppercase font-bold tracking-tighter">Financial Log</p>
                </div>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); setConfirmModal({isOpen: true, type: 'create'}); }} className="p-6 space-y-4">
              
              {/* Category */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Category</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <select className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] block pl-10 p-3 outline-none font-bold" value={formData.category} onChange={handleCategoryChange}>
                    <option value="Feeds">Feeds</option>
                    <option value="Vitamins">Vitamins</option>
                    <option value="Items">Items</option>
                    <option value="Salary">Salary</option>
                  </select>
                </div>
              </div>

              {/* Item Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                  {formData.category === 'Salary' ? 'Select Staff' : 'Item Name'}
                </label>
                <div className="relative">
                  {formData.category === 'Salary' ? (
                    <>
                      <User className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                      <select required className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl block pl-10 p-3 outline-none font-bold" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})}>
                        <option value="">Choose Staff Member...</option>
                        {usersList
                          .filter(u => u.role !== 'admin')
                          .map((u) => <option key={u.id} value={u.fullName || u.email}>{u.fullName || u.email}</option>)
                        }
                      </select>
                    </>
                  ) : (
                    <>
                      <FileText className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                      <input type="text" required placeholder="e.g. Vetracin" className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl block pl-10 p-3 outline-none font-bold" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} />
                    </>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                  {/* Field 1: Quantity / Count */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                        {formData.category === 'Salary' ? 'Months' : 'Qty (Pila kabuok)'}
                    </label>
                    <div className="relative">
                      <Package className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                      <input 
                        type="number" 
                        required 
                        className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl block pl-10 p-3 outline-none font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                        value={formData.count} 
                        onChange={(e) => setFormData({...formData, count: e.target.value})} 
                      />
                    </div>
                  </div>

                  {/* Field 2: Size per Item + Unit Selector */}
                  {formData.category !== 'Salary' && (
                    <div className="space-y-1 animate-fade-in">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Size (Pila ka kg/ml?)</label>
                        <div className="relative flex">
                            {/* The Number Input (Value) - NO ICON, MORE SPACE */}
                            <div className="relative w-full">
                                <input 
                                    type="number" 
                                    required 
                                    placeholder={formData.category === 'Feeds' ? "50" : "100"}
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-l-xl block pl-3 p-3 outline-none font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                    value={formData.unitValue} 
                                    onChange={(e) => setFormData({...formData, unitValue: e.target.value})} 
                                />
                            </div>
                            
                            {/* The Unit Selector (Dropdown) - FIXED WIDTH */}
                            <select 
                                value={formData.suffix} 
                                onChange={(e) => setFormData({...formData, suffix: e.target.value})}
                                className="bg-gray-200 text-gray-700 font-bold px-1 rounded-r-xl text-xs border-y border-r border-gray-200 outline-none cursor-pointer hover:bg-gray-300 transition-colors uppercase w-20 text-center"
                            >
                                {formData.category === 'Feeds' ? (
                                    <>
                                        <option value="kgs">KGS</option>
                                        <option value="lbs">LBS</option>
                                    </>
                                ) : formData.category === 'Vitamins' ? (
                                    <>
                                        <option value="g">G</option>
                                        <option value="ml">ML</option>
                                        <option value="l">L</option>
                                        <option value="mg">MG</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="pcs">PCS</option>
                                        <option value="roll">ROLL</option>
                                        <option value="set">SET</option>
                                        <option value="kgs">KGS</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>
                  )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
                    {formData.category === 'Salary' ? 'Monthly Pay' : 'Price / Unit'}
                  </label>
                  <div className="relative">
                    {formData.category === 'Salary' ? <Banknote className="absolute left-3 top-3 text-gray-400 h-4 w-4" /> : <DollarSign className="absolute left-3 top-3 text-gray-400 h-4 w-4" />}
                    <input 
                      type="number" 
                      required 
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl block pl-10 p-3 outline-none font-bold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                      value={formData.amount} 
                      onChange={(e) => setFormData({...formData, amount: e.target.value})} 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                    <input type="date" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl block pl-10 p-3 outline-none font-medium" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                  </div>
                </div>
              </div>
              
              <button type="submit" className={`w-full mt-4 text-white font-bold rounded-xl px-5 py-4 text-center transition-all shadow-lg active:scale-95 uppercase tracking-wide ${editMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#3B0A0A] hover:bg-red-900'}`}>
                {editMode ? 'UPDATE RECORD' : 'SAVE RECORD'}
              </button>
              
              {editMode && (
                <button type="button" onClick={() => { setEditMode(null); setFormData({ category: 'Feeds', feedType: 'Booster', itemName: '', description: '', amount: '', count: '1', unitValue: '', suffix: 'kgs', date: new Date().toISOString().split('T')[0] }); }} className="w-full text-xs font-bold text-gray-500 hover:text-[#3B0A0A] text-center mt-2 uppercase tracking-tighter">Cancel Edit</button>
              )}
            </form>
          </div>
        </div>

        {/* --- RIGHT COLUMN: LIST (Scrollable) --- */}
        <div className="lg:col-span-2 h-full flex flex-col overflow-hidden">
          
          <div className="flex justify-between items-end border-b border-gray-200 mb-4 pb-4 px-1 shrink-0">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#3B0A0A] mb-3"><ShoppingBag className="h-5 w-5" /> Batch Expenses</h2>
              <div className="flex flex-wrap gap-2">
                {['All', 'Feeds', 'Vitamins', 'Items', 'Salary'].map(cat => (
                  <button key={cat} onClick={() => setFilter(cat)} className={`text-[10px] font-bold px-4 py-1.5 rounded-full transition-all border ${filter === cat ? 'bg-[#3B0A0A] text-white border-[#3B0A0A]' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-right">
              <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Spent</span>
              <span className="text-2xl font-black text-[#3B0A0A]">₱{totalSpent.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-20 custom-scrollbar">
            {expenses.length === 0 ? <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center text-gray-400 font-bold uppercase tracking-tighter">No Expenses Logged</div> : filteredExpenses.map((item) => (
              <div key={item.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row justify-between items-center gap-4 overflow-hidden">
                <div className="p-5 flex-1 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold text-white px-2 py-1 rounded-md uppercase tracking-wider ${item.category === 'Feeds' ? 'bg-amber-600' : item.category === 'Salary' ? 'bg-blue-600' : 'bg-purple-600'}`}>{item.category}</span>
                    {item.feedType && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-md uppercase tracking-wider">{item.feedType}</span>}
                    <span className="text-[10px] font-bold bg-gray-100 px-2 py-1 rounded-md text-gray-500 flex items-center gap-1"><Calendar size={10} /> {item.date}</span>
                  </div>
                  <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight leading-none mb-1">{item.itemName}</h3>
                        <p className="text-xs font-bold text-gray-400">
                            {item.quantity}
                            {item.category !== 'Items' && <span className="text-[10px] ml-0.5 uppercase">{item.unit}</span>}
                            {/* Display Remaining if available */}
                            {item.remaining !== undefined && (
                                <span className="block text-[10px] text-teal-600 mt-1">
                                    Remaining: {item.remaining} {item.unit}
                                </span>
                            )}
                        </p>
                      </div>
                      <div className="text-right"><p className="text-lg font-black text-[#3B0A0A]">₱{(parseFloat(item.quantity || 0) * parseFloat(item.amount || 0)).toLocaleString()}</p></div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 border-t md:border-t-0 md:border-l border-gray-100 flex md:flex-col gap-2 w-full md:w-auto">
                  {item.category === 'Feeds' && (
                    <button onClick={() => setFeedModal({ isOpen: true, targetId: item.id })} className="flex-1 md:w-24 flex items-center justify-center gap-1 text-[10px] font-black text-green-600 bg-green-50 hover:bg-green-100 py-2 rounded-lg transition-colors uppercase"><Layers size={12} /> Set Type</button>
                  )}
                  <button onClick={() => startEdit(item)} className="flex-1 md:w-24 flex items-center justify-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors uppercase"><Edit2 size={12} /> Edit</button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: item.id })} className="flex-1 md:w-24 flex items-center justify-center gap-1 text-[10px] font-black text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded-lg transition-colors uppercase"><Trash2 size={12} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;