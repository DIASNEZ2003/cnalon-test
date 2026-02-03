import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  ShoppingBag, MapPin, Calendar, DollarSign, 
  User, Edit2, Trash2, PlusCircle, Check, 
  AlertTriangle, FileText, Hash 
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
    title = "Save Sales Record?";
    message = "Please verify the buyer details and amount before saving.";
    buttonColor = "bg-green-600 hover:bg-green-700";
    icon = <Check className="h-8 w-8 text-green-600" />;
    buttonText = "Yes, Save Record";
  } else if (type === 'delete') {
    title = "Delete Record?";
    message = "This action cannot be undone. This sale will be removed from calculations.";
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

// --- MAIN COMPONENT ---
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

  useEffect(() => { 
    const unsubscribe = auth.onAuthStateChanged((user) => {
        if(user) fetchData();
    });
    return () => unsubscribe();
  }, []);

  const handleAction = async () => {
    const { type, targetId } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, targetId: null });
    
    if (!activeBatchId && type === 'create') {
      alert("Error: No active batch found. Please create a batch first.");
      return;
    }

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();

      if (type === 'create') {
        const url = editMode ? `${backendUrl}/edit-sale` : `${backendUrl}/add-sale`;
        const method = editMode ? "PUT" : "POST";
        
        const body = editMode 
          ? { ...formData, saleId: editMode, batchId: activeBatchId } 
          : { ...formData, batchId: activeBatchId };
        
        const response = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          setSuccessMessage(editMode ? "Record Updated!" : "Sales Recorded!");
          setFormData({ buyerName: '', address: '', quantity: '', pricePerChicken: '', dateOfPurchase: new Date().toISOString().split('T')[0] });
          setEditMode(null);
          fetchData();
        }
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-sale/${activeBatchId}/${targetId}`, {
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

  const totalSalesAmount = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  return (
    <div className="bg-gray-50 min-h-full font-sans text-gray-800 p-4">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={handleAction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT: FORM PANEL */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 sticky top-4">
            
            {/* Header */}
            <div className={`p-5 ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <PlusCircle className="text-white h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide">{editMode ? 'Edit Transaction' : 'New Sales Record'}</h2>
                  <p className="text-white/60 text-xs">Log chicken sales details</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); setConfirmModal({ isOpen: true, type: 'create' }); }} className="p-6 space-y-4">
              
              {/* Buyer Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Buyer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input 
                    type="text" required 
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-10 p-3 outline-none font-bold"
                    value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} 
                  />
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input 
                    type="text" required 
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-10 p-3 outline-none font-medium"
                    value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Quantity */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Quantity (Heads)</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                    <input 
                      type="number" required 
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-10 p-3 outline-none font-bold"
                      value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} 
                    />
                  </div>
                </div>
                {/* Price */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Price / Head</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                    <input 
                      type="number" required 
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-10 p-3 outline-none font-bold"
                      value={formData.pricePerChicken} onChange={(e) => setFormData({...formData, pricePerChicken: e.target.value})} 
                    />
                  </div>
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Date of Sale</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input 
                    type="date" required 
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-10 p-3 outline-none font-medium"
                    value={formData.dateOfPurchase} onChange={(e) => setFormData({...formData, dateOfPurchase: e.target.value})} 
                  />
                </div>
              </div>
              
              <button type="submit" className={`w-full mt-4 text-white font-bold rounded-xl px-5 py-4 text-center transition-all shadow-lg active:scale-95 uppercase tracking-wide ${editMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-[#3B0A0A] hover:bg-red-900'}`}>
                {editMode ? 'UPDATE RECORD' : 'SAVE SALES RECORD'}
              </button>
              
              {editMode && (
                <button type="button" onClick={() => { 
                  setEditMode(null); 
                  setFormData({ buyerName: '', address: '', quantity: '', pricePerChicken: '', dateOfPurchase: new Date().toISOString().split('T')[0] }); 
                }} className="w-full text-xs font-bold text-gray-500 hover:text-[#3B0A0A] text-center mt-2">
                  CANCEL EDITING
                </button>
              )}
            </form>
          </div>
        </div>

        {/* RIGHT: HISTORY */}
        <div className="lg:col-span-2">
          
          <div className="flex items-center justify-between border-b border-gray-200 mb-6 pb-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#3B0A0A]">
              <ShoppingBag className="h-5 w-5" /> Sales History
            </h2>
            <div className="text-right">
              <span className="block text-[10px] font-bold text-gray-400 uppercase">Total Revenue</span>
              <span className="text-xl font-black text-[#3B0A0A]">₱{totalSalesAmount.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="space-y-4">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3B0A0A]"></div>
              </div>
            ) : sales.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
                <ShoppingBag className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-400">No Sales Found</h3>
                <p className="text-sm text-gray-400 mt-1">Transactions will appear here.</p>
              </div>
            ) : sales.map((sale) => (
              <div key={sale.id} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col md:flex-row justify-between items-center gap-4 overflow-hidden">
                
                <div className="p-5 flex-1 w-full">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="flex items-center gap-1 text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-1 rounded-md uppercase">
                      <Calendar size={12} /> {sale.dateOfPurchase}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-gray-800 text-lg uppercase tracking-tight leading-none mb-1">{sale.buyerName}</h3>
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
                        <MapPin size={12} /> {sale.address}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-[#3B0A0A]">₱{sale.totalAmount?.toLocaleString()}</p>
                      <p className="text-xs font-bold text-gray-400">{sale.quantity} heads @ ₱{sale.pricePerChicken}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 border-t md:border-t-0 md:border-l border-gray-100 flex md:flex-col gap-2 w-full md:w-auto">
                  <button 
                    onClick={() => startEdit(sale)} 
                    className="flex-1 md:w-24 flex items-center justify-center gap-1 text-[10px] font-black text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors uppercase"
                  >
                    <Edit2 size={12} /> Edit
                  </button>
                  <button 
                    onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: sale.id })} 
                    className="flex-1 md:w-24 flex items-center justify-center gap-1 text-[10px] font-black text-red-600 bg-red-50 hover:bg-red-100 py-2 rounded-lg transition-colors uppercase"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
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