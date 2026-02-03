import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase'; 
import { getDatabase, ref, onValue } from "firebase/database";
import { 
  UserPlus, Users, MessageSquare, Trash2, Lock, 
  Check, AlertTriangle, Send, X, Edit2
} from 'lucide-react';

// --- HELPER: TIME FORMAT ---
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- COMPONENT: PASSWORD INPUT ---
const PasswordInput = ({ label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
        <input 
          type={show ? "text" : "password"} 
          required minLength={6}
          className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-10 p-3 outline-none font-bold"
          value={value} onChange={onChange} placeholder={placeholder}
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-[#3B0A0A] text-xs font-bold uppercase">
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
};

// --- COMPONENT: SUCCESS MODAL ---
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
        <button onClick={onClose} className="w-full bg-[#3B0A0A] text-white font-bold rounded-xl px-4 py-3 hover:bg-red-900 transition-all shadow-lg active:scale-95">CONTINUE</button>
      </div>
    </div>
  );
};

// --- COMPONENT: CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  
  let title = "Confirm Action";
  let message = "Proceed with this action?";
  let buttonColor = "bg-red-600 hover:bg-red-700";
  let icon = <AlertTriangle className="h-8 w-8 text-orange-500" />;
  let buttonText = "Confirm";

  if (type === 'create') {
    title = "Register User";
    message = "Are you sure you want to create this new user account?";
    buttonColor = "bg-green-600 hover:bg-green-700";
    icon = <UserPlus className="h-8 w-8 text-green-600" />;
    buttonText = "Create Account";
  } else if (type === 'delete') {
    title = "Delete User?";
    message = "Permanently remove this user? This cannot be undone.";
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
          <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 font-bold px-4 py-3 rounded-xl hover:bg-gray-200 transition">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 text-white font-bold px-4 py-3 rounded-xl transition shadow-lg ${buttonColor}`}>{buttonText}</button>
        </div>
      </div>
    </div>
  );
};

