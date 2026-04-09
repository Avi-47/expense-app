import { useState } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Group from "./pages/Group";
import ProtectedRoute from "./components/ProtectedRoute";
import Chat from "./pages/Chat";
import Invite from "./pages/Invite";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>}/>
        <Route path="/group/:groupId" element={<ProtectedRoute><Group /></ProtectedRoute>}/>
        <Route path="/chat/:userId" element={<Chat />} />
        <Route path="/invite" element={<ProtectedRoute><Invite /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
