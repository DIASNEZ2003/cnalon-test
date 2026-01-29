import React, { useState, useEffect } from 'react';
import { auth } from '../firebase'; 

// --- INTERNAL COMPONENT: SUCCESS MODAL ---
const SuccessModal = ({ message, onClose }) => {
  if (!message) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 w-96 transform transition-all scale-100 text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
          <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Success</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <button 
          onClick={onClose}
          className="w-full bg-red-900 text-white rounded-md px-4 py-2 hover:bg-red-800 transition focus:outline-none"
        >
          OK
        </button>
      </div>
    </div>
  );
};

// --- INTERNAL COMPONENT: DYNAMIC CONFIRMATION MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;

  let title = "Confirm Action";
  let message = "Are you sure you want to proceed?";
  let buttonColor = "bg-red-600 hover:bg-red-700"; 
  let buttonText = "Confirm";

  if (type === 'create') {
    title = "Confirm Batch Creation";
    message = "Are you sure you want to create this new batch? Please verify the dates, budget, and population.";
    buttonColor = "bg-green-600 hover:bg-green-700";
    buttonText = "Yes, Create";
  } else if (type === 'complete') {
    title = "Confirm Completion";
    message = "Are you sure you want to mark this batch as completed? It will be moved to the history archive.";
    buttonColor = "bg-green-500 hover:bg-yellow-600";
    buttonText = "Yes, Complete";
  } else if (type === 'delete') {
    title = "Confirm Deletion";
    message = "Are you sure you want to delete this batch permanently? This action cannot be undone.";
    buttonColor = "bg-red-600 hover:bg-red-700";
    buttonText = "Yes, Delete";
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button 
            onClick={onCancel}
            className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition"
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm}
            className={`text-white px-4 py-2 rounded transition ${buttonColor}`}
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

  // --- MODAL STATES ---
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
    startingPopulation: '',
    vitaminBudget: ''
  });

  const backendUrl = "http://localhost:8000";

  // --- DATA FETCHING & AUTO COMPLETE LOGIC ---
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
    fetchBatches();
  }, []);

  // --- AUTO DATE CALCULATION ---
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

  // --- ACTION INITIATORS ---

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

  // --- EXECUTE CONFIRMED ACTION ---
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
            vitaminBudget: parseFloat(formData.vitaminBudget || 0) // Integrated budget data
          })
        });

        if (response.ok) {
          setFormData({ batchName: '', dateCreated: '', expectedCompleteDate: '', startingPopulation: '', vitaminBudget: '' });
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
    <div className="bg-gray-50 min-h-full font-sans text-gray-800 relative">
      
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

      {/* --- LAYOUT GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT PANEL: FORM --- */}
        <div className="lg:col-span-1 min-w-[300px]">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
            <div className="bg-red-900 p-4">
              <h2 className="text-white font-bold text-lg tracking-wide">Initialize Batch</h2>
            </div>
            
            <form onSubmit={requestCreate} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Batch Identifier</label>
                <input 
                  type="text" 
                  required
                  className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-900 focus:border-red-900 block p-2.5 outline-none transition-colors"
                  value={formData.batchName}
                  onChange={(e) => setFormData({...formData, batchName: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Date</label>
                  <input 
                    type="date" 
                    required
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-900 focus:border-red-900 block p-2.5 outline-none"
                    value={formData.dateCreated}
                    onChange={handleDateChange}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Est. Harvest</label>
                  <input 
                    type="date" 
                    required
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-900 focus:border-red-900 block p-2.5 outline-none"
                    value={formData.expectedCompleteDate}
                    onChange={(e) => setFormData({...formData, expectedCompleteDate: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Initial Population</label>
                  <input 
                    type="number" 
                    required
                    className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-900 focus:border-red-900 block p-2.5 outline-none"
                    value={formData.startingPopulation}
                    onChange={(e) => setFormData({...formData, startingPopulation: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Vitamins Budget (₱)</label>
                  <input 
                    type="number" 
                    required
                    placeholder=""
                    className="w-fullbg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-900 focus:border-red-900 block p-2.5 outline-none"
                    value={formData.vitaminBudget}
                    onChange={(e) => setFormData({...formData, vitaminBudget: e.target.value})}
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full mt-4 text-white bg-red-900 hover:bg-red-800 focus:ring-4 focus:ring-red-300 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all shadow-md hover:shadow-lg"
              >
                Create Batch Record
              </button>
            </form>
          </div>
        </div>

        {/* --- RIGHT PANEL: LIST --- */}
        <div className="lg:col-span-2">
          
          <div className="flex border-b border-gray-200 mb-6">
            <button 
              onClick={() => setView('active')}
              className={`pb-3 pr-6 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 ${view === 'active' ? 'border-red-900 text-red-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Active Operations
            </button>
            <button 
              onClick={() => setView('history')}
              className={`pb-3 px-6 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 ${view === 'history' ? 'border-red-900 text-red-900' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              Archived History
            </button>
          </div>

          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-900"></div>
            </div>
          )}

          {!loading && currentList.length === 0 && (
            <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
              <p className="text-gray-400 font-medium">No records found in {view} view.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {currentList.map((batch) => (
              <div key={batch.id} className="group bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden">
                
                <div className="p-5">
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-red-900 transition-colors">
                      {batch.batchName}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold uppercase ${batch.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {batch.status}
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span>Population</span>
                      <span className="font-semibold text-gray-900">{batch.startingPopulation}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span className="text-red-900 font-bold">Vitamins Budget</span>
                      <span className="font-bold text-red-900">₱{batch.vitaminBudget?.toLocaleString() || '0'}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-100 pb-1">
                      <span>Start Date</span>
                      <span className="font-mono">{batch.dateCreated}</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span>Target Harvest</span>
                      <span className="font-mono text-red-900 font-medium">{batch.expectedCompleteDate || "N/A"}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex gap-3">
                   {view === 'active' && (
                    <button 
                      onClick={() => requestComplete(batch.id)}
                      className="flex-1 text-xs font-bold text-white bg-green-600 hover:bg-green-700 py-2 rounded shadow-sm transition-colors"
                    >
                      MARK COMPLETE
                    </button>
                  )}
                  <button 
                    onClick={() => requestDelete(batch.id)}
                    className="flex-1 text-xs font-bold text-red-950 bg-red-100 hover:bg-red-200 py-2 rounded shadow-sm transition-colors"
                  >
                    DELETE
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