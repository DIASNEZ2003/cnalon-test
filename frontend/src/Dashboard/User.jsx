import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase'; 
import { getDatabase, ref, onValue } from "firebase/database";

// --- HELPER: FORMAT TIME ---
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// --- INTERNAL COMPONENT: PASSWORD INPUT ---
const PasswordInput = ({ label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1 text-center">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input 
          type={show ? "text" : "password"} 
          required minLength={6}
          className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-red-900 focus:border-red-900 block p-2.5 outline-none text-center"
          value={value} onChange={onChange} placeholder={placeholder}
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-red-900">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// --- INTERNAL COMPONENT: SUCCESS MODAL ---
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
        <button onClick={onClose} className="w-full bg-red-900 text-white rounded-md px-4 py-2 hover:bg-red-800 transition">OK</button>
      </div>
    </div>
  );
};

// --- INTERNAL COMPONENT: CONFIRM MODAL ---
const ConfirmModal = ({ isOpen, type, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  let title = "Confirm Action";
  let message = "Proceed with this action?";
  let buttonColor = "bg-red-600 hover:bg-red-700";

  if (type === 'create') {
    title = "Register User";
    message = "Are you sure you want to create this new user account?";
    buttonColor = "bg-green-600 hover:bg-green-700";
  } else if (type === 'delete') {
    title = "Confirm Deletion";
    message = "Permanently remove this user? This cannot be undone.";
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 text-center">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{message}</p>
        <div className="flex justify-center gap-3">
          <button onClick={onCancel} className="bg-gray-200 text-gray-700 px-4 py-2 rounded hover:bg-gray-300 transition">Cancel</button>
          <button onClick={onConfirm} className={`text-white px-4 py-2 rounded transition ${buttonColor}`}>Confirm</button>
        </div>
      </div>
    </div>
  );
};

// --- INTERNAL COMPONENT: MESSENGER MODAL ---
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

  const userStatus = targetUser?.status?.toLowerCase() || 'offline';
  const statusColor = (userStatus === 'active' || userStatus === 'online') ? 'bg-green-500' : (userStatus === 'busy' ? 'bg-red-500' : 'bg-gray-400');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-white w-full max-w-md h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative">
        
        {/* --- DELETE MSG MODAL --- */}
        {msgToDelete && (
          <div className="absolute inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl text-center">
              <p className="font-bold mb-4">Delete this message?</p>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setMsgToDelete(null)} className="px-4 py-1 bg-gray-200 rounded">No</button>
                <button onClick={deleteMessage} className="px-4 py-1 bg-red-600 text-white rounded">Yes, Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* --- EDIT MSG MODAL --- */}
        {msgToEdit && (
          <div className="absolute inset-0 z-[120] bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white p-6 rounded-xl shadow-2xl w-full mx-4">
              <h4 className="font-bold mb-2 text-center">Edit Message</h4>
              <textarea className="w-full border p-2 rounded text-sm h-20 outline-none" value={editText} onChange={(e) => setEditText(e.target.value)} />
              <div className="flex gap-2 mt-4">
                <button onClick={() => setMsgToEdit(null)} className="flex-1 py-2 bg-gray-200 rounded">Cancel</button>
                <button onClick={submitEdit} className="flex-1 py-2 bg-blue-600 text-white rounded">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* MESSENGER HEADER */}
        <div className="bg-white border-b p-3 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center">
                {targetUser.profileImage ? <img src={targetUser.profileImage} className="w-full h-full object-cover" /> : <span className="font-bold text-gray-500">{targetUser.username?.charAt(0).toUpperCase()}</span>}
                <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${statusColor}`}></div>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 leading-tight">{targetUser.username}</h3>
              <p className="text-xs text-gray-500 capitalize">{userStatus}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
          </button>
        </div>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-4">
          {messages.map((m) => {
            const isAdmin = m.sender === 'admin';
            return (
              <div key={m.id} className={`flex group w-full ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} max-w-[80%]`}>
                  <div className={`px-4 py-2 rounded-2xl text-sm shadow-sm relative ${isAdmin ? 'bg-red-900 text-white rounded-br-none' : 'bg-white text-gray-800 border rounded-bl-none'}`}>
                    {m.text}
                    {isAdmin && (
                      <div className="absolute top-0 -left-10 hidden group-hover:flex gap-1">
                        <button onClick={() => { setMsgToEdit(m); setEditText(m.text); }} className="text-gray-400 hover:text-blue-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg></button>
                        <button onClick={() => setMsgToDelete(m.id)} className="text-gray-400 hover:text-red-500"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg></button>
                      </div>
                    )}
                  </div>
                  <span className="text-[9px] text-gray-400 mt-1 uppercase">{formatTime(m.timestamp)} {m.isEdited ? '(Edited)' : ''}</span>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        {/* INPUT */}
        <form onSubmit={sendMessage} className="p-3 bg-white border-t flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message..." className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm focus:outline-none" />
          <button type="submit" className="bg-red-900 text-white p-2 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-90" viewBox="0 0 20 20" fill="currentColor"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" /></svg></button>
        </form>
      </div>
    </div>
  );
};

// --- MAIN COMPONENT: USER MANAGEMENT ---
const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [chatUser, setChatUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [formData, setFormData] = useState({ firstName: '', lastName: '', username: '', password: '', confirmPassword: '' });

  const backendUrl = "http://localhost:8000";

  const fetchUsers = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;
      const token = await user.getIdToken();
      const response = await fetch(`${backendUrl}/get-users`, { headers: { "Authorization": `Bearer ${token}` }});
      if (response.ok) setUsers(await response.json() || []);
    } catch (error) { console.error(error); }
  };

  useEffect(() => { fetchUsers(); }, []);

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
    <div className="bg-gray-50 min-h-full  font-sans text-gray-800">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <MessengerModal isOpen={!!chatUser} onClose={() => setChatUser(null)} targetUser={chatUser} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={performAction} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* --- LEFT PANEL: REGISTER FORM --- */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 sticky top-4">
            <div className="bg-red-900 p-4 text-left"><h2 className="text-white font-bold text-lg">Initialize User</h2></div>
            <form onSubmit={requestCreate} className="p-6 space-y-4 text-center">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" placeholder="First Name" required className="bg-gray-50 border p-2.5 rounded-lg text-sm text-center" value={formData.firstName} onChange={(e)=>setFormData({...formData, firstName:e.target.value})} />
                <input type="text" placeholder="Last Name" required className="bg-gray-50 border p-2.5 rounded-lg text-sm text-center" value={formData.lastName} onChange={(e)=>setFormData({...formData, lastName:e.target.value})} />
              </div>
              <input type="text" placeholder="Username" required className="w-full bg-gray-50 border p-2.5 rounded-lg text-sm text-center" value={formData.username} onChange={(e)=>setFormData({...formData, username:e.target.value})} />
              <PasswordInput label="Create Password" value={formData.password} onChange={(e)=>setFormData({...formData, password:e.target.value})} />
              <PasswordInput label="Confirm Password" value={formData.confirmPassword} onChange={(e)=>setFormData({...formData, confirmPassword:e.target.value})} />
              <button type="submit" className="w-full mt-2 bg-red-900 text-white py-3 rounded-lg font-bold hover:bg-red-800 transition shadow-md">CREATE ACCOUNT</button>
            </form>
          </div>
        </div>

        {/* --- RIGHT PANEL: USER DIRECTORY --- */}
        <div className="lg:col-span-2">
          <div className="flex border-b border-gray-200 mb-6 justify-center lg:justify-start">
            <h2 className="pb-3 text-sm font-bold uppercase tracking-widest border-b-2 border-red-900 text-red-900">User Directory</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {users.map((u) => (
              <div key={u.uid} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition flex flex-col overflow-hidden text-center">
                <div className="p-5 flex flex-col items-center">
                  <div className="h-20 w-20 rounded-full bg-gray-100 border-2 border-gray-100 overflow-hidden flex items-center justify-center mb-3">
                    {u.profileImage ? <img src={u.profileImage} className="w-full h-full object-cover" /> : <span className="font-bold text-gray-500 text-2xl">{u.username?.charAt(0).toUpperCase()}</span>}
                  </div>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight uppercase tracking-tight">{u.username}</h3>
                  <p className="text-[10px] font-bold text-gray-400 mb-2">{u.fullName}</p>
                  <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-tighter ${u.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>{u.status || 'offline'}</span>
                </div>
                <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex gap-3">
                  <button onClick={() => setChatUser(u)} className="flex-1 bg-blue-600 text-white text-[10px] font-black py-2.5 rounded shadow-sm hover:bg-blue-700 transition flex items-center justify-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" /><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" /></svg>
                    MESSENGER
                  </button>
                  <button onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: u.uid })} className="flex-1 bg-red-100 text-red-950 text-[10px] font-black py-2.5 rounded shadow-sm hover:bg-red-200 transition">
                    REMOVE USER
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

export default UserManagement;