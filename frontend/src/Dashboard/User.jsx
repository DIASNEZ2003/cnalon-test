import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase'; 
import { getDatabase, ref, onValue, update } from "firebase/database";
import { 
  UserPlus, Users, MessageSquare, Trash2, Lock, 
  Check, AlertTriangle, Send, X, Edit2, ShieldCheck,
  CheckCheck
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
  const [liveStatus, setLiveStatus] = useState("offline"); 
  const scrollRef = useRef();

  useEffect(() => {
    if (!isOpen || !targetUser) return;
    const db = getDatabase();
    
    // 1. WATCH TARGET USER LIVE STATUS
    const statusRef = ref(db, `users/${targetUser.uid}/status`);
    const unsubStatus = onValue(statusRef, (snap) => {
        setLiveStatus(snap.val() || "offline");
    });

    // 2. WATCH CHAT MESSAGES
    const chatRef = ref(db, `chats/${targetUser.uid}`);
    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(id => ({ id, ...data[id] }));
        setMessages(list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)));

        const updates = {};
        Object.keys(data).forEach(id => {
            // ADMIN SIDE SEEN LOGIC: When Admin opens modal, user messages become seen
            if (data[id].sender === 'user' && data[id].seen !== true) {
                updates[`chats/${targetUser.uid}/${id}/seen`] = true;
                updates[`chats/${targetUser.uid}/${id}/status`] = 'seen';
            }
        });
        if (Object.keys(updates).length > 0) update(ref(db), updates);
      } else { setMessages([]); }
    });

    return () => {
        unsubscribeChat();
        unsubStatus();
    };
  }, [isOpen, targetUser]);

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    try {
      const user = auth.currentUser;
      const token = await user.getIdToken();
      
      // ADMIN TO USER: Start as "sent". 
      // User app handles flipping it to "delivered" when they are active.
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
      <div className="bg-white w-full max-w-md h-[500px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-gray-100">
        
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

        <div className="bg-[#3B0A0A] p-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold border border-white/20 overflow-hidden">
              {targetUser.profilePicture ? (
                <img src={targetUser.profilePicture} className="w-full h-full object-cover" alt="" />
              ) : (
                targetUser.username?.charAt(0).toUpperCase()
              )}
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[#3B0A0A] rounded-full ${liveStatus === 'online' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
            </div>
            <div>
              <h3 className="font-bold text-white leading-tight flex items-center gap-1">
                {targetUser.username}
                {targetUser.role === 'admin' && <ShieldCheck size={14} className="text-blue-400" />}
              </h3>
              <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider italic">
                {liveStatus === 'online' ? 'Active Now' : 'Offline'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3 no-scrollbar">
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
                  
                  <div className="flex items-center gap-1.5 mt-1 px-1">
                    <span className="text-[9px] text-gray-400 font-bold">{formatTime(m.timestamp)} {m.isEdited ? '• Edited' : ''}</span>
                    {isAdmin && (
                        <div className="flex items-center">
                            {m.seen ? (
                                <span className="text-[9px] font-black text-blue-500 uppercase italic">Seen</span>
                            ) : m.status === 'delivered' ? (
                                <span className="text-[9px] font-black text-gray-400 uppercase italic">Delivered</span>
                            ) : (
                                <span className="text-[9px] font-black text-gray-300 uppercase italic">Sent</span>
                            )}
                        </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

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
  const [unreadCounts, setUnreadCounts] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [chatUser, setChatUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [formData, setFormData] = useState({ firstName: '', lastName: '', username: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(true);

  const backendUrl = "http://localhost:8000";

  useEffect(() => {
    const db = getDatabase();
    
    // 1. LISTEN TO USERS
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(uid => ({ uid, ...data[uid] }));
        setUsers(list);
      } else { setUsers([]); }
      setLoading(false);
    });

    // 2. LISTEN TO ALL CHATS FOR UNREAD INDICATORS
    const chatsRef = ref(db, 'chats');
    const unsubChats = onValue(chatsRef, (snapshot) => {
        const data = snapshot.val();
        const counts = {};
        if (data) {
            Object.keys(data).forEach(uid => {
                const userMessages = data[uid];
                const count = Object.values(userMessages).filter(m => m.sender === 'user' && !m.seen).length;
                counts[uid] = count;
            });
        }
        setUnreadCounts(counts);
    });

    return () => { unsubUsers(); unsubChats(); };
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
      const body = type === 'create' ? JSON.stringify(formData) : null;

      const response = await fetch(`${backendUrl}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body
      });

      if (response.ok) {
        setSuccessMessage(type === 'create' ? "Account Created!" : "User Deleted!");
        if (type === 'create') setFormData({ firstName: '', lastName: '', username: '', password: '', confirmPassword: '' });
      }
    } catch (e) { console.error(e); }
  };

  const regularUsers = users.filter(u => u.role !== 'admin');

  return (
    <div className="bg-gray-50 h-[calc(100vh-6rem)] w-full overflow-hidden p-4">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <MessengerModal isOpen={!!chatUser} onClose={() => setChatUser(null)} targetUser={chatUser} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={performAction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full">
        <div className="lg:col-span-1 h-full overflow-y-auto pr-1 no-scrollbar">
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
            <div className="bg-[#3B0A0A] p-5 flex items-center gap-3">
              <UserPlus className="text-white h-6 w-6" />
              <h2 className="text-white font-bold text-lg tracking-wide">Add New User</h2>
            </div>
            <form onSubmit={requestCreate} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" required placeholder="First Name" className="w-full bg-gray-50 border p-3 rounded-xl outline-none font-bold text-sm" value={formData.firstName} onChange={(e)=>setFormData({...formData, firstName:e.target.value})} />
                <input type="text" required placeholder="Last Name" className="w-full bg-gray-50 border p-3 rounded-xl outline-none font-bold text-sm" value={formData.lastName} onChange={(e)=>setFormData({...formData, lastName:e.target.value})} />
              </div>
              <input type="text" required placeholder="Username" className="w-full bg-gray-50 border p-3 rounded-xl outline-none font-bold text-sm" value={formData.username} onChange={(e)=>setFormData({...formData, username:e.target.value})} />
              <PasswordInput label="Create Password" value={formData.password} onChange={(e)=>setFormData({...formData, password:e.target.value})} />
              <PasswordInput label="Confirm Password" value={formData.confirmPassword} onChange={(e)=>setFormData({...formData, confirmPassword:e.target.value})} />
              <button type="submit" className="w-full mt-4 text-white bg-[#3B0A0A] hover:bg-red-900 font-bold rounded-xl text-sm py-4 shadow-lg uppercase tracking-wide">CREATE ACCOUNT</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 h-full flex flex-col">
          <div className="flex items-center justify-between border-b mb-6 pb-4 shrink-0">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-[#3B0A0A]"><Users className="h-5 w-5" /> User Directory</h2>
            <span className="text-xs font-bold bg-gray-100 text-gray-500 px-3 py-1 rounded-full">{regularUsers.length} Users</span>
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {regularUsers.map((u) => {
                const unread = unreadCounts[u.uid] || 0;
                return (
                  <div key={u.uid} className="group bg-white rounded-2xl border shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden relative">
                    {/* TOP RIGHT UNREAD INDICATOR */}
                    {unread > 0 && (
                      <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-black h-5 w-5 rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-bounce">
                        {unread}
                      </div>
                    )}

                    <div className="p-6 flex flex-col items-center text-center">
                      <div className="relative mb-4">
                        <div className="h-20 w-20 rounded-full bg-gray-50 border-4 border-white shadow-md overflow-hidden flex items-center justify-center">
                          {u.profilePicture ? <img src={u.profilePicture} className="w-full h-full object-cover" /> : <span className="font-black text-2xl text-gray-300">{u.username?.charAt(0).toUpperCase()}</span>}
                        </div>
                        <div className={`absolute bottom-1 right-1 w-5 h-5 border-4 border-white rounded-full ${u.status === 'online' ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      </div>
                      <h3 className="font-black text-gray-800 text-lg uppercase leading-none mb-1">{u.username}</h3>
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{u.firstName} {u.lastName}</p>
                    </div>
                    <div className="bg-gray-50 p-4 border-t flex gap-3">
                      <button onClick={() => setChatUser(u)} className={`flex-1 flex items-center justify-center gap-2 text-xs font-bold py-3 rounded-xl uppercase tracking-wide transition-all ${unread > 0 ? 'bg-blue-600 text-white scale-105 shadow-md' : 'text-blue-600 bg-white border border-blue-100 hover:bg-blue-50'}`}>
                        <MessageSquare size={14} /> {unread > 0 ? 'New Message' : 'Chat'}
                      </button>
                      <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: u.uid })} className="flex-1 flex items-center justify-center gap-2 text-xs font-bold text-red-700 bg-red-100 hover:bg-red-200 py-3 rounded-xl uppercase tracking-wide transition-colors"><Trash2 size={14} /> Remove</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <style>{` .no-scrollbar::-webkit-scrollbar { display: none; } `}</style>
    </div>
  );
};

export default UserManagement;