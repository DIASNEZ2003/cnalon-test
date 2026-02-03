import React, { useState, useEffect } from 'react';
import { auth } from '../firebase'; 
import { 
  Calendar, Users, ClipboardList, 
  Archive, Trash2, CheckCircle, PlusCircle, 
  AlertTriangle, Check, Layers 
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
          className="w-full bg-[#3B0A0A] text-white font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all shadow-lg shadow-red-900/20 active:scale-95"
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
  let iconBg = "bg-orange-50 border-orange-100";
  let buttonText = "Confirm";

  if (type === 'create') {
    title = "Start New Batch?";
    message = "This will initialize a new tracking cycle. Please verify the details.";
    buttonColor = "bg-green-600 hover:bg-green-700 shadow-green-600/30";
    icon = <PlusCircle className="h-8 w-8 text-green-600" />;
    iconBg = "bg-green-50 border-green-100";
    buttonText = "Yes, Create Batch";
  } else if (type === 'complete') {
    title = "Complete Batch?";
    message = "This will move the batch to the archives. You won't be able to add new daily records.";
    buttonColor = "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30";
    icon = <Archive className="h-8 w-8 text-blue-600" />;
    iconBg = "bg-blue-50 border-blue-100";
    buttonText = "Yes, Archive It";
  } else if (type === 'delete') {
    title = "Delete Permanently?";
    message = "This action cannot be undone. All expenses and sales records for this batch will be lost.";
    buttonColor = "bg-red-600 hover:bg-red-700 shadow-red-600/30";
    icon = <Trash2 className="h-8 w-8 text-red-600" />;
    iconBg = "bg-red-50 border-red-100";
    buttonText = "Yes, Delete It";
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110]">
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-96 border border-gray-100">
        <div className={`mx-auto flex items-center justify-center h-16 w-16 rounded-full ${iconBg} mb-4 border`}>
          {icon}
        </div>
        <h3 className="text-xl font-black text-gray-800 text-center mb-2 tracking-tight">{title}</h3>
        <p className="text-sm text-gray-500 text-center mb-8 px-4">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onCancel}
            className="flex-1 bg-gray-100 text-gray-700 font-bold px-4 py-3 rounded-xl hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`flex-1 text-white font-bold px-4 py-3 rounded-xl transition-all shadow-lg ${buttonColor}`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---