// --- COMPONENT: MESSENGER MODAL ---
const MessengerModal = ({ isOpen, onClose, targetUser }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [msgToDelete, setMsgToDelete] = useState(null); 
  const [msgToEdit, setMsgToEdit] = useState(null);
  const [editText, setEditText] = useState("");
  const scrollRef = useRef();

  useEffect(() => {
    if (!isOpen || !targetUser) return;
    const db = getDatabase();
    const chatRef = ref(db, `chats/${targetUser.uid}`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(id => ({ id, ...data[id] }));
        setMessages(list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));
      } else { setMessages([]); }
    });
    return () => unsubscribe();
  }, [isOpen, targetUser]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      await fetch("http://localhost:8000/admin-send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ recipientUid: targetUser.uid, text: input })
      });
      setInput(""); 
    } catch (error) { console.error(error); }
  };

  const deleteMessage = async () => {
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      await fetch("http://localhost:8000/admin-delete-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ targetUid: targetUser.uid, messageId: msgToDelete })
      });
      setMsgToDelete(null);
    } catch (error) { console.error(error); }
  };

  const submitEdit = async () => {
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      await fetch("http://localhost:8000/admin-edit-message", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ targetUid: targetUser.uid, messageId: msgToEdit.id, newText: editText })
      });
      setMsgToEdit(null);
    } catch (error) { console.error(error); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      {/* Modal is constrained to 80% screen height to prevent scrolling */}
      <div className="bg-white w-full max-w-md h-[500px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-gray-100">
        
        {/* EDIT/DELETE OVERLAYS */}
        {msgToDelete && (
          <div className="absolute inset-0 z-[120] bg-white/90 backdrop-blur flex items-center justify-center p-4">
            <div className="text-center">
              <h4 className="text-lg font-bold text-gray-800 mb-4">Delete Message?</h4>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setMsgToDelete(null)} className="px-6 py-2 bg-gray-200 font-bold rounded-xl text-gray-600">Cancel</button>
                <button onClick={deleteMessage} className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl">Delete</button>
              </div>
            </div>
          </div>
        )}

        {msgToEdit && (
          <div className="absolute inset-0 z-[120] bg-white/90 backdrop-blur flex items-center justify-center p-4">
            <div className="w-full bg-white border border-gray-200 p-6 rounded-2xl shadow-xl">
              <h4 className="font-bold text-gray-800 mb-3">Edit Message</h4>
              <textarea className="w-full border bg-gray-50 p-3 rounded-xl text-sm h-24 outline-none focus:border-blue-500" value={editText} onChange={(e) => setEditText(e.target.value)} />
              <div className="flex gap-2 mt-4">
                <button onClick={() => setMsgToEdit(null)} className="flex-1 py-2 bg-gray-200 font-bold rounded-xl text-gray-600">Cancel</button>
                <button onClick={submitEdit} className="flex-1 py-2 bg-blue-600 text-white font-bold rounded-xl">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* HEADER */}
        <div className="bg-[#3B0A0A] p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold border border-white/20">
              {targetUser.username?.charAt(0).toUpperCase()}
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[#3B0A0A] rounded-full ${targetUser.status === 'active' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
            </div>
            <div>
              <h3 className="font-bold text-white leading-tight">{targetUser.username}</h3>
              <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider">{targetUser.status || 'Offline'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
          {messages.map((m) => {
            const isAdmin = m.sender === 'admin';
            return (
              <div key={m.id} className={`flex group w-full ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} max-w-[85%]`}>
                  <div className={`px-4 py-2.5 rounded-2xl text-sm shadow-sm relative ${isAdmin ? 'bg-[#3B0A0A] text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                    {m.text}
                    {isAdmin && (
                      <div className="absolute top-0 -left-12 hidden group-hover:flex gap-1 h-full items-center">
                        <button onClick={() => { setMsgToEdit(m); setEditText(m.text); }} className="p-1.5 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200"><Edit2 size={12} /></button>
                        <button onClick={() => setMsgToDelete(m.id)} className="p-1.5 bg-red-100 text-red-600 rounded-full hover:bg-red-200"><Trash2 size={12} /></button>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 font-bold ml-1">{formatTime(m.timestamp)} {m.isEdited ? '• Edited' : ''}</span>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* INPUT AREA */}
        <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-100 flex gap-2 items-center">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)} 
            placeholder="Type a message..." 
            className="flex-1 bg-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 font-medium" 
          />
          <button type="submit" className="bg-[#3B0A0A] text-white p-3 rounded-xl hover:bg-red-900 transition shadow-lg shadow-red-900/20">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

// --- MAIN PAGE COMPONENT ---
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [chatUser, setChatUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [formData, setFormData] = useState({ firstName: '', lastName: '', username: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);

  const backendUrl = "http://localhost:8000";

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/get-users`, { headers: { "Authorization": `Bearer ${token}` }});
      if (response.ok) setUsers(await response.json() || []);
    } catch (error) { 
      console.error(error); 
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) fetchUsers();
    });
    return () => unsubscribe();
  }, []);

  const requestCreate = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { alert("Passwords do not match!"); return; }
    setConfirmModal({ isOpen: true, type: 'create', targetId: null });
  };

  const performAction = async () => {
    const { type, targetId } = confirmModal;
    setConfirmModal({ isOpen: false, type: null, targetId: null });
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      const endpoint = type === 'create' ? '/admin-create-user' : `/admin-delete-user/${targetId}`;
      const method = type === 'create' ? 'POST' : 'DELETE';
      const body = type === 'create' ? JSON.stringify({ ...formData, profilePicture: "" }) : null;

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body
      });

      if (response.ok) {
        setSuccessMessage(type === 'create' ? "Account Created!" : "User Deleted!");
        if (type === 'create') setFormData({ firstName: '', lastName: '', username: '', password: '', confirmPassword: '' });
        fetchUsers();
      }
    } catch (e) { console.error(e); }
  };

  return (
    // FIX: Using h-[calc(100vh-6rem)] to force "fit to screen" and internal scrolling
    <div className="bg-gray-50 h-[calc(100vh-6rem)] w-full overflow-hidden p-4">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <MessengerModal isOpen={!!chatUser} onClose={() => setChatUser(null)} targetUser={chatUser} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={performAction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        
        {/* --- LEFT PANEL: REGISTER FORM (Scrollable if needed) --- */}
        <div className="lg:col-span-1 h-full overflow-y-auto pr-1 no-scrollbar">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-[#3B0A0A] p-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm">
                  <UserPlus className="text-white h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg tracking-wide">Add New User</h2>
                  <p className="text-white/60 text-xs">Create system access account</p>
                </div>
              </div>
            </div>
            
            <form onSubmit={requestCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">First Name</label>
                  <input type="text" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block p-3 outline-none font-bold" value={formData.firstName} onChange={(e)=>setFormData({...formData, firstName:e.target.value})} />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Last Name</label>
                  <input type="text" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block p-3 outline-none font-bold" value={formData.lastName} onChange={(e)=>setFormData({...formData, lastName:e.target.value})} />
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">Username</label>
                <div className="relative">
                  <Users className="absolute left-3 top-3 text-gray-400 h-4 w-4" />
                  <input type="text" required className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-10 p-3 outline-none font-bold" value={formData.username} onChange={(e)=>setFormData({...formData, username:e.target.value})} />
                </div>
              </div>

              <PasswordInput label="Create Password" value={formData.password} onChange={(e)=>setFormData({...formData, password:e.target.value})} />
              <PasswordInput label="Confirm Password" value={formData.confirmPassword} onChange={(e)=>setFormData({...formData, confirmPassword:e.target.value})} />
              
              <button type="submit" className="w-full mt-4 text-white bg-[#3B0A0A] hover:bg-red-900 focus:ring-4 focus:ring-red-300 font-bold rounded-xl text-sm px-5 py-4 text-center transition-all shadow-lg hover:shadow-xl active:scale-95 uppercase tracking-wide">
                CREATE ACCOUNT
              </button>
            </form>
          </div>
        </div>

        {/* --- RIGHT PANEL: USER DIRECTORY (Fixed layout with internal scroll) --- */}
        <div className="lg:col-span-2 h-full flex flex-col">
          
          <div className="flex items-center justify-between border-b border-gray-200 mb-6 pb-4 shrink-0">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#3B0A0A]">
              <Users className="h-5 w-5" /> User Directory
            </h2>
            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{users.length} Users</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-2 pb-4 no-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#3B0A0A]"></div>
              </div>
            ) : users.length === 0 ? (
              <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 p-16 text-center">
                <Users className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-bold text-gray-400">No Users Found</h3>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {users.map((u) => (
                  <div key={u.uid} className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
                    
                    <div className="p-6 flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        <div className="h-20 w-20 rounded-full bg-gray-50 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                          {u.profilePicture ? (
                            <img src={u.profilePicture} className="w-full h-full object-cover" alt="Avatar" />
                          ) : (
                            <span className="font-black text-2xl text-gray-300">{u.username?.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className={`absolute bottom-1 right-1 w-5 h-5 border-4 border-white rounded-full ${u.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      </div>

                      <h3 className="font-black text-gray-800 text-lg leading-tight uppercase tracking-tight mb-1">{u.username}</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{u.firstName} {u.lastName}</p>
                    </div>
                    
                    <div className="bg-gray-50 p-4 border-t border-gray-100 flex gap-3">
                      <button 
                        onClick={() => setChatUser(u)} 
                        className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 py-3 rounded-xl shadow-sm transition-colors uppercase tracking-wide"
                      >
                        <MessageSquare size={14} /> Chat
                      </button>
                      <button 
                        onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: u.uid })} 
                        className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 py-3 rounded-xl shadow-sm transition-colors uppercase tracking-wide"
                      >
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;