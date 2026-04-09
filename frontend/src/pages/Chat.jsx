import React from "react";
import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useContext, useCallback } from "react";
import socket from "../socket";
import { AuthContext } from "../context/AuthContext";

const formatMessageDate = (timestamp) => {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  
  if (msgDate.getTime() === today.getTime()) {
    return `Today ${time}`;
  } else if (msgDate.getTime() === yesterday.getTime()) {
    return `Yesterday ${time}`;
  } else {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year} ${time}`;
  }
};

const getDateKey = (timestamp) => {
  if (!timestamp) return 'unknown';
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  if (msgDate.getTime() === today.getTime()) return 'today';
  if (msgDate.getTime() === yesterday.getTime()) return 'yesterday';
  return date.toISOString().split('T')[0];
};

function Chat() {
  const { user } = useContext(AuthContext);
  const { userId } = useParams();

  const currentUser = user;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);

  const messagesContainerRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    socket.on("message_received", (msg) => {
      setMessages(prev => [...prev, msg]);
    });
    return () => socket.off("message_received");
  }, []);

  const sendMessage = () => {
    if (!input.trim()) return;
    const messageData = {
      receiverId: userId,
      content: input,
      sender: currentUser,
      createdAt: new Date().toISOString()
    };
    socket.emit("send_message", messageData);
    setMessages(prev => [...prev, messageData]);
    setInput("");
  };

  const renderMessage = (msg, i) => {
    const currentDateKey = getDateKey(msg.createdAt || msg.timestamp);
    const showDateSeparator = i === 0 || currentDateKey !== getDateKey(messages[i-1]?.createdAt || messages[i-1]?.timestamp);
    
    let senderId;
    if (msg.sender && typeof msg.sender === "object") {
      senderId = msg.sender._id || msg.sender.id;
    } else {
      senderId = msg.sender;
    }
    
    const senderName = msg.sender && typeof msg.sender === "object" ? msg.sender.name : "User";
    
    let currentUserId = null;
    try {
      const stored = localStorage.getItem("user");
      if (stored && stored !== "undefined") {
        const parsed = JSON.parse(stored);
        currentUserId = parsed?.id || parsed?._id || null;
      }
    } catch (e) {
      console.error("Error parsing user:", e);
    }
    
    const senderIdStr = senderId ? String(senderId) : "";
    const currentUserIdStr = currentUserId ? String(currentUserId) : "";
    const isMe = senderIdStr === currentUserIdStr && senderIdStr !== "" && currentUserIdStr !== "";

    return (
      <React.Fragment key={i}>
        {showDateSeparator && (
          <div className="date-separator">
            <span className="date-label">
              {formatMessageDate(msg.createdAt || msg.timestamp)}
            </span>
          </div>
        )}
        <div className={`message-row ${isMe ? "message-mine" : "message-other"}`}>
          <div className={`message-bubble ${isMe ? "bubble-mine" : "bubble-other"}`}>
            {!isMe && <div className="sender-name">{senderName}</div>}
            {msg.content}
          </div>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="chat-wrapper">
      <div className="chat-header">
        Chat
      </div>

<div 
          className="messages-container" 
          ref={messagesContainerRef}
        >
        {messages.map(renderMessage)}
        <div ref={bottomRef}></div>
      </div>

      <div className="chat-input">
        <input
          className="chat-input-field"
          placeholder="Type message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
        />
        <button onClick={sendMessage} className="chat-send-btn">
          Send
        </button>
      </div>
    </div>
  );
}

export default Chat;