const BatchControl = () => {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('active'); 

  const [successMessage, setSuccessMessage] = useState('');
  
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: null, 
    targetId: null 
  });

  const [formData, setFormData] = useState({
    batchName: '',
    dateCreated: '',
    expectedCompleteDate: '',
    startingPopulation: ''
  });

  const backendUrl = "http://localhost:8000";

  // --- DATA FETCHING ---
  const fetchBatches = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();

      const response = await fetch(`${backendUrl}/get-batches`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (response.ok) {
        let data = await response.json();

        // Check for Auto-Complete based on Date
        const today = new Date();
        today.setHours(0, 0, 0, 0); 

        const processedData = await Promise.all(data.map(async (batch) => {
          if (batch.status === 'active' && batch.expectedCompleteDate) {
            const targetDate = new Date(batch.expectedCompleteDate);
            targetDate.setHours(0, 0, 0, 0);

            if (today >= targetDate) {
              try {
                await fetch(`${backendUrl}/update-batch/${batch.id}`, {
                  method: "PUT",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                  },
                  body: JSON.stringify({ status: "completed" })
                });
                return { ...batch, status: "completed" };
              } catch (err) {
                console.error("Auto-complete failed for batch:", batch.batchName);
                return batch;
              }
            }
          }
          return batch; 
        }));

        setBatches(processedData);
      }
    } catch (error) {
      console.error("Error fetching batches:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchBatches();
      }
    });
    return () => unsubscribe();
  }, []);

  // --- HANDLERS ---
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    let calculatedEndDate = formData.expectedCompleteDate; 
    
    if (newDate) {
      const dateObj = new Date(newDate);
      dateObj.setDate(dateObj.getDate() + 30); 
      calculatedEndDate = dateObj.toISOString().split('T')[0]; 
    }

    setFormData({
      ...formData,
      dateCreated: newDate,
      expectedCompleteDate: calculatedEndDate
    });
  };

  const requestCreate = (e) => {
    e.preventDefault();
    setConfirmModal({ isOpen: true, type: 'create', targetId: null });
  };

  const requestComplete = (id) => {
    setConfirmModal({ isOpen: true, type: 'complete', targetId: id });
  };

  const requestDelete = (id) => {
    setConfirmModal({ isOpen: true, type: 'delete', targetId: id });
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
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({
            batchName: formData.batchName,
            dateCreated: formData.dateCreated,
            expectedCompleteDate: formData.expectedCompleteDate,
            startingPopulation: parseInt(formData.startingPopulation),
            vitaminBudget: 0 // Default to 0 since removed from UI
          })
        });

        if (response.ok) {
          setFormData({ batchName: '', dateCreated: '', expectedCompleteDate: '', startingPopulation: '' });
          fetchBatches();
          setSuccessMessage("Batch created successfully!"); 
        }

      } else if (type === 'complete') {
        await fetch(`${backendUrl}/update-batch/${targetId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify({ status: "completed" })
        });
        fetchBatches();
        setSuccessMessage("Batch successfully moved to history!");

      } else if (type === 'delete') {
        await fetch(`${backendUrl}/delete-batch/${targetId}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        fetchBatches();
        setSuccessMessage("Batch deleted successfully!");
      }

    } catch (error) {
      console.error(`Error performing ${type}:`, error);
    }
  };

  const activeBatches = batches.filter(b => b.status === 'active');
  const historyBatches = batches.filter(b => b.status === 'completed');
  const currentList = view === 'active' ? activeBatches : historyBatches;

  return (
    <div className="bg-gray-50 min-h-full font-sans text-gray-800 p-4">
      
      {/* --- MODALS --- */}
      <SuccessModal 
        message={successMessage} 
        onClose={() => setSuccessMessage('')} 
      />
      <ConfirmModal 
        isOpen={confirmModal.isOpen} 
        type={confirmModal.type}
        onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
        onConfirm={performAction} 
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT PANEL: CREATE BATCH FORM --- */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 sticky top-4">
            
            {/* Header */}
            <div className="bg-[#3B0A0A] p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <PlusCircle className="text-white h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide">Initialize Batch</h2>
                  <p className="text-white/60 text-xs">Start a new production cycle</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={requestCreate} className="p-6 space-y-5">
              
              {/* Batch Name */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block pl-1">Batch Identifier</label>
                <div className="relative">
                  <ClipboardList className="absolute left-3 top-3 text-gray-400 h-5 w-5" />
                  <input 
                    type="text" 
                    required
                    placeholder="Batch Name"
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-red-900 focus:border-red-900 block pl-10 p-3 outline-none font-bold"
                    value={formData.batchName}
                    onChange={(e) => setFormData({...formData, batchName: e.target.value})}
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block pl-1">Start Date</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      required
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-red-900 focus:border-red-900 block p-3 outline-none font-medium"
                      value={formData.dateCreated}
                      onChange={handleDateChange}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block pl-1">Target Harvest</label>
                  <div className="relative">
                    <input 
                      type="date" 
                      required
                      className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-red-900 focus:border-red-900 block p-3 outline-none font-medium"
                      value={formData.expectedCompleteDate}
                      onChange={(e) => setFormData({...formData, expectedCompleteDate: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Population (Full Width Now) */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block pl-1">Population</label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input 
                    type="number" 
                    required
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-red-900 focus:border-red-900 block pl-9 p-3 outline-none font-bold"
                    value={formData.startingPopulation}
                    onChange={(e) => setFormData({...formData, startingPopulation: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full mt-2 text-white bg-[#3B0A0A] hover:bg-red-900 focus:ring-4 focus:ring-red-300 font-bold rounded-xl text-sm px-5 py-4 text-center transition-all shadow-lg hover:shadow-xl active:scale-95 uppercase tracking-wide"
              >
                Create Batch Record
              </button>
            </form>
          </div>
        </div>

        {/* --- RIGHT PANEL: BATCH LIST --- */}
        <div className="lg:col-span-2">
          
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6 gap-6">
            <button 
              onClick={() => setView('active')}
              className={`pb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide transition-all border-b-4 ${view === 'active' ? 'border-[#3B0A0A] text-[#3B0A0A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <CheckCircle size={16} /> Active Operations
            </button>
            <button 
              onClick={() => setView('history')}
              className={`pb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide transition-all border-b-4 ${view === 'history' ? 'border-[#3B0A0A] text-[#3B0A0A]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              <Archive size={16} /> Archived History
            </button>
          </div>

          {loading && (
            <div className="flex justify-center items-center py-20">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3B0A0A]"></div>
            </div>
          )}

          {!loading && currentList.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
              <div className="mx-auto w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <ClipboardList className="text-gray-300 h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-400">No Records Found</h3>
              <p className="text-sm text-gray-400 mt-1">There are no {view} batches at the moment.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {currentList.map((batch) => (
              <div key={batch.id} className="group bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden">
                
                {/* Card Body */}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${batch.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        <Layers size={20} className={batch.status === 'active' ? 'text-green-700' : 'text-gray-500'} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-gray-800 group-hover:text-[#3B0A0A] transition-colors leading-none">
                          {batch.batchName}
                        </h3>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${batch.status === 'active' ? 'text-green-600' : 'text-gray-400'}`}>
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Population Only - Budget Removed */}
                  <div className="mb-4">
                    <div className="bg-gray-50 p-3 rounded-xl flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block">Population</span>
                      <span className="text-lg font-black text-gray-800">{batch.startingPopulation}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-gray-400 font-bold mr-2">START:</span>
                      <span className="font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{batch.dateCreated}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 font-bold mr-2">END:</span>
                      <span className="font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{batch.expectedCompleteDate || "N/A"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="bg-gray-50 p-4 border-t border-gray-100 flex gap-3">
                   {view === 'active' && (
                    <button 
                      onClick={() => requestComplete(batch.id)}
                      className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-white bg-green-600 hover:bg-green-700 py-3 rounded-xl shadow-sm transition-colors uppercase tracking-wide"
                    >
                      <CheckCircle size={14} /> Finish
                    </button>
                  )}
                  <button 
                    onClick={() => requestDelete(batch.id)}
                    className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 py-3 rounded-xl shadow-sm transition-colors uppercase tracking-wide"
                  >
                    <Trash2 size={14} /> Delete
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

export default BatchControl;