import React, { useState, useEffect, useRef } from "react";
import { auth } from "../firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, update, get } from "firebase/database";
import { supabase } from "../supabaseClient";

import RealDashboard from "../Dashboard/RealDashboard";  

import User from "../Dashboard/User";  

import BatchControl from "../Dashboard/BatchControl";

import Records from "../Dashboard/Records";

import Expenses from "../Dashboard/Expenses";

import Sales from "../Dashboard/Sales";       // Fixed Import

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [user, setUser] = useState(null);
  const [fullName, setFullName] = useState("Boss"); 
  const [profileImage, setProfileImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    const savedState = localStorage.getItem("isSidebarOpen");
    return savedState !== null ? JSON.parse(savedState) : true;
  });

  useEffect(() => {
    localStorage.setItem("isSidebarOpen", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const fileInputRef = useRef(null);

  const navItems = [
    { name: "Dashboard", icon: "/dashboard.png" },
    { name: "Batch Control", icon: "/batch.png" },      
     { name: "Manage User", icon: "/user.png" },
    { name: "Sales", icon: "/sales.png" },             
    { name: "Expenses", icon: "/expenses.png" },       
    { name: "Records", icon: "/folder.png" },          
  ];

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const db = getDatabase();
          const snapshot = await get(ref(db, `users/${currentUser.uid}`));
          if (snapshot.exists()) {
            const data = snapshot.val();
            setProfileImage(data.profileImage || null);
            
            const nameFromEmail = currentUser.email
              ? currentUser.email.split("@")[0]
              : "Admin";

            const displayValue = data.fullName || data.firstName || nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
            
            setFullName(displayValue);
          }
        } catch (error) {
          console.error(error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const confirmLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error(error);
    }
    setShowLogoutModal(false);
  };

  const handleImageUpload = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      setUploading(true);

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.uid}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = data.publicUrl;

      const db = getDatabase();
      await update(ref(db, `users/${user.uid}`), { profileImage: publicUrl });

      setProfileImage(publicUrl);
      setModalMessage("Profile picture updated successfully!");
      setShowSuccessModal(true);
    } catch (error) {
      alert("Upload error: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      
      {/* --- SIDEBAR --- */}
      <aside 
        className={`${isSidebarOpen ? 'w-72' : 'w-24'} bg-red-900 text-white flex flex-col shadow-2xl z-20 transition-all duration-300 relative h-full`}
      >
        {/* Toggle Button */}
        <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`absolute z-30 p-1 rounded hover:bg-red-800 transition-all duration-300 
            ${isSidebarOpen ? 'top-4 right-4' : 'top-4 left-1/2 -translate-x-1/2'}`}
        >
            <img 
                src="/lapse.png" 
                alt="Toggle Sidebar" 
                className={`w-6 h-6 invert object-contain transition-transform duration-300 ${isSidebarOpen ? 'rotate-0' : 'rotate-180'}`}
            />
        </button>

        {/* --- PROFILE SECTION (Fixed at Top) --- */}
        <div className={`flex-shrink-0 flex flex-col items-center justify-center border-b border-red-800 bg-red-950 relative transition-all duration-300 
            ${isSidebarOpen ? 'pt-3 pb-8 px-4' : 'pt-16 pb-6 px-2'}`}>
            
          <div
            className={`relative group cursor-pointer transition-all duration-300 ${isSidebarOpen ? 'h-24 w-24' : 'h-10 w-10'} bg-white rounded-full flex items-center justify-center border-4 border-red-200 shadow-xl overflow-hidden`}
            onClick={() => fileInputRef.current.click()}
            title="Change Photo"
          >
            {profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className={`font-bold text-red-900 ${isSidebarOpen ? 'text-3xl' : 'text-lg'}`}>
                {fullName.charAt(0)}
              </span>
            )}
            <div
              className={`absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-opacity duration-200 ${
                uploading ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <span className="text-white text-xs font-bold">
                {uploading ? "..." : "Edit"}
              </span>
            </div>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            className="hidden"
          />

          {isSidebarOpen && (
              <div className="mt-4 text-center animate-fade-in">
                <h2 className="text-xl font-bold tracking-wide whitespace-nowrap overflow-hidden text-ellipsis">{fullName}</h2>
                <p className="text-xs text-red-200 mt-1 uppercase tracking-wider">
                    Farm Owner
                </p>
              </div>
          )}
        </div>

        {/* --- NAVIGATION ITEMS (Scrollable Middle) --- */}
        <nav className="flex-1 px-3 py-6 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-red-800 scrollbar-track-transparent">
          {navItems.map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`flex items-center w-full px-3 py-3.5 rounded-xl transition-all duration-200 group ${
                activeTab === item.name
                  ? "bg-red-800 text-white shadow-lg"
                  : "text-red-100 hover:bg-red-800/50 hover:text-white"
              } ${!isSidebarOpen && 'justify-center'}`}
              title={!isSidebarOpen ? item.name : ''}
            >
              <img 
                src={item.icon} 
                alt={`${item.name} Icon`} 
                className={`w-6 invert h-6 object-contain transition-all duration-200 ${activeTab === item.name ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} ${isSidebarOpen ? 'mr-4' : 'mr-0'}`} 
              />
              {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.name}</span>}
            </button>
          ))}
        </nav>

        {/* --- LOGOUT SECTION (Fixed at Bottom) --- */}
        <div className="flex-shrink-0 p-4 border-t border-red-800 bg-red-950">
          <button
            onClick={() => setShowLogoutModal(true)}
            className={`flex items-center justify-center w-full py-3 rounded-xl text-red-100 hover:bg-red-900 hover:text-white transition-all shadow-inner border border-red-900 ${isSidebarOpen ? 'px-4' : 'px-0'}`}
            title={!isSidebarOpen ? "Sign Out" : ""}
          >
            {isSidebarOpen ? (
                <span className="font-bold text-sm">Sign Out</span>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            )}
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-gray-50">
        <header className="h-20 bg-white shadow-sm flex items-center justify-between px-8 z-10 flex-shrink-0">
          <h1 className="text-2xl font-extrabold text-red-900 tracking-tight">
            {activeTab}
          </h1>
        </header>

        <div className="flex-1 overflow-y-auto p-8 animate-fade-in-down">
          {/* --- ROUTING LOGIC --- */}
          {activeTab === "Dashboard" && <RealDashboard />}
          {activeTab === "Batch Control" && <BatchControl />}
            {activeTab === "Manage User" && <User />}
          {activeTab === "Sales" && <Sales />}
          {activeTab === "Expenses" && <Expenses />}
          {activeTab === "Records" && <Records />}
        </div>
      </main>

      {/* --- LOGOUT MODAL --- */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-96">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Sign Out</h3>
            <p className="text-gray-500 mb-6">
              Are you sure you want to exit the dashboard?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="px-4 py-2 bg-red-900 text-white font-medium rounded-lg hover:bg-red-800 shadow-md"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS MODAL --- */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-80 text-center">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Success!</h3>
            <p className="text-gray-500 mb-6">{modalMessage}</p>
            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full px-4 py-2 bg-red-900 text-white font-bold rounded-lg hover:bg-red-800"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in-down { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
        .animate-fade-in-down { animation: fade-in-down 0.4s ease-out forwards; }
        @keyframes fade-in { 0% { opacity: 0; } 100% { opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
      `}</style>
    </div>
  );
};

export default Dashboard;