import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; // Removed BrowserRouter
import { onAuthStateChanged } from 'firebase/auth'; 
import { auth } from './firebase'; 
import Signup from './Auth/Signup';
import Login from './Auth/Login';
import Dashboard from './Pages/Dashboard'; // Corrected path case sensitivity

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);    
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={user ? <Navigate to="/dashboard" /> : <Login />} 
      />
      <Route path="/signup" element={<Signup />} />
      <Route 
        path="/dashboard/*" 
        element={user ? <Dashboard /> : <Navigate to="/" />}  
      />
    </Routes>
  );
}

export default App;