import { useState } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Group from "./pages/Group";
import ProtectedRoute from "./components/ProtectedRoute";
import Chat from "./pages/Chat";
import InviteAccept from "./pages/InviteAccept";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Auth />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}/>
        <Route path="/group/:groupId" element={<ProtectedRoute><Group /></ProtectedRoute>}/>
        <Route path="/chat/:userId" element={<Chat />} />
        <Route path="/invite/:token" element={<ProtectedRoute><InviteAccept /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
