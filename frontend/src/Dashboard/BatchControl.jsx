import React, { useState, useEffect } from 'react';
import { auth } from '../firebase'; 
import { 
  Calendar, Users, ClipboardList, 
  Archive, Trash2, CheckCircle, PlusCircle, 
  AlertTriangle, Check, Search, X, Filter, Edit2, Play
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
        <h3 className="text-lg font-black text-gray-800 mb-1">Success</h3>
        <p className="text-xs text-gray-500 mb-6 font-medium">{message}</p>
        <button 
          onClick={onClose}
          className="w-full bg-[#3B0A0A] text-white text-xs font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all active:scale-95"
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

  let config = {
    title: "Confirm Action",
    message: "Are you sure?",
    btnColor: "bg-red-600",
    icon: <AlertTriangle className="h-6 w-6 text-orange-500" />,
    iconBg: "bg-orange-50",
    btnText: "Confirm"
  };

  if (type === 'create' || type === 'update') {
    config = {
      title: type === 'create' ? "Start New Batch?" : "Save Changes?",
      message: "Please verify all details before proceeding. Status will be auto-assigned.",
      btnColor: "bg-green-600",
      icon: <PlusCircle className="h-6 w-6 text-green-600" />,
      iconBg: "bg-green-50",
      btnText: type === 'create' ? "Create" : "Save Changes"
    };
  } else if (type === 'activate') {
    config = {
      title: "Set as Active?",
      message: "This will set this batch as the ACTIVE production cycle. Any other currently active batch will be switched to INACTIVE.",
      btnColor: "bg-green-600",
      icon: <Play className="h-6 w-6 text-green-600" />,
      iconBg: "bg-green-50",
      btnText: "Activate Batch"
    };
  } else if (type === 'complete') {
    config = {
      title: "Archive Batch?",
      message: "This moves the batch to history and automatically activates the next waiting batch.",
      btnColor: "bg-blue-600",
      icon: <Archive className="h-6 w-6 text-blue-600" />,
      iconBg: "bg-blue-50",
      btnText: "Archive"
    };
  } else if (type === 'delete') {
    config = {
      title: "Delete Record?",
      message: "This is permanent. All related sales and expenses will be deleted.",
      btnColor: "bg-red-600",
      icon: <Trash2 className="h-6 w-6 text-red-600" />,
      iconBg: "bg-red-50",
      btnText: "Delete"
    };
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-xs border border-gray-100 text-center">
        <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full ${config.iconBg} mb-3 border`}>
          {config.icon}
        </div>
        <h3 className="text-lg font-black text-gray-800 mb-1">{config.title}</h3>
        <p className="text-[11px] text-gray-500 mb-6 leading-relaxed px-2">{config.message}</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-[10px] uppercase">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 text-white font-bold py-2.5 rounded-xl text-[10px] uppercase shadow-lg ${config.btnColor}`}>{config.btnText}</button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const BatchControl = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); 
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTargetId, setEditTargetId] = useState(null);

  const [successMessage, setSuccessMessage] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [formData, setFormData] = useState({ batchName: '', dateCreated: '', expectedCompleteDate: '', startingPopulation: '', status: 'active' });

  const backendUrl = "http://localhost:8000";

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/get-batches`, { headers: { "Authorization": `Bearer ${token}` } });
      if (response.ok) {
        let data = await response.json();
        setBatches(data);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => { if (user) fetchBatches(); });
    return () => unsubscribe();
  }, []);

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    let calculatedEndDate = formData.expectedCompleteDate; 
    if (newDate) {
      const dateObj = new Date(newDate);
      dateObj.setDate(dateObj.getDate() + 30); 
      calculatedEndDate = dateObj.toISOString().split('T')[0]; 
    }
    setFormData({ ...formData, dateCreated: newDate, expectedCompleteDate: calculatedEndDate });
  };

  const handleEditClick = (batch) => {
    setFormData({
      batchName: batch.batchName,
      dateCreated: batch.dateCreated,
      expectedCompleteDate: batch.expectedCompleteDate,
      startingPopulation: batch.startingPopulation,
      status: batch.status
    });
    setEditTargetId(batch.id);
    setIsEditing(true);
    setIsAddModalOpen(true);
  };

  const performAction = async () => {
    const { type, targetId } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, targetId: null });
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();

      if (type === 'create') {
        const response = await fetch(`${backendUrl}/create-batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ ...formData, startingPopulation: parseInt(formData.startingPopulation), vitaminBudget: 0 })
        });
        if (response.ok) setSuccessMessage("Batch created successfully!");
      } else if (type === 'update') {
        const response = await fetch(`${backendUrl}/update-batch/${editTargetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ ...formData, startingPopulation: parseInt(formData.startingPopulation) })
        });
        if (response.ok) setSuccessMessage("Batch updated successfully!");
      } else if (type === 'activate') {
        await fetch(`${backendUrl}/update-batch/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ status: "active" })
        });
        setSuccessMessage("Batch is now ACTIVE!");
      } else if (type === 'complete') {
        await fetch(`${backendUrl}/update-batch/${targetId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ status: "completed" })
        });
        setSuccessMessage("Batch archived!");
      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-batch/${targetId}`, { method: "DELETE", headers: { "Authorization": `Bearer ${token}` } });
        setSuccessMessage("Batch deleted permanently.");
      }

      setFormData({ batchName: '', dateCreated: '', expectedCompleteDate: '', startingPopulation: '', status: 'active' });
      setIsAddModalOpen(false);
      setIsEditing(false);
      fetchBatches();
    } catch (error) { console.error(error); }
  };

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.batchName.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = false;
    if (statusFilter === "all") {
      matchesStatus = true;
    } else if (statusFilter === "not_active") {
      matchesStatus = batch.status !== "active";
    } else {
      matchesStatus = batch.status === statusFilter;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-gray-50 min-h-full font-sans text-gray-800 p-6 animate-fade-in">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        type={confirmModal.type} 
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        onConfirm={performAction} 
      />

      {/* --- HEADER & SEARCH BAR --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2.5 bg-red-50 rounded-xl">
            <ClipboardList size={22} className="text-[#3B0A0A]" />
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Search batch..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-900 outline-none text-xs transition-all font-medium"
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
            <Filter size={14} className="text-gray-400" />
            <select 
              className="bg-transparent text-[11px] font-bold outline-none cursor-pointer" 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="active">Active</option>
              <option value="not_active">Not Active</option>
              <option value="completed">Archived</option>
              <option value="all">All Records</option>
            </select>
          </div>
          <button 
            onClick={() => { setIsEditing(false); setFormData({batchName: '', dateCreated: '', expectedCompleteDate: '', startingPopulation: '', status: 'active'}); setIsAddModalOpen(true); }} 
            className="bg-[#3B0A0A] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-900 transition-all flex items-center gap-2 shadow-lg shadow-red-900/20 active:scale-95"
          >
            <PlusCircle size={16} /> New Batch
          </button>
        </div>
      </div>

      {/* --- MAIN TABLE --- */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Batch Identity</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Population</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="4" className="py-20 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B0A0A] mx-auto"></div></td></tr>
              ) : filteredBatches.length === 0 ? (
                <tr><td colSpan="4" className="py-20 text-center text-gray-300 text-xs font-medium uppercase tracking-widest">No matching records</td></tr>
              ) : filteredBatches.map((batch) => (
                <tr key={batch.id} className="hover:bg-gray-50/40 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-gray-800">{batch.batchName}</span>
                      <span className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5 font-medium">
                        <Calendar size={10} /> {batch.dateCreated} — {batch.expectedCompleteDate || "TBD"}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-600 bg-gray-50 w-fit px-3 py-1 rounded-lg border border-gray-100">
                      <Users size={12} className="text-gray-400" /> {batch.startingPopulation}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                      batch.status === 'active' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-gray-100 text-gray-500 border border-gray-200'
                    }`}>
                      {batch.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      
                      {/* --- NEW: SET ACTIVE BUTTON (Visible only if NOT Active) --- */}
                      {batch.status !== 'active' && (
                        <button 
                          onClick={() => setConfirmModal({ isOpen: true, type: 'activate', targetId: batch.id })} 
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors" 
                          title="Set Active"
                        >
                          <Play size={16} />
                        </button>
                      )}

                      <button onClick={() => handleEditClick(batch)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit2 size={16} /></button>
                      
                      {batch.status === 'active' && (
                        <button onClick={() => setConfirmModal({ isOpen: true, type: 'complete', targetId: batch.id })} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Archive"><CheckCircle size={16} /></button>
                      )}
                      
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: batch.id })} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- COMPACT ADD/EDIT MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 animate-fade-in">
            <div className="bg-[#3B0A0A] p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/10 rounded-lg">{isEditing ? <Edit2 size={18}/> : <PlusCircle size={18}/>}</div>
                <h2 className="font-bold text-sm tracking-tight">{isEditing ? "Edit Batch Record" : "New Production Batch"}</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="hover:rotate-90 transition-transform duration-200"><X size={20} /></button>
            </div>
            
            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                setConfirmModal({ isOpen: true, type: isEditing ? 'update' : 'create', targetId: null }); 
              }} 
              className="p-5 space-y-4"
            >
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Batch Name</label>
                <input 
                  type="text" required placeholder="Emter Name" value={formData.batchName} 
                  onChange={(e) => setFormData({...formData, batchName: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold transition-all" 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Start Date</label>
                  <input 
                    type="date" required value={formData.dateCreated} onChange={handleDateChange} 
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2 text-xs outline-none" 
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Harvest Target</label>
                  <input 
                    type="date" required value={formData.expectedCompleteDate} 
                    onChange={(e) => setFormData({...formData, expectedCompleteDate: e.target.value})} 
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2 text-xs outline-none" 
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Starting Population</label>
                <input 
                  type="number" required placeholder="0" value={formData.startingPopulation} 
                  onChange={(e) => setFormData({...formData, startingPopulation: e.target.value})} 
                  className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" 
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)} 
                  className="flex-1 bg-gray-50 text-gray-500 font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-[#3B0A0A] text-white font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-red-900 transition-all shadow-lg active:scale-95"
                >
                  {isEditing ? "Update Batch" : "Start Batch"}
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

export default BatchControl;