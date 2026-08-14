import { useState, useEffect } from "react";
import api from "../../services/api";

/**
 * Custom hook for managing group messages and sending
 */
export const useGroupMessages = (groupId) => {
  const [messages, setMessages] = useState([]);

  const fetchMessages = async () => {
    const res = await api.get(`/chat/${groupId}/messages`);
    setMessages(res.data);
  };

  const sendMessage = (socket, currentUser) => (content) => {
    if (!content.trim() || !socket) return;
    
    const messageData = {
      content: content,
      sender: currentUser,
      createdAt: new Date().toISOString()
    };
    
    if (groupId) {
      socket.emit("send_message", {
        groupId,
        content: content
      });
      setMessages(prev => [...prev, messageData]);
    }
  };

  const addMessage = (message) => {
    setMessages(prev => [...prev, message]);
  };

  const setClarificationMessage = (message, senderName) => {
    setMessages(prev => [
      ...prev,
      {
        _id: Date.now(),
        sender: { name: senderName || "System" },
        content: message
      }
    ]);
  };

  useEffect(() => {
    fetchMessages();
  }, [groupId]);

  return {
    messages,
    setMessages,
    fetchMessages,
    sendMessage,
    addMessage,
    setClarificationMessage
  };
};
