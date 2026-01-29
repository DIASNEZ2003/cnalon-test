import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';

// --- SUCCESS MODAL ---
const SuccessModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110] animate-fade-in">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-96 text-center transform transition-all scale-100">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Success</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <button onClick={onClose} className="w-full bg-red-950 text-white rounded-md px-4 py-2 hover:bg-red-800 transition">OK</button>
      </div>
    </div>
  );
};

// --- CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{type === 'delete' ? 'Delete Record?' : 'Save Sale?'}</h3>
        <p className="text-sm text-gray-500 mb-6">Are you sure you want to proceed with this action?</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200">Cancel</button>
          <button onClick={onConfirm} className={`text-white px-4 py-2 rounded ${type === 'delete' ? 'bg-red-600' : 'bg-green-600'}`}>
            {type === 'delete' ? 'Yes, Delete' : 'Yes, Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

const Records = () => {
  const [sales, setSales] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [editMode, setEditMode] = useState(null);

  const [formData, setFormData] = useState({
    buyerName: '', address: '', quantity: '', pricePerChicken: '',
    dateOfPurchase: new Date().toISOString().split('T')[0]
  });

  const backendUrl = "http://localhost:8000";

  const fetchData = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const batchRes = await fetch(`${backendUrl}/get-batches`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      if (batchRes.ok) {
        const batches = await batchRes.json();
        const active = batches.find(b => b.status === 'active');
        
        if (active) {
          setActiveBatchId(active.id);
          const salesRes = await fetch(`${backendUrl}/get-sales/${active.id}`, {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (salesRes.ok) setSales(await salesRes.json());
        } else {
          setSales([]);
        }
      }
    } catch (e) { 
      console.error(e); 
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async () => {
    const { type, targetId } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, targetId: null });
    
    // Safety check: Don't allow creating a sale if no batch ID is found
    if (!activeBatchId && type === 'create') {
      alert("Error: Cannot save because no active batch was found in the system.");
      return;
    }

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();

      if (type === 'create') {
        const url = editMode ? `${backendUrl}/edit-sale` : `${backendUrl}/add-sale`;
        const body = editMode 
          ? { ...formData, saleId: editMode, batchId: activeBatchId } 
          : { ...formData, batchId: activeBatchId };
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          setSuccessMessage(editMode ? "Record Updated!" : "Record Saved!");
          setFormData({ buyerName: '', address: '', quantity: '', pricePerChicken: '', dateOfPurchase: new Date().toISOString().split('T')[0] });
          setEditMode(null);
          fetchData();
        }
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-sale/${targetId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        setSuccessMessage("Record Deleted!");
        fetchData();
      }
    } catch (e) { alert("Action failed"); }
  };

  const startEdit = (sale) => {
    setEditMode(sale.id);
    setFormData({
      buyerName: sale.buyerName,
      address: sale.address,
      quantity: sale.quantity,
      pricePerChicken: sale.pricePerChicken,
      dateOfPurchase: sale.dateOfPurchase
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-gray-50 min-h-full font-sans text-gray-800 p-4">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={handleAction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: FORM PANEL (Restriction removed) */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 sticky top-4">
            <div className={`p-4 ${editMode ? 'bg-blue-600' : 'bg-red-900'}`}>
              <h2 className="text-white font-bold text-lg">{editMode ? 'Edit Record' : 'Record New Sale'}</h2>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); setConfirmModal({ isOpen: true, type: 'create' }); }} className="p-6 space-y-4">
              <input type="text" placeholder="Buyer Name" required className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-900" value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} />
              <input type="text" placeholder="Address" required className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-900" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Qty" required className="border p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-900" value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} />
                <input type="number" placeholder="Price/Head" required className="border p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-900" value={formData.pricePerChicken} onChange={(e) => setFormData({...formData, pricePerChicken: e.target.value})} />
              </div>
              <input type="date" required className="w-full border p-2.5 rounded-lg text-sm outline-none focus:ring-1 focus:ring-red-900" value={formData.dateOfPurchase} onChange={(e) => setFormData({...formData, dateOfPurchase: e.target.value})} />
              
              <button type="submit" className={`w-full py-3 rounded-lg font-bold text-white shadow-md transition active:scale-95 ${editMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-900 hover:bg-red-800'}`}>
                {editMode ? 'UPDATE RECORD' : 'SAVE RECORD'}
              </button>
              
              {editMode && (
                <button type="button" onClick={() => { 
                  setEditMode(null); 
                  setFormData({ buyerName: '', address: '', quantity: '', pricePerChicken: '', dateOfPurchase: new Date().toISOString().split('T')[0] }); 
                }} className="w-full text-xs text-gray-500 hover:underline mt-2">
                  Cancel Editing
                </button>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT: HISTORY */}
        <div className="lg:col-span-2">
          <div className="flex justify-between border-b-2 border-red-900 mb-6 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-red-900">Sales History (Current Batch)</h2>
            {sales.length > 0 && (
              <span className="font-bold text-gray-900">Total: ₱{sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0).toLocaleString()}</span>
            )}
          </div>
          
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-10 text-gray-400">Loading records...</div>
            ) : sales.length === 0 ? (
              <div className="text-center py-10 text-gray-400 italic">No sales recorded for this batch.</div>
            ) : sales.map((sale) => (
              <div key={sale.id} className="bg-white rounded-xl border p-5 flex flex-col md:flex-row justify-between items-center gap-4 hover:shadow-md transition">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-500">{sale.dateOfPurchase}</span>
                    <h3 className="font-bold text-gray-900 uppercase tracking-tight">{sale.buyerName}</h3>
                  </div>
                  <p className="text-xs text-gray-400">{sale.address}</p>
                  <p className="text-sm font-bold text-red-900 mt-1">₱{sale.totalAmount?.toLocaleString()} <span className="text-[10px] text-gray-400 font-normal">({sale.quantity} chickens)</span></p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(sale)} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded hover:bg-blue-100">EDIT</button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: sale.id })} className="text-[10px] font-bold text-red-600 bg-red-50 px-4 py-2 rounded hover:bg-red-100">DELETE</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Records;