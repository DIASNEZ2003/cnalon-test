import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, UserPlus, Trash2, Camera, MapPin, User, X, Check, Loader, 
  AlertTriangle, Filter 
} from 'lucide-react';
import { db } from '../firebase'; 
import { ref, onValue, push, remove } from "firebase/database";
import { supabase } from "../supabaseClient";

// --- COMPONENT: SUCCESS MODAL ---
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
        <button onClick={onClose} className="w-full bg-[#3B0A0A] text-white text-xs font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all active:scale-95">CONTINUE</button>
      </div>
    </div>
  );
};

// --- COMPONENT: CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  let config = {
    title: "Confirm Action",
    message: "Proceed with this action?",
    btnColor: "bg-red-600",
    icon: <AlertTriangle className="h-6 w-6 text-orange-500" />,
    iconBg: "bg-orange-50",
    btnText: "Confirm"
  };

  if (type === 'delete') {
    config = {
      title: "Remove Personnel?",
      message: "This action cannot be undone. Are you sure?",
      btnColor: "bg-red-600",
      icon: <Trash2 className="h-6 w-6 text-red-600" />,
      iconBg: "bg-red-50",
      btnText: "Yes, Remove"
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
const Personal = () => {
    const [personnelList, setPersonnelList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    
    // Modals state
    const [successMessage, setSuccessMessage] = useState('');
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });

    // Form State
    const [formData, setFormData] = useState({
        firstName: "", lastName: "", age: "", address: "", status: "Active"
    });
    
    const [selectedImage, setSelectedImage] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    // --- 1. REAL-TIME DATA SYNC ---
    useEffect(() => {
        const personnelRef = ref(db, 'personnel');
        const unsubscribe = onValue(personnelRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setPersonnelList(list.reverse());
            } else {
                setPersonnelList([]);
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- 2. IMAGE HANDLER ---
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedImage(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    // --- 3. SUBMIT NEW PERSONNEL ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            let photoUrl = "";

            if (selectedImage) {
                const fileExt = selectedImage.name.split('.').pop();
                const fileName = `personnel_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('avatars') 
                    .upload(fileName, selectedImage);

                if (uploadError) throw uploadError;

                const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
                photoUrl = data.publicUrl;
            }

            await push(ref(db, 'personnel'), {
                ...formData,
                photoUrl,
                dateAdded: Date.now()
            });

            setIsAddModalOpen(false);
            setFormData({ firstName: "", lastName: "", age: "", address: "", status: "Active" });
            setSelectedImage(null);
            setPreviewUrl(null);
            setSuccessMessage("Personnel added successfully!");

        } catch (error) {
            console.error("Error adding personnel:", error);
            alert("Failed to add personnel. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- 4. DELETE PERSONNEL ---
    const performDelete = async () => {
        const { targetId } = confirmModal;
        setConfirmModal({ isOpen: false, type: null, targetId: null });
        try {
            await remove(ref(db, `personnel/${targetId}`));
            setSuccessMessage("Record deleted successfully.");
        } catch (error) {
            console.error(error);
        }
    };

    // Filter Logic
    const filteredList = personnelList.filter(p => {
        const matchesSearch = p.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              p.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                              p.address?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="bg-gray-50 h-full w-full p-6 animate-fade-in font-sans text-gray-800">
            <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
            <ConfirmModal 
                isOpen={confirmModal.isOpen} 
                type={confirmModal.type} 
                onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
                onConfirm={performDelete} 
            />

            {/* --- HEADER & ACTION BAR --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-4 flex-1">
                    <div className="p-2.5 bg-red-50 rounded-xl">
                        <User size={22} className="text-[#3B0A0A]" />
                    </div>
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input 
                            type="text" 
                            placeholder="Search personnel..." 
                            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-900 outline-none text-xs transition-all font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
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
                            <option value="all">All Status</option>
                            <option value="Active">Active</option>
                            <option value="On Leave">On Leave</option>
                            <option value="Terminated">Terminated</option>
                        </select>
                    </div>
                    <button 
                        onClick={() => setIsAddModalOpen(true)}
                        className="bg-[#3B0A0A] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-900 transition-all flex items-center gap-2 shadow-lg shadow-red-900/20 active:scale-95"
                    >
                        <UserPlus size={16} /> Add Personnel
                    </button>
                </div>
            </div>

            {/* --- TABLE LAYOUT --- */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Name & Age</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan="4" className="py-20 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B0A0A] mx-auto"></div></td></tr>
                            ) : filteredList.length === 0 ? (
                                <tr><td colSpan="4" className="py-20 text-center text-gray-300 text-xs font-medium uppercase tracking-widest">No personnel records found</td></tr>
                            ) : filteredList.map((person) => (
                                <tr key={person.id} className="hover:bg-gray-50/40 transition-colors group">
                                    {/* Name Column */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative w-9 h-9 rounded-full bg-gray-100 flex-shrink-0 border border-gray-200 overflow-hidden">
                                                {person.photoUrl ? (
                                                    <img src={person.photoUrl} className="w-full h-full object-cover" alt="" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-black text-xs">
                                                        {person.firstName?.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-gray-800">{person.firstName} {person.lastName}</span>
                                                <span className="text-[10px] text-gray-400 font-medium">{person.age} Years Old</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Address Column */}
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 max-w-[200px] truncate">
                                            <MapPin size={12} className="text-gray-400" />
                                            {person.address}
                                        </div>
                                    </td>

                                    {/* Status Column */}
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${
                                            person.status === 'Active' 
                                            ? 'bg-green-50 text-green-700 border-green-100' 
                                            : person.status === 'On Leave'
                                            ? 'bg-orange-50 text-orange-700 border-orange-100'
                                            : 'bg-red-50 text-red-700 border-red-100'
                                        }`}>
                                            {person.status}
                                        </span>
                                    </td>

                                    {/* Actions Column */}
                                    <td className="px-6 py-4 text-right">
                                        <button 
                                            onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: person.id })} 
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-80 group-hover:opacity-100" 
                                            title="Delete"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- ADD MODAL --- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 animate-fade-in">
                        <div className="bg-[#3B0A0A] p-4 flex justify-between items-center text-white">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-white/10 rounded-lg"><UserPlus size={18}/></div>
                                <h2 className="font-bold text-sm tracking-tight">Add New Personnel</h2>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="hover:rotate-90 transition-transform duration-200"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-5 space-y-4">
                            {/* Photo Upload Area */}
                            <div className="flex justify-center">
                                <div 
                                    className="relative w-20 h-20 rounded-full bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-red-900 transition group overflow-hidden"
                                    onClick={() => fileInputRef.current.click()}
                                >
                                    {previewUrl ? (
                                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                                    ) : (
                                        <Camera size={20} className="text-gray-400 group-hover:text-red-900" />
                                    )}
                                    <input 
                                        type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageChange}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">First Name</label>
                                    <input required type="text" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Last Name</label>
                                    <input required type="text" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Age</label>
                                    <input required type="number" value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Status</label>
                                    <select 
                                        className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold"
                                        value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="On Leave">On Leave</option>
                                        <option value="Terminated">Terminated</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Address</label>
                                <input required type="text" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" placeholder="Complete Address" />
                            </div>

                            <div className="flex gap-2 pt-2">
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-gray-50 text-gray-500 font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-gray-100 transition-all">Cancel</button>
                                <button type="submit" disabled={isSubmitting} className="flex-1 bg-[#3B0A0A] text-white font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-red-900 transition-all shadow-lg active:scale-95 flex justify-center items-center gap-2">
                                    {isSubmitting ? <Loader className="animate-spin" size={14} /> : null}
                                    {isSubmitting ? "Saving..." : "Save Record"}
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

export default Personal;