import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, UserPlus, Trash2, Camera, MapPin, User, X, Check, Loader 
} from 'lucide-react';
import { db } from '../firebase'; 
import { ref, onValue, push, remove } from "firebase/database";
import { supabase } from "../supabaseClient";

// --- COMPONENT: PERSONNEL CARD ---
const PersonnelCard = ({ person, onDelete }) => {
    return (
        <div className="bg-white rounded-[24px] p-5 shadow-sm hover:shadow-lg transition-all border border-gray-100 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button 
                    onClick={() => onDelete(person.id)} 
                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                    title="Remove Personnel"
                >
                    <Trash2 size={16} />
                </button>
            </div>

            <div className="flex items-start gap-4">
                <div className="relative shrink-0">
                    <div className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-gray-100 shadow-sm">
                        {person.photoUrl ? (
                            <img src={person.photoUrl} alt={person.firstName} className="w-full h-full object-cover" />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-400 font-black text-xl">
                                {person.firstName?.charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 border-2 border-white rounded-full ${person.status === 'Active' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                </div>
                
                <div className="flex-1 min-w-0 pt-1">
                    <h3 className="font-black text-gray-900 text-lg truncate leading-tight">
                        {person.firstName} {person.lastName}
                    </h3>
                    <p className="text-xs font-bold text-red-900 uppercase tracking-wider mb-2">
                        {person.age} Years Old
                    </p>
                    
                    <div className="flex items-start gap-2 text-xs font-medium text-gray-500">
                        <MapPin size={12} className="mt-0.5 shrink-0" /> 
                        <span className="line-clamp-2">{person.address}</span>
                    </div>
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
    
    // Updated Form State
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

        } catch (error) {
            console.error("Error adding personnel:", error);
            alert("Failed to add personnel. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // --- 4. DELETE PERSONNEL ---
    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to remove this personnel record?")) {
            await remove(ref(db, `personnel/${id}`));
        }
    };

    // Filter Logic
    const filteredList = personnelList.filter(p => 
        p.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.lastName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.address?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-gray-50 p-6 animate-fade-in relative">
            
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row gap-3 mb-6">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Search personnel..." 
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-red-900 outline-none font-bold text-sm shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-[#3B0A0A] text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-900 transition shadow-lg shadow-red-900/20 shrink-0"
                >
                    <UserPlus size={18} /> Add New
                </button>
            </div>

            {/* --- LIST GRID --- */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader className="animate-spin text-red-900" size={32} />
                </div>
            ) : filteredList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pb-20 no-scrollbar">
                    {filteredList.map(person => (
                        <PersonnelCard key={person.id} person={person} onDelete={handleDelete} />
                    ))}
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <User size={48} className="mb-4 opacity-20" />
                    <p className="font-bold text-lg">No personnel found.</p>
                    <p className="text-xs">Add new staff using the button above.</p>
                </div>
            )}

            {/* --- ADD MODAL --- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-[#3B0A0A] p-5 flex justify-between items-center shrink-0">
                            <h2 className="text-white font-black text-lg flex items-center gap-2">
                                <UserPlus size={20} /> New Personnel
                            </h2>
                            <button onClick={() => setIsAddModalOpen(false)} className="text-white/70 hover:text-white transition">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
                            {/* Photo Upload */}
                            <div className="flex justify-center mb-6">
                                <div 
                                    className="relative w-24 h-24 rounded-2xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-red-900 transition group overflow-hidden"
                                    onClick={() => fileInputRef.current.click()}
                                >
                                    {previewUrl ? (
                                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                                    ) : (
                                        <div className="flex flex-col items-center text-gray-400 group-hover:text-red-900">
                                            <Camera size={24} />
                                            <span className="text-[10px] font-bold mt-1">Add Photo</span>
                                        </div>
                                    )}
                                    <input 
                                        type="file" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        accept="image/*"
                                        onChange={handleImageChange}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">First Name</label>
                                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-900" 
                                        value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} placeholder="e.g. Juan" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Last Name</label>
                                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-900" 
                                        value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} placeholder="e.g. Cruz" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Age</label>
                                    <input required type="number" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-900" 
                                        value={formData.age} onChange={e => setFormData({...formData, age: e.target.value})} placeholder="e.g. 25" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Status</label>
                                    <select 
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold text-sm outline-none focus:border-red-900"
                                        value={formData.status}
                                        onChange={e => setFormData({...formData, status: e.target.value})}
                                    >
                                        <option value="Active">Active</option>
                                        <option value="On Leave">On Leave</option>
                                        <option value="Terminated">Terminated</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1 mb-6">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Address</label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-3 text-gray-400" size={16} />
                                    <input required type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 pl-10 font-bold text-sm outline-none focus:border-red-900" 
                                        value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Complete Address" />
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className="w-full bg-[#3B0A0A] text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-red-900 transition active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                {isSubmitting ? <Loader className="animate-spin" size={18} /> : <Check size={18} />}
                                {isSubmitting ? "Saving..." : "Save Personnel"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
            <style>{` .no-scrollbar::-webkit-scrollbar { display: none; } `}</style>
        </div>
    );
};

export default Personal;