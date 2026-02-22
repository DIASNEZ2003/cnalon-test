import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase'; 
import { getDatabase, ref, onValue, update, push, set, remove } from "firebase/database";
import { supabase } from '../supabaseClient'; 
import { 
  UserPlus, Users, MessageSquare, Trash2, Lock, 
  Check, AlertTriangle, Send, X, Edit2, ShieldCheck,
  Search, Paperclip, FileText, Download, Loader2, Image as ImageIcon, Tractor, Camera
} from 'lucide-react';

// --- HELPER: TIME FORMAT ---
const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? timeStr : `${date.toLocaleDateString([], { month: 'short', day: 'numeric'})}, ${timeStr}`;
};

// --- COMPONENT: PASSWORD INPUT ---
const PasswordInput = ({ label, value, onChange, placeholder }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-2.5 text-gray-400 h-4 w-4" />
        <input 
          type={show ? "text" : "password"} 
          required minLength={6}
          className="w-full bg-gray-50 border border-gray-100 text-gray-900 text-xs rounded-xl focus:ring-2 focus:ring-[#3B0A0A] focus:border-[#3B0A0A] block pl-9 p-2.5 outline-none font-bold transition-all"
          value={value} onChange={onChange} placeholder={placeholder}
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-[#3B0A0A] text-[10px] font-bold uppercase">
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

  if (type === 'create') {
    config = {
      title: "Register User",
      message: "Are you sure you want to create this new user account?",
      btnColor: "bg-green-600",
      icon: <UserPlus className="h-6 w-6 text-green-600" />,
      iconBg: "bg-green-50",
      btnText: "Create Account"
    };
  } else if (type === 'delete') {
    config = {
      title: "Delete User?",
      message: "Permanently remove this user? This cannot be undone.",
      btnColor: "bg-red-600",
      icon: <Trash2 className="h-6 w-6 text-red-600" />,
      iconBg: "bg-red-50",
      btnText: "Yes, Delete"
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

// --- COMPONENT: MESSENGER MODAL ---
const MessengerModal = ({ isOpen, onClose, targetUser }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [msgToDelete, setMsgToDelete] = useState(null); 
  const [msgToEdit, setMsgToEdit] = useState(null);
  const [editText, setEditText] = useState("");
  const [liveStatus, setLiveStatus] = useState("offline"); 
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const scrollRef = useRef();

  useEffect(() => {
    if (!isOpen || !targetUser) return;
    const db = getDatabase();
    
    const statusRef = ref(db, `users/${targetUser.uid}/status`);
    const unsubStatus = onValue(statusRef, (snap) => {
        setLiveStatus(snap.val() || "offline");
    });

    const chatRef = ref(db, `chats/${targetUser.uid}`);
    const unsubscribeChat = onValue(chatRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(id => ({ id, ...data[id] }));
        const sortedList = list.sort((a, b) => {
            const timeA = Number(a.timestamp) || 0;
            const timeB = Number(b.timestamp) || 0;
            if (timeA === timeB) return a.id.localeCompare(b.id);
            return timeA - timeB;
        });
        
        setMessages(sortedList);

        const updates = {};
        Object.keys(data).forEach(id => {
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

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const clearSelectedFile = () => setSelectedFile(null);

  const sendMessage = async (e) => {
    if (e) e.preventDefault();
    
    const currentInput = input.trim();
    const currentFile = selectedFile;
    
    if (!currentInput && !currentFile) return;

    const sendTimestamp = Date.now();
    
    setInput("");
    setSelectedFile(null);
    
    if (currentFile) setUploading(true);

    try {
      let publicUrl = null;
      let fileName = null;
      let fileType = null;

      const user = auth.currentUser;
      if (!user) throw new Error("User not authenticated.");

      if (currentFile) {
        const cleanName = currentFile.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        const uniqueName = `attachments/${user.uid}/${sendTimestamp}_${cleanName}`; 
        
        const { error: uploadError } = await supabase.storage
          .from('chat-attachments')
          .upload(uniqueName, currentFile);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(uniqueName);

        publicUrl = data.publicUrl;
        fileName = currentFile.name;
        fileType = currentFile.type;
      }

      const db = getDatabase();
      const chatRef = ref(db, `chats/${targetUser.uid}`);
      const newMessageRef = push(chatRef);
      
      const payload = {
        sender: "admin",
        text: currentInput,
        timestamp: sendTimestamp, 
        seen: false,
        status: "delivered"
      };

      if (publicUrl) {
        payload.attachmentUrl = publicUrl;
        payload.attachmentName = fileName;
        payload.attachmentType = fileType;
      }

      await set(newMessageRef, payload);
      
    } catch (error) {
      console.error("Failed to send message/attachment:", error);
      alert("Failed to send. Please check your internet connection.");
    } finally {
      if (currentFile) setUploading(false);
    }
  };

  const handleDownload = async (e, url, filename) => {
    e.preventDefault(); 
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename || 'downloaded_file';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Download failed, opening in new tab instead", error);
      window.open(url, '_blank'); 
    }
  };

  const deleteMessage = async () => {
    try {
      const db = getDatabase();
      await remove(ref(db, `chats/${targetUser.uid}/${msgToDelete}`));
      setMsgToDelete(null);
    } catch (error) { console.error(error); }
  };

  const submitEdit = async () => {
    try {
      const db = getDatabase();
      await update(ref(db, `chats/${targetUser.uid}/${msgToEdit.id}`), {
        text: editText,
        isEdited: true
      });
      setMsgToEdit(null);
    } catch (error) { console.error(error); }
  };

  if (!isOpen || !targetUser) return null; 

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[140] p-4">
      <div className="bg-white w-full max-w-md h-[500px] max-h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border border-gray-100 animate-fade-in">
        
        {msgToDelete && (
          <div className="absolute inset-0 z-[160] bg-white/95 backdrop-blur flex items-center justify-center p-6">
            <div className="text-center w-full">
              <h4 className="text-sm font-bold text-gray-800 mb-4">Delete this message?</h4>
              <div className="flex gap-2 justify-center">
                <button onClick={() => setMsgToDelete(null)} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-xs text-gray-600 uppercase">Cancel</button>
                <button onClick={deleteMessage} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl text-xs uppercase shadow-lg">Delete</button>
              </div>
            </div>
          </div>
        )}

        {msgToEdit && (
          <div className="absolute inset-0 z-[160] bg-white/95 backdrop-blur flex items-center justify-center p-6">
            <div className="w-full">
              <h4 className="font-bold text-gray-800 mb-2 text-sm uppercase">Edit Message</h4>
              <textarea className="w-full border bg-gray-50 p-3 rounded-xl text-sm h-24 outline-none focus:border-red-900 focus:ring-1 focus:ring-red-900" value={editText} onChange={(e) => setEditText(e.target.value)} />
              <div className="flex gap-2 mt-3">
                <button onClick={() => setMsgToEdit(null)} className="flex-1 py-3 bg-gray-100 font-bold rounded-xl text-xs text-gray-600 uppercase">Cancel</button>
                <button onClick={submitEdit} className="flex-1 py-3 bg-[#3B0A0A] text-white font-bold rounded-xl text-xs uppercase shadow-lg">Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-[#3B0A0A] p-4 flex items-center justify-between shadow-md z-10">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold border border-white/20 overflow-hidden">
              {targetUser.profilePicture ? (
                <img src={targetUser.profilePicture} className="w-full h-full object-cover" alt="" />
              ) : (
                (targetUser.username || "U").charAt(0).toUpperCase()
              )}
              <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-[#3B0A0A] rounded-full ${liveStatus === 'online' ? 'bg-green-400' : 'bg-gray-400'}`}></div>
            </div>
            <div>
              <h3 className="font-bold text-white leading-tight flex items-center gap-1 text-sm">
                {targetUser.username || "Unknown User"}
                {targetUser.role === 'admin' && <ShieldCheck size={14} className="text-blue-400" />}
              </h3>
              <p className="text-[10px] text-white/60 uppercase font-bold tracking-wider italic flex items-center gap-1">
                {liveStatus === 'online' ? 'Active Now' : 'Offline'}
                <span className="text-[8px] px-1.5 py-0.5 bg-white/10 rounded-sm not-italic ml-1 border border-white/20">
                  {targetUser.role === 'personnel' ? 'PERSONNEL' : 'TECH'}
                </span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-white/10 rounded-full hover:bg-white/20 text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Chat Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3 no-scrollbar flex flex-col">
          {messages.length === 0 ? (
            <div className="m-auto text-center text-gray-400">
              <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs font-medium">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((m) => {
              const isAdmin = m.sender === 'admin';
              
              if (!m.text?.trim() && !m.attachmentUrl) return null;

              return (
                <div key={m.id} className={`flex group w-full ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} max-w-[85%]`}>
                    
                    <div className={`px-3 py-2.5 rounded-2xl text-xs font-medium shadow-sm relative z-10 ${isAdmin ? 'bg-[#3B0A0A] text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                      
                      {/* Render Attachment Cards */}
                      {m.attachmentUrl && (
                        <div className={`${m.text?.trim() ? 'mb-2' : ''}`}>
                          {m.attachmentType?.startsWith('image/') ? (
                            <div 
                              onClick={(e) => handleDownload(e, m.attachmentUrl, m.attachmentName)}
                              className="relative group/img cursor-pointer block rounded-xl overflow-hidden shadow-sm border border-white/10" 
                              title="Click to download image"
                            >
                              <img src={m.attachmentUrl} alt="attachment" className="max-w-[200px] max-h-[200px] object-cover" />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                  <Download className="text-white h-8 w-8 drop-shadow-md" />
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={(e) => handleDownload(e, m.attachmentUrl, m.attachmentName)}
                              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer shadow-sm border transition-all duration-200 w-56 sm:w-64 select-none ${
                                isAdmin 
                                  ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white' 
                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 text-gray-800'
                              }`}
                            >
                              <div className={`p-2.5 rounded-full flex-shrink-0 ${isAdmin ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                <FileText size={20} />
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col justify-center overflow-hidden">
                                <span className="text-sm font-bold truncate block w-full leading-tight">{m.attachmentName || "Attachment"}</span>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <span className={`text-[9px] uppercase font-bold tracking-wider ${isAdmin ? 'text-white/70' : 'text-gray-500'}`}>
                                    {m.attachmentType ? m.attachmentType.split('/')[1] : 'FILE'}
                                  </span>
                                  <span className={isAdmin ? 'text-white/40' : 'text-gray-300'}>•</span>
                                  <span className={`text-[9px] font-bold ${isAdmin ? 'text-white/70' : 'text-gray-500'}`}>
                                    Click to download
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Render Text */}
                      {m.text?.trim() && (
                          <p className="whitespace-pre-wrap px-1">{m.text}</p>
                      )}

                      {/* Message Actions */}
                      {isAdmin && (
                        <div className="absolute top-0 -left-16 hidden group-hover:flex gap-1 h-full items-center z-0">
                          {m.text?.trim() && <button onClick={() => { setMsgToEdit(m); setEditText(m.text); }} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 shadow-sm border border-blue-100"><Edit2 size={12} /></button>}
                          <button onClick={() => setMsgToDelete(m.id)} className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 shadow-sm border border-red-100"><Trash2 size={12} /></button>
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
            })
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-gray-100 flex flex-col shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
          
          {selectedFile && (
            <div className="px-4 py-3 bg-blue-50/50 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="h-10 w-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  {selectedFile.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-800 truncate">{selectedFile.name}</p>
                  <p className="text-[10px] text-gray-500 font-medium">{(selectedFile.size / 1024).toFixed(1)} KB • Ready to send</p>
                </div>
              </div>
              <button 
                onClick={clearSelectedFile}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors flex-shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <form onSubmit={sendMessage} className="p-3 flex gap-2 items-center relative">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              className="hidden" 
            />
            <button 
              type="button" 
              onClick={() => fileInputRef.current?.click()} 
              className={`p-2.5 rounded-xl transition-colors ${selectedFile ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-[#3B0A0A] bg-gray-50 hover:bg-red-50'}`}
              title="Attach a file"
            >
              <Paperclip size={18} />
            </button>

            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder="Type a message..." 
              className="flex-1 bg-gray-50 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B0A0A] font-bold" 
            />
            
            <button 
              type="submit" 
              disabled={!input.trim() && !selectedFile} 
              className="bg-[#3B0A0A] text-white p-3 rounded-xl hover:bg-red-900 transition shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

const User = () => {
  const [users, setUsers] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [chatUser, setChatUser] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, targetId: null });
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  
  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState({ firstName: '', lastName: '', username: '', profilePicture: '', uid: '' });
  const [uploadingImage, setUploadingImage] = useState(false);
  const profileFileInputRef = useRef(null);

  const [searchTerm, setSearchTerm] = useState("");
  
  const [activeRoleTab, setActiveRoleTab] = useState('user');

  const [formData, setFormData] = useState({ 
    firstName: '', 
    lastName: '', 
    username: '', 
    password: '', 
    confirmPassword: '',
    role: 'user' 
  });

  const backendUrl = "http://localhost:8000";

  useEffect(() => {
    const db = getDatabase();
    const usersRef = ref(db, 'users');
    const unsubUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map(uid => ({ uid, ...data[uid] }));
        setUsers(list);
      } else { setUsers([]); }
      setLoading(false);
    });

    const chatsRef = ref(db, 'chats');
    const unsubChats = onValue(chatsRef, (snapshot) => {
        const data = snapshot.val();
        const counts = {};
        if (data) {
            Object.keys(data).forEach(uid => {
                const userMessages = data[uid];
                if (userMessages) {
                    const count = Object.values(userMessages).filter(m => m.sender === 'user' && !m.seen).length;
                    counts[uid] = count;
                }
            });
        }
        setUnreadCounts(counts);
    });

    return () => { unsubUsers(); unsubChats(); };
  }, []);

  const requestCreate = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) { alert("Passwords do not match!"); return; }
    
    // DEBUG: Ensure we are sending the correct role!
    console.log("Submitting User with Role:", formData.role);
    
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
        setSuccessMessage(type === 'create' ? "Account Created Successfully!" : "User Account Deleted!");
        if (type === 'create') {
            setFormData({ firstName: '', lastName: '', username: '', password: '', confirmPassword: '', role: activeRoleTab });
            setIsAddModalOpen(false);
        }
      } else {
        const errData = await response.json();
        alert(`Error: ${errData.detail || 'Failed to process'}`);
      }
    } catch (e) { console.error(e); }
  };

  // --- EDIT PROFILE LOGIC ---
  const handleProfileImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const uniqueName = `profiles/${editUser.uid}_${Date.now()}_${cleanName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('profile_ccjs')
        .upload(uniqueName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('profile_ccjs')
        .getPublicUrl(uniqueName);

      setEditUser(prev => ({ ...prev, profilePicture: data.publicUrl }));
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload image. Check Supabase permissions.");
    } finally {
      setUploadingImage(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    try {
      const db = getDatabase();
      await update(ref(db, `users/${editUser.uid}`), {
        firstName: editUser.firstName,
        lastName: editUser.lastName,
        fullName: `${editUser.firstName} ${editUser.lastName}`,
        username: editUser.username,
        profilePicture: editUser.profilePicture || null
      });
      setSuccessMessage("Account updated successfully!");
      setIsEditModalOpen(false);
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user details.");
    }
  };


  const filteredUsers = users.filter(u => {
    const dbRole = (u.role || '').toLowerCase();
    const isNotAdmin = dbRole !== 'admin';
    
    const effectiveRole = (dbRole === 'personnel' || dbRole === 'staff') ? 'personnel' : 'user';
    const matchesTab = effectiveRole === activeRoleTab;

    const username = u.username || ""; 
    const firstName = u.firstName || "";
    const lastName = u.lastName || "";
    const fullName = firstName + " " + lastName;
    
    const matchesSearch = username.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          fullName.toLowerCase().includes(searchTerm.toLowerCase());
    
    return isNotAdmin && matchesTab && matchesSearch;
  });

  return (
    <div className="bg-gray-50 h-full w-full p-6 animate-fade-in font-sans text-gray-800">
      <SuccessModal message={successMessage} onClose={() => setSuccessMessage('')} />
      <MessengerModal isOpen={!!chatUser} onClose={() => setChatUser(null)} targetUser={chatUser} />
      <ConfirmModal isOpen={confirmModal.isOpen} type={confirmModal.type} onCancel={() => setConfirmModal({ ...confirmModal, isOpen: false })} onConfirm={performAction} />

      {/* --- TOP TABS --- */}
      <div className="flex gap-2 mb-4 border-b border-gray-200 pb-2">
        <button 
          onClick={() => setActiveRoleTab('user')}
          className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeRoleTab === 'user' 
              ? 'bg-[#3B0A0A] text-white shadow-md' 
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Users size={16} />
          Technicians
        </button>
        <button 
          onClick={() => setActiveRoleTab('personnel')}
          className={`px-5 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
            activeRoleTab === 'personnel' 
              ? 'bg-[#3B0A0A] text-white shadow-md' 
              : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          <Tractor size={16} />
          Personnel
        </button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4 flex-1">
          <div className="p-2.5 bg-red-50 rounded-xl">
            {activeRoleTab === 'user' ? <Users size={22} className="text-[#3B0A0A]" /> : <Tractor size={22} className="text-[#3B0A0A]" />}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder={`Search ${activeRoleTab === 'user' ? 'technicians' : 'personnel'}...`}
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-red-900 outline-none text-xs transition-all font-medium"
            />
          </div>
        </div>
        
        <button 
            onClick={() => {
              setFormData(prev => ({ ...prev, role: activeRoleTab })); 
              setIsAddModalOpen(true);
            }} 
            className="bg-[#3B0A0A] text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-red-900 transition-all flex items-center gap-2 shadow-lg shadow-red-900/20 active:scale-95 whitespace-nowrap"
        >
            <UserPlus size={16} /> 
            Add User
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  {activeRoleTab === 'user' ? 'Technician' : 'Personnel'} Identity
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Messages</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan="4" className="py-20 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#3B0A0A] mx-auto"></div></td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="4" className="py-20 text-center text-gray-300 text-xs font-medium uppercase tracking-widest">No {activeRoleTab === 'user' ? 'technicians' : 'personnel'} found</td></tr>
              ) : filteredUsers.map((u) => {
                const unread = unreadCounts[u.uid] || 0;
                return (
                  <tr key={u.uid} className="hover:bg-gray-50/40 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-9 h-9 rounded-full bg-gray-100 flex-shrink-0 border border-gray-200 overflow-hidden">
                          {u.profilePicture ? (
                              <img src={u.profilePicture} className="w-full h-full object-cover" alt="" />
                          ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400 font-black text-xs">
                                  {(u.username || "U").charAt(0).toUpperCase()}
                              </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-gray-800">{u.username || "Unknown"}</span>
                          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">{u.firstName} {u.lastName}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter border ${
                            u.status === 'online' 
                            ? 'bg-green-50 text-green-700 border-green-100' 
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}>
                            {u.status === 'online' ? 'Online Now' : 'Offline'}
                        </span>
                    </td>

                    <td className="px-6 py-4">
                        {unread > 0 ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100 text-[10px] font-bold animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                                {unread} New Message{unread > 1 ? 's' : ''}
                            </span>
                        ) : (
                            <span className="text-[10px] text-gray-400 font-medium">All caught up</span>
                        )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => setChatUser(u)} 
                            className={`p-2 rounded-lg transition-colors ${unread > 0 ? 'text-blue-600 bg-blue-50 hover:bg-blue-100' : 'text-gray-400 hover:bg-gray-100 hover:text-blue-600'}`}
                            title="Open Chat"
                        >
                            <MessageSquare size={16} />
                        </button>
                        <button 
                            onClick={() => {
                              setEditUser({ ...u });
                              setIsEditModalOpen(true);
                            }} 
                            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-green-600 rounded-lg transition-colors" 
                            title="Edit User"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => setConfirmModal({ isOpen: true, type: 'delete', targetId: u.uid })} 
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors" 
                            title="Delete User"
                        >
                            <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- ADD USER MODAL --- */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 animate-fade-in">
            <div className="bg-[#3B0A0A] p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/10 rounded-lg"><UserPlus size={18}/></div>
                <h2 className="font-bold text-sm tracking-tight">Register New Account</h2>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="hover:rotate-90 transition-transform duration-200"><X size={20} /></button>
            </div>
            
            <form onSubmit={requestCreate} className="p-5 space-y-4">
              
              {/* Role Toggle Selector */}
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-2 ml-1">Account Role</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, role: 'user'}))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                      formData.role === 'user' 
                        ? 'bg-red-50 text-[#3B0A0A] border-red-200 shadow-sm' 
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Users size={14} /> Technician
                  </button>
                  <button 
                    type="button"
                    onClick={() => setFormData(prev => ({...prev, role: 'personnel'}))}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center justify-center gap-2 ${
                      formData.role === 'personnel' 
                        ? 'bg-red-50 text-[#3B0A0A] border-red-200 shadow-sm' 
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    <Tractor size={14} /> Personnel
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">First Name</label>
                    <input type="text" required value={formData.firstName} onChange={(e)=>setFormData(prev => ({...prev, firstName:e.target.value}))} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Last Name</label>
                    <input type="text" required value={formData.lastName} onChange={(e)=>setFormData(prev => ({...prev, lastName:e.target.value}))} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Username</label>
                <input type="text" required value={formData.username} onChange={(e)=>setFormData(prev => ({...prev, username:e.target.value}))} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
              </div>

              <PasswordInput label="Create Password" value={formData.password} onChange={(e)=>setFormData(prev => ({...prev, password:e.target.value}))} />
              <PasswordInput label="Confirm Password" value={formData.confirmPassword} onChange={(e)=>setFormData(prev => ({...prev, confirmPassword:e.target.value}))} />

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="flex-1 bg-gray-50 text-gray-500 font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-gray-100 transition-all">Cancel</button>
                <button type="submit" className="flex-1 bg-[#3B0A0A] text-white font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-red-900 transition-all shadow-lg active:scale-95">Create Account</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- EDIT USER MODAL --- */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-gray-100 animate-fade-in">
            <div className="bg-[#3B0A0A] p-4 flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/10 rounded-lg"><Edit2 size={18}/></div>
                <h2 className="font-bold text-sm tracking-tight">Edit Profile</h2>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="hover:rotate-90 transition-transform duration-200"><X size={20} /></button>
            </div>
            
            <form onSubmit={submitEdit} className="p-5 space-y-4">
              
              {/* Profile Image Uploader */}
              <div className="flex flex-col items-center justify-center mb-2">
                <input 
                  type="file" 
                  accept="image/*"
                  ref={profileFileInputRef}
                  onChange={handleProfileImageUpload}
                  className="hidden"
                />
                <div 
                  onClick={() => profileFileInputRef.current?.click()}
                  className="relative w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-red-900 hover:bg-gray-50 transition-all group overflow-hidden shadow-sm"
                >
                  {uploadingImage ? (
                    <Loader2 className="animate-spin text-[#3B0A0A]" size={24} />
                  ) : editUser.profilePicture ? (
                    <>
                      <img src={editUser.profilePicture} alt="Profile" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera size={20} className="text-white" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-[#3B0A0A]">
                      <Camera size={24} className="mb-1" />
                      <span className="text-[8px] font-bold uppercase tracking-widest">Upload</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">First Name</label>
                    <input type="text" required value={editUser.firstName} onChange={(e)=>setEditUser(prev => ({...prev, firstName:e.target.value}))} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                </div>
                <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Last Name</label>
                    <input type="text" required value={editUser.lastName} onChange={(e)=>setEditUser(prev => ({...prev, lastName:e.target.value}))} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase block mb-1 ml-1">Username</label>
                <input type="text" required value={editUser.username} onChange={(e)=>setEditUser(prev => ({...prev, username:e.target.value}))} className="w-full bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-red-900 font-bold" />
              </div>

              <div className="flex gap-2 pt-4">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="flex-1 bg-gray-50 text-gray-500 font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-gray-100 transition-all">Cancel</button>
                <button type="submit" disabled={uploadingImage} className="flex-1 bg-[#3B0A0A] text-white font-bold py-3 rounded-xl text-[10px] uppercase hover:bg-red-900 transition-all shadow-lg active:scale-95 disabled:opacity-50">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

export default User;