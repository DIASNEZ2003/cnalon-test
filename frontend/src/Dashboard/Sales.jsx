import React, { useState, useEffect } from 'react';
import { auth } from '../firebase';
import { 
  ShoppingBag, MapPin, Calendar, DollarSign, 
  User, Edit2, Trash2, PlusCircle, Check, 
  AlertTriangle, Hash, Search, X, Filter, BarChart3
} from 'lucide-react';

// --- SUCCESS MODAL ---
const SuccessModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[140] animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 text-center border border-gray-100">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-50 mb-4 border border-green-100">
          <Check className="h-6 w-6 text-green-600" />
        </div>
        <h3 className="text-lg font-black text-gray-800 mb-1 uppercase">Success</h3>
        <p className="text-xs text-gray-500 mb-6 font-medium">{message}</p>
        <button onClick={onClose} className="w-full bg-[#3B0A0A] text-white text-xs font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all active:scale-95">CONTINUE</button>
      </div>
    </div>
  );
};

// --- CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  let title = type === 'create' ? "Save Sale?" : "Delete Record?";
  let buttonColor = type === 'create' ? "bg-green-600" : "bg-red-600"; 
  let icon = type === 'create' ? <Check className="h-6 w-6 text-green-600" /> : <Trash2 className="h-6 w-6 text-red-600" />;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs border border-gray-100 text-center">
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-gray-50 mb-3 border`}>{icon}</div>
        <h3 className="text-lg font-black text-gray-800 mb-1 uppercase tracking-tight">{title}</h3>
        <p className="text-[11px] text-gray-500 mb-6 leading-relaxed">Verify these details before updating the batch records.</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-[10px] uppercase">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase shadow-lg ${buttonColor}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const Sales = () => {
  const [sales, setSales] = useState([]);
  const [activeBatchId, setActiveBatchId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
    
    if (!activeBatchId && type === 'create') return;

    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();

      if (type === 'create') {
        const url = editMode ? `${backendUrl}/edit-sale` : `${backendUrl}/add-sale`;
        const method = editMode ? "PUT" : "POST";
        
        const body = { 
          ...formData, 
          batchId: activeBatchId,
          quantity: parseInt(formData.quantity),
          pricePerChicken: parseFloat(formData.pricePerChicken)
        };
        if(editMode) body.saleId = editMode;
        
        const response = await fetch(url, {
          method: method,
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify(body)
        });

        if (response.ok) {
          setSuccessMessage(editMode ? "Transaction Updated!" : "Sale Recorded Successfully!");
          setFormData({ buyerName: '', address: '', quantity: '', pricePerChicken: '', dateOfPurchase: new Date().toISOString().split('T')[0] });
          setEditMode(null);
          setIsAddModalOpen(false);
          fetchData();
        }
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-sale/${activeBatchId}/${targetId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        fetchData();
      }
    } catch (e) { console.error(e); }
  };

  const startEdit = (sale) => {
    setEditMode(sale.id);
    setFormData({
      buyerName: sale.buyerName,
      address: sale.address,
      quantity: sale.quantity.toString(),
      pricePerChicken: sale.pricePerChicken.toString(),
      dateOfPurchase: sale.dateOfPurchase
    });
    setIsAddModalOpen(true);
  };

  const filteredSales = sales.filter(s => 
    s.buyerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + (parseFloat(s.totalAmount) || 0), 0);

  return (
    <div className="bg-gray-50 h-full w-full p-6 animate-fade-in font-sans text-gray-800">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={handleAction} />

      {/* --- TOP ACTION BAR --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2.5 bg-red-50 rounded-xl">
            <ShoppingBag size={22} className="text-[#3B0A0A]" />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Search buyer..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-900 outline-none text-xs transition-all font-medium"
            />
          </div>
        </div>
        
        <button 
          onClick={() => { setEditMode(null); setFormData({ buyerName: '', address: '', quantity: '', pricePerChicken: '', dateOfPurchase: new Date().toISOString().split('T')[0] }); setIsAddModalOpen(true); }}
          className="bg-[#3B0A0A] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-900 transition-all flex items-center gap-2 shadow-lg active:scale-95"
        >
          <PlusCircle size={16} /> Add Sale Record
        </button>
      </div>

      {/* --- REVENUE SUMMARY BANNER --- */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 mb-6 flex justify-between items-center shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
          <BarChart3 size={120} />
        </div>
        <div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Active Batch Revenue</span>
          <h2 className="text-sm font-bold text-gray-500 uppercase">Sales Performance Summary</h2>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-black text-green-600 uppercase tracking-widest opacity-70">Total Collections</span>
          <span className="text-4xl font-black text-[#3B0A0A]">₱{totalSalesAmount.toLocaleString()}</span>
        </div>
      </div>

      {/* --- DATA TABLE --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Buyer Info</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Volume</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Rate</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Gross Total</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="5" className="py-20 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B0A0A] mx-auto"></div></td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan="5" className="py-20 text-center text-gray-300 text-xs font-medium uppercase tracking-widest">No sales recorded yet</td></tr>
              ) : filteredSales.map((sale) => (
                <tr key={sale.id} className="hover:bg-gray-50/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-800">{sale.buyerName}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <MapPin size={10} className="text-gray-300" />
                        <span className="text-[10px] text-gray-400 font-medium truncate max-w-[150px]">{sale.address}</span>
                        <span className="text-[10px] text-gray-300">•</span>
                        <span className="text-[10px] text-gray-400 font-medium">{sale.dateOfPurchase}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-bold text-gray-700 bg-gray-50 px-3 py-1 rounded-lg border border-gray-100">{sale.quantity} Head(s)</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs font-bold text-gray-500">₱{parseFloat(sale.pricePerChicken).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-green-700">₱{sale.totalAmount?.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => startEdit(sale)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: sale.id })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD/EDIT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 animate-fade-in">
            <div className={`p-4 flex justify-between items-center text-white ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/10 rounded-lg">{editMode ? <Edit2 size={18}/> : <PlusCircle size={18}/>}</div>
                <h2 className="font-bold text-sm tracking-tight uppercase">{editMode ? "Edit Record" : "New Sale Entry"}</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="hover:rotate-90 transition-transform duration-200"><X size={20} /></button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); setConfirmModal({isOpen: true, type: 'create'}); }} className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1 tracking-widest">Buyer Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 text-gray-400" size={14} />
                  <input type="text" required value={formData.buyerName} onChange={(e) => setFormData({...formData, buyerName: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 pl-9 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" placeholder="Customer name" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1 tracking-widest">Delivery Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 text-gray-400" size={14} />
                  <input type="text" required value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 pl-9 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" placeholder="Location" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1 tracking-widest">Quantity (Heads)</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-2.5 text-gray-400" size={14} />
                    <input type="number" required value={formData.quantity} onChange={(e) => setFormData({...formData, quantity: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 pl-9 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" placeholder="0" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1 tracking-widest">Price / Bird</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 text-gray-400" size={14} />
                    <input type="number" required value={formData.pricePerChicken} onChange={(e) => setFormData({...formData, pricePerChicken: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 pl-9 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" placeholder="0.00" />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1 tracking-widest">Date of Transaction</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-gray-400" size={14} />
                  <input type="date" required value={formData.dateOfPurchase} onChange={(e) => setFormData({...formData, dateOfPurchase: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 pl-9 text-xs outline-none font-bold" />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-gray-50 text-gray-500 font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-gray-100">Cancel</button>
                <button type="submit" className={`flex-1 text-white font-bold py-3 rounded-xl text-[10px] uppercase shadow-lg active:scale-95 ${editMode ? 'bg-blue-600' : 'bg-[#3B0A0A]'}`}>
                  {editMode ? "Update" : "Save Record"}
                </button>
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

export default Sales;