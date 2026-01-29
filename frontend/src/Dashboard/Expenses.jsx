import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

const SuccessModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-96 text-center transform transition-all scale-100">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Success</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <button onClick={onClose} className="w-full bg-red-950 text-white rounded-md px-4 py-2 hover:bg-red-900 transition">OK</button>
      </div>
    </div>
  );
};

const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{type === 'delete' ? 'Delete Record?' : 'Save Expense?'}</h3>
        <p className="text-sm text-gray-500 mb-6">Are you sure you want to proceed?</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="bg-gray-100 text-gray-700 px-4 py-2 rounded">Cancel</button>
          <button onClick={onConfirm} className={`text-white px-4 py-2 rounded ${type === 'delete' ? 'bg-red-600' : 'bg-green-600'}`}>
            {type === 'delete' ? 'Yes, Delete' : 'Yes, Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FeedTypeModal = ({ isOpen, onClose, onSelect }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-80 text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Select Feed Type</h3>
        <div className="flex flex-col gap-3">
          {['Booster', 'Starter', 'Finisher'].map((type) => (
            <button key={type} onClick={() => onSelect(type)} className="w-full py-3 rounded-lg font-bold text-white bg-red-950 hover:bg-red-900 transition">{type}</button>
          ))}
          <button onClick={onClose} className="mt-2 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
};

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(null); // Database Fix: Store batch ID
  const [forecastTotals, setForecastTotals] = useState({ Booster: 0, Starter: 0, Finisher: 0 });
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [feedModal, setFeedModal] = useState({ isOpen: false, targetId: null });
  const [editMode, setEditMode] = useState(null);
  const [filter, setFilter] = useState('All');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ 
    category: 'Feeds', 
    itemName: '', 
    description: '', 
    amount: '', 
    quantity: '', 
    unit: 'kgs', 
    date: new Date().toISOString().split('T')[0] 
  });

  const backendUrl = "http://localhost:8000";

  const fetchData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      
      // 1. First, find which batch is ACTIVE
      const batchRes = await fetch(`${backendUrl}/get-batches`, { headers: { "Authorization": `Bearer ${token}` }});
      if (batchRes.ok) {
        const batches = await batchRes.json();
        const active = batches.find(b => b.status === 'active');
        
        if (active) {
          setActiveBatchId(active.id);

          // 2. Database Fix: Get expenses specifically for this batch
          const expRes = await fetch(`${backendUrl}/get-expenses/${active.id}`, { headers: { "Authorization": `Bearer ${token}` }});
          if (expRes.ok) setExpenses(await expRes.json());

          // 3. Get Forecast for the "Remaining" labels
          const forecastRes = await fetch(`${backendUrl}/get-feed-forecast/${active.id}`, { headers: { "Authorization": `Bearer ${token}` }});
          if (forecastRes.ok) {
            const fData = await forecastRes.json();
            const totals = { Booster: 0, Starter: 0, Finisher: 0 };
            fData.forecast.forEach(d => { totals[d.feedType] += d.targetKilos; });
            setForecastTotals(totals);
          }
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    let newUnit = 'kgs';
    if (newCat === 'Vitamins') newUnit = 'g';
    else if (newCat === 'Items') newUnit = 'pcs';
    else if (newCat === 'Salary') newUnit = 'month';
    setFormData({ ...formData, category: newCat, unit: newUnit });
  };

  const getRemainingLabel = (item) => {
    if (item.category === 'Feeds' && item.feedType) {
        const totalUsed = expenses
            .filter(e => e.feedType === item.feedType)
            .reduce((sum, e) => sum + (parseFloat(e.quantity) || 0), 0);
        const remain = (forecastTotals[item.feedType] - totalUsed).toFixed(1);
        return <span className="ml-2 text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded font-bold">{remain} kgs remain</span>;
    }
    return null;
  };

  const handleAction = async () => {
    const { type, targetId } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, targetId: null });

    if (!activeBatchId && type === 'create') {
        alert("No active batch found!");
        return;
    }

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      if (type === 'create') {
        const url = editMode ? `${backendUrl}/edit-expense` : `${backendUrl}/add-expense`;
        
        // Database Fix: Ensure batchId is sent in the body
        const body = editMode 
            ? { ...formData, expenseId: editMode, batchId: activeBatchId } 
            : { ...formData, batchId: activeBatchId };

        const response = await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          setSuccessMessage(editMode ? "Record Updated!" : "Expense Recorded!");
          setFormData({ category: 'Feeds', itemName: '', description: '', amount: '', quantity: '', unit: 'kgs', date: new Date().toISOString().split('T')[0] });
          setEditMode(null); fetchData();
        }
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-expense/${targetId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` }});
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
    setFormData({ category: item.category, itemName: item.itemName, description: item.description || '', amount: item.amount, quantity: item.quantity, unit: item.unit, date: item.date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredExpenses = filter === 'All' ? expenses : expenses.filter(i => i.category === filter);
  const totalSpent = filteredExpenses.reduce((sum, i) => sum + (parseFloat(i.quantity || 0) * parseFloat(i.amount || 0)), 0);

  return (
    <div className="bg-gray-50 min-h-full font-sans text-gray-800 p-4">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} onConfirm={handleAction} />
      <FeedTypeModal isOpen={feedModal.isOpen} onClose={() => setFeedModal({isOpen: false, targetId: null})} onSelect={quickSetCategory} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg border sticky top-4 overflow-hidden">
            <div className={`p-4 ${editMode ? 'bg-blue-600' : 'bg-red-900'}`}><h2 className="text-white font-bold">{editMode ? 'Edit Record' : 'Record New Expense'}</h2></div>
            <form onSubmit={(e) => { e.preventDefault(); setConfirmModal({isOpen: true, type: 'create'}); }} className="p-6 space-y-4">
              <select className="w-full border p-2.5 rounded text-sm" value={formData.category} onChange={handleCategoryChange}>
                <option value="Feeds">Feeds</option>
                <option value="Vitamins">Vitamins</option>
                <option value="Items">Items</option>
                <option value="Salary">Salary</option>
              </select>
              <input type="text" placeholder="Item Name" required className="w-full border p-2.5 rounded text-sm" value={formData.itemName} onChange={(e) => setFormData({...formData, itemName: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder={`Qty (${formData.unit})`} required className="border p-2.5 rounded text-sm" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
                <input type="text" placeholder="Unit" required className="border p-2.5 rounded text-sm bg-gray-50" value={formData.unit} readOnly />
              </div>
              <input type="number" placeholder="Price/Unit" required className="w-full border p-2.5 rounded text-sm" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} />
              <input type="date" required className="w-full border p-2.5 rounded text-sm" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
              <button type="submit" className={`w-full py-3 rounded-lg font-bold text-white shadow-sm transition-all active:scale-95 ${editMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-900 hover:bg-red-800'}`}>
                {editMode ? 'UPDATE RECORD' : 'SAVE RECORD'}
              </button>
              {editMode && <button type="button" onClick={() => { setEditMode(null); setFormData({ category: 'Feeds', itemName: '', description: '', amount: '', quantity: '', unit: 'kgs', date: new Date().toISOString().split('T')[0] }); }} className="w-full text-xs text-center text-gray-500 hover:underline">Cancel Edit</button>}
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="flex justify-between border-b-2 border-red-900 mb-6 pb-2">
            <div>
              <h2 className="font-bold text-red-900 uppercase">Batch History</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {['All', 'Feeds', 'Vitamins', 'Items', 'Salary'].map(cat => (
                  <button key={cat} onClick={() => setFilter(cat)} className={`text-[10px] font-bold px-3 py-1 rounded-full border ${filter === cat ? 'bg-red-900 text-white' : 'bg-white text-gray-500'}`}>{cat}</button>
                ))}
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-gray-400 block uppercase font-bold">Total Spent</span>
              <span className="text-xl font-bold">₱{totalSpent.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-4">
            {expenses.length === 0 ? <p className="text-center py-10 text-gray-400 italic">No records found for active batch.</p> : filteredExpenses.map((item) => (
              <div key={item.id} className="bg-white rounded-xl border p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:shadow-md transition">
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-bold text-white px-2 py-0.5 rounded uppercase ${item.category === 'Feeds' ? 'bg-amber-600' : 'bg-purple-600'}`}>{item.unit}</span>
                    {item.feedType && <span className="text-[9px] font-bold bg-green-600 text-white px-2 py-0.5 rounded uppercase">{item.feedType}</span>}
                    <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500">{item.date}</span>
                    <h3 className="font-bold text-gray-900 uppercase">{item.itemName}</h3>
                  </div>
                  <div className="flex items-center">
                    <p className="text-sm font-bold text-red-900">₱{(parseFloat(item.quantity || 0) * parseFloat(item.amount || 0)).toLocaleString()}</p>
                    {getRemainingLabel(item)}
                  </div>
                </div>
                <div className="flex gap-2">
                  {item.category === 'Feeds' && (
                    <button onClick={() => setFeedModal({ isOpen: true, targetId: item.id })} className="text-[10px] font-bold text-green-700 bg-green-50 px-4 py-2 rounded hover:bg-green-100 border border-green-100 uppercase">Set Type</button>
                  )}
                  <button onClick={() => startEdit(item)} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded border border-blue-100 uppercase">Edit</button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: item.id })} className="text-[10px] font-bold text-red-600 bg-red-50 px-4 py-2 rounded border border-red-100 uppercase">Delete</button>
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