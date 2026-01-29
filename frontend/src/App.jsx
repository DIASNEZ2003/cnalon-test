import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth'; // Import the listener
import { auth } from './firebase'; // Import your auth instance
import Signup from './Auth/Signup';
import Login from './Auth/Login';
import Dashboard from './pages/Dashboard';


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
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  return (
    <BrowserRouter>
      <Routes>
        <Route  path="/"   element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route  path="/dashboard" element={user ? <Dashboard /> : <Navigate to="/" />}  />
      </Routes>
    </BrowserRouter>
  );
}

export default App;