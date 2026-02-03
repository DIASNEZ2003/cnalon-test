import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'; // Added signOut
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    // 1. MATCHING DOMAIN: Using @poultry.com to match your backend and signup logic
    const firebaseEmail = `${username.trim()}@example.com`; 
    
    try {
      // Step A: Sign in with Firebase
      const userCert = await signInWithEmailAndPassword(auth, firebaseEmail, password);
      const token = await userCert.user.getIdToken();

      // Step B: Verify the ADMIN role via your FastAPI backend
      const response = await fetch("http://localhost:8000/verify-login", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}` 
        }
      });

      if (response.ok) {
        // Success: User is an Admin
        navigate('/dashboard'); 
      } else {
        // Failure: User is not an Admin or account doesn't exist
        const errorData = await response.json();
        alert(errorData.detail || "Access Denied: Admin only.");
        
        // Force logout from Firebase so they can't stay "half-logged in"
        await signOut(auth);
      }
    } catch (err) { 
      alert("Invalid Credentials or Connection Error"); 
      console.error(err);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-red-50">
      {/* Left Side - Image/Branding with Animation */}
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-red-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 to-red-950 opacity-90 z-10"></div>
        <img 
          src="https://images.unsplash.com/photo-1563205844-3d9178cb7717?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80" 
          alt="Chicken Farm" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-10000 hover:scale-110"
        />
        <div className="z-20 text-white text-center px-12 animate-fade-in-down">
          <div className="mb-6">
            <h1 className="text-5xl font-extrabold tracking-tight">
              Destiny Angas <br/> Monitoring System
            </h1>
          </div>
          <p className="text-xl text-red-100 font-light tracking-wide">
             Admin Portal: Secure Poultry Management
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 md:px-16 lg:px-24 bg-white">
        <div className="w-full max-w-md mx-auto animate-slide-up">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back, Boss!</h2>
            <p className="text-gray-500">Login to check your Poultry.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-2 group-hover:text-red-700">Username</label>
              <input 
                type="text" 
                placeholder="Enter username" 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100 transition-all duration-300 outline-none" 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>
            
            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-2 group-hover:text-red-700">Password</label>
              <input 
                type="password" 
                placeholder="••••••••" 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100 transition-all duration-300 outline-none" 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input type="checkbox" className="h-4 w-4 text-red-900 focus:ring-red-900 border-gray-300 rounded cursor-pointer" />
                <label className="ml-2 block text-sm text-gray-900 cursor-pointer">Remember me</label>
              </div>
            </div>

            <button className="w-full py-4 px-4 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-900 hover:to-black text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              Sign In
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Need an Admin Account? <Link to="/signup" className="font-bold text-red-700 hover:text-red-900 underline transition-colors">Register here</Link>
          </p>
        </div>
      </div>
      
      <style>{`
        @keyframes slide-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.8s ease-out forwards;
        }
        @keyframes fade-in-down {
          0% { opacity: 0; transform: translateY(-20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down {
          animation: fade-in-down 1s ease-out forwards;
        }
      `}</style>
    </div>
  );
};

export default Login;