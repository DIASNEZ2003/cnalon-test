import React, { useState } from 'react';
import { auth } from '../firebase'; 
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';

const Signup = () => {
  const [form, setForm] = useState({ firstName: '', lastName: '', username: '', password: '', confirm: '' });
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return alert("Passwords do not match");
    const firebaseEmail = `${form.username.trim()}@example.com`;

    try {
      const userCert = await createUserWithEmailAndPassword(auth, firebaseEmail, form.password);
      const token = await userCert.user.getIdToken();
      
      const response = await fetch("http://localhost:8000/register-user", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          username: form.username
        })
      });

      if (response.ok) {
        navigate('/');
      }
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="flex min-h-screen w-full bg-red-50">
      {/* Left Side - Image/Branding */}
      <div className="hidden lg:flex w-1/2 items-center justify-center bg-red-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900 to-red-950 opacity-90 z-10"></div>
        {/* Strictly Chicken Image - Chicks */}
        <img 
          src="https://images.unsplash.com/photo-1598460592395-9b2f694488c9?ixlib=rb-1.2.1&auto=format&fit=crop&w=1350&q=80" 
          alt="Chicks" 
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-10000 hover:scale-110"
        />
        <div className="z-20 text-white text-center px-12 animate-fade-in-down">
          {/* Animated Title - No Emoji */}
          <div className="mb-6">
             <h1 className="text-5xl font-extrabold tracking-tight">
               Join Destiny Angas
             </h1>
          </div>
          <p className="text-xl text-red-100 font-light">
            Start monitoring your chicken coop today.
          </p>
        </div>
      </div>

      <div className="flex w-full lg:w-1/2 flex-col justify-center px-8 md:px-16 lg:px-24 bg-white py-12">
        <div className="w-full max-w-md mx-auto animate-slide-up">
          <div className="mb-8 text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
            <p className="text-gray-500">Sign up to manage your Poultry</p>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div className="flex gap-4">
              <div className="w-1/2 group">
                <label className="block text-sm font-medium text-gray-700 mb-1 group-hover:text-red-700 transition-colors">First Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100 transition-all duration-300 outline-none" 
                  onChange={e => setForm({...form, firstName: e.target.value})} 
                  required 
                />
              </div>
              <div className="w-1/2 group">
                <label className="block text-sm font-medium text-gray-700 mb-1 group-hover:text-red-700 transition-colors">Last Name</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100 transition-all duration-300 outline-none" 
                  onChange={e => setForm({...form, lastName: e.target.value})} 
                  required 
                />
              </div>
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1 group-hover:text-red-700 transition-colors">Username</label>
              <input 
                type="text" 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100 transition-all duration-300 outline-none" 
                onChange={e => setForm({...form, username: e.target.value})} 
                required 
              />
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1 group-hover:text-red-700 transition-colors">Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100 transition-all duration-300 outline-none" 
                onChange={e => setForm({...form, password: e.target.value})} 
                required 
              />
            </div>

            <div className="group">
              <label className="block text-sm font-medium text-gray-700 mb-1 group-hover:text-red-700 transition-colors">Confirm Password</label>
              <input 
                type="password" 
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:border-red-600 focus:bg-white focus:ring-4 focus:ring-red-100 transition-all duration-300 outline-none" 
                onChange={e => setForm({...form, confirm: e.target.value})} 
                required 
              />
            </div>

            <button className="w-full mt-6 py-4 px-4 bg-gradient-to-r from-red-800 to-red-900 hover:from-red-900 hover:to-black text-white font-bold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
              Register
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-gray-600">
            Already have an account? <Link to="/" className="font-bold text-red-700 hover:text-red-900 underline transition-colors">Login</Link>
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

export default Signup;