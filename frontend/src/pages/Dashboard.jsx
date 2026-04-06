import React, { useEffect, useState, useRef } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import { connectSocket } from "../services/socket";
import { AuthContext } from "../context/AuthContext";
import { useContext } from "react";

function Dashboard() {
  const { user, token } = useContext(AuthContext);
  const [socket, setSocket] = useState(null);
  const currentUser = user || (() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  })();

  const [groups, setGroups] = useState([]);
  const [conversations, setConversations] = useState([]); // Personal chat contacts
  const [invites, setInvites] = useState([]);
  const [newGroup, setNewGroup] = useState("");

  const [mode, setMode] = useState(null);
  const [searchUser, setSearchUser] = useState("");
  const [searchResults, setSearchResults] = useState([]);

  const [selectedInvite, setSelectedInvite] = useState(null);

  // Chat state
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatType, setChatType] = useState(null); // 'user' or 'group'
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const bottomRef = useRef(null);
  const containerRef = useRef(null);

  // Expense Modal State
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseData, setExpenseData] = useState({
    description: "",
    amount: "",
    participants: [],
    includeSelf: true
  });
  const [selectAll, setSelectAll] = useState(false);
  const [groupMembers, setGroupMembers] = useState([]);
  const [balances, setBalances] = useState({});
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [menuOpenMsgId, setMenuOpenMsgId] = useState(null);
  const [showSlidePanel, setShowSlidePanel] = useState(false);
  const [showPhotoMenu, setShowPhotoMenu] = useState(false);

  // Close slide panel when switching chats
  useEffect(() => {
    setShowSlidePanel(false);
    setShowPhotoMenu(false);
  }, [selectedChat?._id]);

  const handleDeleteMessage = async (msgId) => {
    try {
      await api.delete(`/chat/${selectedChat._id}/messages/${msgId}`);
      setMessages(messages.filter(m => m._id !== msgId));
      setMenuOpenMsgId(null);
    } catch (err) {
      console.error("Error deleting message:", err);
    }
  };

  useEffect(() => {
    const handleClickOutside = () => setMenuOpenMsgId(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Helper function to format date with smart labels
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

  // Get date key for grouping messages
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

  // Computed sorted list of all chats and groups
  const sortedChats = React.useMemo(() => {
    const allChats = [];
    
    // Add personal conversations
    conversations.forEach(conv => {
      allChats.push({
        _id: conv.participantId._id,
        name: conv.participantId.name,
        type: 'user',
        lastMessage: conv.lastMessage,
        lastMessageAt: conv.lastMessageAt || conv.updatedAt,
        avatar: conv.participantId.avatar || null,
        balance: conv.balance || 0
      });
    });
    
    // Add groups (with balance if available)
    groups.forEach(group => {
      allChats.push({
        _id: group._id,
        name: group.name,
        type: 'group',
        lastMessage: group.lastMessage,
        lastMessageAt: group.lastMessageAt || group.createdAt,
        avatar: group.avatar || null,
        balance: group.balance || null
      });
    });
    
    // Sort by last message time (most recent first)
    allChats.sort((a, b) => {
      const dateA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const dateB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return allChats;
  }, [conversations, groups]);

  const navigate = useNavigate();

  // NO global wheel handler - let each container handle its own scroll natively

  // Socket initialization
  useEffect(() => {
    if (!token) return;

    const newSocket = connectSocket(token);
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  // Auto-scroll to newest message - only if user is near bottom (like WhatsApp/Telegram)
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !bottomRef.current) return;
    
    // Check if user is near bottom (within 100px) - so they don't lose their place
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    
    if (isNearBottom) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 50);
    }
  }, [messages]);

  // Socket message listener
  useEffect(() => {
    if (!socket) return;
    
    socket.on("message_received", (msg) => {
      // For group messages, check groupId or room
      const msgGroupId = msg.groupId || msg.room;
      const currentGroupId = selectedChat?._id;
      
      // Only add message if it belongs to current chat and not already added (check by tempId)
      if (chatType === 'user' && msg.sender === selectedChat?._id) {
        // Check if message already exists (to prevent duplicate from local send)
        setMessages(prev => {
          const exists = prev.some(m => m.tempId === msg.tempId || (m.content === msg.content && new Date(m.createdAt).getTime() === new Date(msg.createdAt).getTime()));
          if (exists) return prev;
          return [...prev, msg];
        });
        // Update conversation with last message
        updateConversation(msg.sender, msg.content);
      } else if (chatType === 'group' && msgGroupId === currentGroupId) {
        setMessages(prev => {
          const exists = prev.some(m => m.tempId === msg.tempId || (m.content === msg.content && new Date(m.createdAt).getTime() === new Date(msg.createdAt).getTime()));
          if (exists) return prev;
          return [...prev, msg];
        });
      }
    });

    return () => socket.off("message_received");
  }, [selectedChat, chatType, socket]);

  // Fetch sidebar on mount
  useEffect(() => {
    fetchSidebar();
  }, []);

  // Select chat/contact and load messages
  const selectChat = async (chat, type) => {
    setSelectedChat(chat);
    setChatType(type);
    setMessages([]);
    
    if (type === 'group') {
      try {
        const res = await api.get(`/chat/${chat._id}/messages`);
        setMessages(res.data);
        
        // Also fetch group details to get members
        const groupRes = await api.get(`/groups/${chat._id}`);
        setGroupMembers(groupRes.data.members || []);
        
        // Join the socket room for this group
        if (socket) {
          socket.emit("join_group", chat._id);
        }
      } catch (err) {
        console.error("Error fetching group messages:", err);
      }
    } else {
      // For user chat, save the contact first
      try {
        await api.post("/users/conversations", { participantId: chat._id });
        // Refresh conversations list
        fetchConversations();
        // Load messages
        const res = await api.get(`/users/messages/${chat._id}`);
        setMessages(res.data);
      } catch (err) {
        console.error("Error fetching user messages:", err);
      }
    }
  };

  // Send message
  const sendMessage = () => {
    if (!messageInput.trim() || !selectedChat || !socket) return;
    
    // Create message object with unique ID to prevent duplicates
    const messageData = {
      content: messageInput,
      sender: currentUser,
      createdAt: new Date().toISOString(),
      tempId: Date.now() // Temporary ID to track local messages
    };
    
    if (chatType === 'user') {
      socket.emit("send_message", {
        receiverId: selectedChat._id,
        content: messageInput
      });
      // Add message to local state immediately
      setMessages(prev => [...prev, messageData]);
      // Update conversation with last message
      updateConversation(selectedChat._id, messageInput);
    } else {
      socket.emit("send_message", {
        groupId: selectedChat._id,
        content: messageInput
      });
      // Add message to local state immediately
      setMessages(prev => [...prev, messageData]);
      // Also update the group with last message for sorting
      fetchSidebar();
    }
    setMessageInput("");
  };

  // Update conversation with last message
  const updateConversation = async (participantId, content) => {
    try {
      await api.put(`/users/conversations/${participantId}`, { lastMessage: content });
      fetchConversations();
    } catch (err) {
      console.error("Error updating conversation:", err);
    }
  };

  // Fetch personal conversations
  const fetchConversations = async () => {
    try {
      const res = await api.get("/users/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("Error fetching conversations:", err);
    }
  };

  const fetchBalances = async () => {
    if (!selectedChat || chatType !== 'group') return;
    try {
      const res = await api.get(`/settlement/${selectedChat._id}/balances`);
      setBalances(res.data.balances);
      setShowBalanceModal(true);
    } catch (err) {
      console.error("Error fetching balances:", err);
    }
};

  const fetchSidebar = async () => {
    try {
      const res = await api.get("/groups/sidebar");

      setGroups(res.data.groups);
      setInvites(res.data.invites);

      // Also fetch personal conversations
      fetchConversations();

    } catch (err) {
      console.error("Sidebar fetch error:", err);
    }
  };

  const createGroup = async () => {
    if (!newGroup.trim()) return;
    try {
      await api.post("/groups", { name: newGroup });
      setNewGroup("");
      fetchSidebar();
    } catch (err) {
      console.error("Error creating group:", err);
    }
  };

  const searchUsers = async () => {
    if (!searchUser.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/users/search?q=${searchUser}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error("Search error:", err);
    }
  };

  const openInvite = (invite) => {
    setSelectedInvite(invite);
  };

  const respondInvite = async (inviteId, action) => {
    try {

      await api.post(`/groups/invite/${inviteId}/respond`, {
        action
      });

      setSelectedInvite(null);

      fetchSidebar();
      
      // Also refresh user conversations
      fetchConversations();

    } catch (err) {
      console.error("Error responding to invite:", err);
    }
  };

  return (
    <div className="h-screen flex bg-gray-900 text-white">
      
      {/* LEFT SIDEBAR - 30% */}
      <div className="w-[30%] flex flex-col border-r border-gray-700">
        
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-700 bg-gray-800">
          <div className="font-bold text-lg mb-2">Chats</div>
          
          {/* Search & Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setMode(mode === "findUser" ? null : "findUser");
                setSearchResults([]);
                setSearchUser("");
              }}
              className="bg-blue-600 px-3 py-1.5 rounded text-sm flex-1"
            >
              🔍 Find
            </button>
            <button
              onClick={() => setMode(mode === "createGroup" ? null : "createGroup")}
              className="bg-green-600 px-3 py-1.5 rounded text-sm flex-1"
            >
              ➕ Create
            </button>
          </div>
          
          {/* Create Group Input */}
          {mode === "createGroup" && (
            <div className="p-3 border-b border-gray-700">
              <div className="flex gap-2">
                <input
                  className="p-2 bg-gray-800 rounded flex-1 text-sm"
                  placeholder="New group name"
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value)}
                />
                <button
                  onClick={createGroup}
                  disabled={!newGroup.trim()}
                  className="bg-green-600 px-3 rounded text-sm"
                >
                  Create
                </button>
              </div>
            </div>
          )}
          
          {/* Search User */}
          {mode === "findUser" && (
            <div className="p-3 border-b border-gray-700">
              <div className="flex gap-2 mb-2">
                <input
                  className="p-2 bg-gray-800 rounded flex-1 text-sm"
                  placeholder="Type user email"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") searchUsers();
                  }}
                />
                <button
                  onClick={searchUsers}
                  className="bg-blue-600 px-3 rounded text-sm"
                >
                  Find
                </button>
              </div>
              {/* Search Results */}
              <div className="max-h-32 overflow-y-auto space-y-1">
                {searchResults.map(user => (
                  <div
                    key={user._id}
                    className="bg-gray-800 p-2 rounded cursor-pointer hover:bg-gray-700 text-sm"
                    onClick={() => selectChat(user, 'user')}
                  >
                    {user.name} ({user.email})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Groups & Invites List */}
        <div className="flex-1 p-2 overflow-y-auto">
          
          {/* Combined sorted list - balance colors on left side - DEMO DATA FOR TESTING */}
          {sortedChats.map(chat => {
            // DEMO: assign fake balances for testing - DELETE AFTER TESTING!
            // This simulates: user owes some, some owe user
            let demoBalance = 0;
            if (chat.type === 'user') {
              // 90% chance of having a balance for demo
              demoBalance = Math.random() > 0.1 ? Math.floor(Math.random() * 200 + 10) * (Math.random() > 0.5 ? 1 : -1) : 0;
            } else if (chat.type === 'group') {
              // 80% chance for groups
              demoBalance = Math.random() > 0.2 ? Math.floor(Math.random() * 100 + 10) * (Math.random() > 0.5 ? 1 : -1) : 0;
            }
            
            const balance = chat.balance !== undefined ? chat.balance : demoBalance;
            
            // Determine styling based on balance
            let textColorClass = '';
            let showBalance = false;
            if (balance !== undefined && balance !== null && balance !== 0) {
              showBalance = true;
              // balance > 0 = they owe me = RED, balance < 0 = I owe them = GREEN
              textColorClass = balance > 0 ? 'text-red-500' : 'text-green-500';
            }
            
            return (
              <div
                key={chat._id}
                onClick={() => selectChat(chat, chat.type)}
                className={`p-3 rounded cursor-pointer hover:bg-gray-700 mb-1 flex items-start ${
                  selectedChat?._id === chat._id && chatType === chat.type ? 'bg-gray-800' : ''
                } ${showBalance ? textColorClass : ''}`}
              >
                {/* Profile Picture Circle */}
                <div className="w-10 h-10 rounded-full bg-gray-600 flex-shrink-0 mr-3 overflow-hidden flex items-center justify-center">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300 font-bold text-lg">
                      {chat.type === 'group' ? 'G' : chat.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                
                {/* Left side - Name, Last Message + Balance */}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold truncate">
                      {chat.name}
                    </div>
                    {showBalance && (
                      <span className={`text-xs font-bold flex-shrink-0 ${balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {balance > 0 ? `+₹${Math.abs(balance)}` : `-₹${Math.abs(balance)}`}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {chat.lastMessage}
                  </div>
                </div>
                
                {/* Right side - Time and Balance display */}
                <div className="flex flex-col items-end flex-shrink-0 ml-2">
                  <div className="text-xs text-gray-500">
                    {chat.lastMessageAt ? new Date(chat.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                  {showBalance && (
                    <span className={`text-xs font-bold ${balance > 0 ? 'text-red-500' : 'text-green-500'}`}>
                      {balance > 0 ? `+₹${Math.abs(balance)}` : `-₹${Math.abs(balance)}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Invites */}
          {invites.map(inv => (
            <div
              key={inv._id}
              className="bg-blue-900 border border-blue-500 p-3 rounded cursor-pointer hover:bg-blue-700 mb-1"
              onClick={() => openInvite(inv)}
            >
              🔔 Invite: {inv.groupId.name}
            </div>
          ))}
          
        </div>
      </div>
      
      {/* RIGHT CHAT AREA - 70% */}
      <div className="w-[70%] flex flex-col h-screen relative" style={{ minHeight: 0 }}>
        
        {selectedChat ? (
          <>
            {/* Slide Panel - ends above input, wider and slides slower */}
            {showSlidePanel ? (
              <div className="absolute left-0 top-0 bottom-16 w-80 bg-gray-800 shadow-xl z-50 overflow-hidden flex flex-col">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-lg font-semibold">Details</h2>
                  <button onClick={() => setShowSlidePanel(false)} className="text-gray-400 hover:text-white">
                    ✕
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto" onClick={() => setShowPhotoMenu(false)}>
                  {/* Profile Section */}
                  <div className="flex flex-col items-center p-6">
                    {/* Profile Pic Circle - clickable for photo menu */}
                    <div className="relative group">
                      <button 
                        className="w-24 h-24 rounded-full bg-gray-600 flex-shrink-0 overflow-hidden flex items-center justify-center focus:outline-none"
                        onClick={(e) => { e.stopPropagation(); setShowPhotoMenu(!showPhotoMenu); }}
                      >
                        {selectedChat.avatar ? (
                          <img src={selectedChat.avatar} alt={selectedChat.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-white font-bold text-3xl">
                            {chatType === 'group' ? 'G' : selectedChat.name?.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </button>
                      {/* Camera overlay - always clickable */}
                      {chatType === 'group' && (
                        <button 
                          className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-10"
                          onClick={(e) => { e.stopPropagation(); setShowPhotoMenu(!showPhotoMenu); }}
                        >
                          <span className="text-white text-2xl">📷</span>
                        </button>
                      )}
                    </div>
                    {/* Group Name */}
                    <h3 className="text-xl font-semibold mt-4">{selectedChat.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">{chatType === 'group' ? 'Group' : 'Personal chat'}</p>
                    
                    {/* Photo Menu */}
                    {showPhotoMenu && chatType === 'group' && (
                      <div className="mt-4 bg-gray-700 rounded-lg p-2 w-40" onClick={(e) => e.stopPropagation()}>
                        <button className="block w-full text-left text-white text-sm py-2 hover:bg-gray-600 px-2 rounded">
                          Choose from gallery
                        </button>
                        <button className="block w-full text-left text-white text-sm py-2 hover:bg-gray-600 px-2 rounded">
                          Take photo
                        </button>
                        {selectedChat.avatar && (
                          <button className="block w-full text-left text-red-400 text-sm py-2 hover:bg-gray-600 px-2 rounded">
                            Remove photo
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="p-4 bg-gray-800 border-b border-gray-700 flex justify-between items-center">
              <div className="font-semibold flex items-center gap-2">
                {/* Profile Pic Circle - Clickable for slide panel */}
                <button 
                  onClick={() => setShowSlidePanel(!showSlidePanel)}
                  className="w-8 h-8 rounded-full bg-gray-600 flex-shrink-0 overflow-hidden flex items-center justify-center hover:opacity-80 transition-opacity"
                >
                  {selectedChat.avatar ? (
                    <img src={selectedChat.avatar} alt={selectedChat.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-gray-300 font-bold text-sm">
                      {chatType === 'group' ? 'G' : selectedChat.name?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                {selectedChat.name}
              </div>
              
              {chatType === 'group' && (
                <button
                  onClick={fetchBalances}
                  className="text-gray-400 hover:text-white text-lg"
                  title="View Balance"
                >
                  (i)
                </button>
              )}
            </div>
            
{/* Messages area - with spacer to push messages to bottom */}
            <div 
              ref={containerRef}
              className="flex-1 overflow-y-auto flex flex-col"
              style={{ minHeight: 0 }}
            >
              {/* SPACER: This pushes messages to bottom when content is short */}
              <div className="flex-grow" />
              
              {/* Messages container */}
              <div className="p-4 messages-area">
              {(() => {
                let lastDateKey = null;
                return messages.map((msg, i) => {
                  const currentDateKey = getDateKey(msg.createdAt || msg.timestamp);
                  const showDateSeparator = currentDateKey !== lastDateKey;
                  lastDateKey = currentDateKey;
                  
                  let senderId;
                  if (msg.sender && typeof msg.sender === "object") {
                    senderId = msg.sender._id || msg.sender.id;
                  } else {
                    senderId = msg.sender;
                  }
                  
                  const senderName =
                    msg.sender && typeof msg.sender === "object" ? msg.sender.name : "User";
                  
                  let currentUserId = null;
                  try {
                    const stored = localStorage.getItem("user");
                    if (stored) {
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
                        <div className="flex justify-center my-2">
                          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">
                            {formatMessageDate(msg.createdAt || msg.timestamp)}
                          </span>
                        </div>
                      )}
                      <div
                        className={`flex w-full ${isMe ? "justify-end" : "justify-start"}`}
                        style={{ alignItems: "flex-end" }}
                      >
                        <div className="relative flex items-center mb-2 group">
                          {isMe && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenMsgId(menuOpenMsgId === msg._id ? null : msg._id);
                                }}
                                className={`text-gray-300 hover:text-white p-1 mr-1 cursor-pointer transition-opacity ${menuOpenMsgId === msg._id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                              >
                                ⋮
                              </button>
                              {(menuOpenMsgId === msg._id) && (
                                <div 
                                  className="absolute mr-2 rounded-lg shadow-lg z-10 p-1"
                                  style={{ right: '100%', top: '0', marginRight: '2px', backgroundColor: '#1f2937' }}
                                >
                                  <button
                                    onClick={() => handleDeleteMessage(msg._id)}
                                    className="text-red-400 hover:text-red-300 px-3 py-2 text-sm block w-full text-left rounded"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg break-words ${
                              isMe ? "bg-blue-600" : "bg-gray-700 self-start"
                            }`}
                            style={{ minWidth: "80px" }}
                          >
                            {!isMe && chatType === 'group' && (
                              <div className="text-xs text-gray-300 mb-1">
                                {senderName}
                              </div>
                            )}
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                });
              })()}
              <div ref={bottomRef}></div>
              </div>{/* End messages-area */}
            </div>{/* End flex container with spacer */}
            
            {/* Message Input */}
            <div className="p-4 border-t border-gray-700 flex gap-2">
              <button
                onClick={() => {
                  if (chatType !== 'group') {
                    alert("Add Expense is only available in group chats");
                    return;
                  }
                  setShowExpenseModal(true);
                }}
                className="bg-green-600 px-3 py-2 rounded text-white text-sm"
              >
                + Add Expense
              </button>
              <input
                className="flex-1 p-2 bg-gray-800 rounded outline-none"
                placeholder="Type message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 px-4 rounded"
              >
                Send
              </button>
            </div>

            {/* EXPENSE MODAL IN DASHBOARD */}
            {showExpenseModal && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                <div className="bg-gray-800 p-6 rounded-lg w-96 space-y-4">
                  <h3 className="text-lg font-bold text-white">Add Expense</h3>

                  <input
                    className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
                    placeholder="Description (reason of spend)"
                    value={expenseData.description}
                    onChange={(e) =>
                      setExpenseData({ ...expenseData, description: e.target.value })
                    }
                  />

                  <input
                    type="number"
                    className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600"
                    placeholder="Amount (cost spend)"
                    value={expenseData.amount}
                    onChange={(e) =>
                      setExpenseData({ ...expenseData, amount: e.target.value })
                    }
                  />

                  <div>
                    <div className="mb-2">
                      <label className="text-sm text-gray-300">Split Between:</label>
                    </div>

                    <div className="space-y-2">
                      {/* All checkbox */}
                      <div className="flex items-center gap-2 border-b border-gray-600 pb-2 mb-2">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={(e) => {
                            if (e.target.checked) {
                              const allMemberIds = groupMembers.map(m => m._id || m.id);
                              setExpenseData({
                                ...expenseData,
                                participants: allMemberIds
                              });
                              setSelectAll(true);
                            } else {
                              setSelectAll(false);
                            }
                          }}
                        />
                        <span className="font-semibold text-white">Select All</span>
                      </div>

                      {groupMembers && groupMembers.map(member => {
                        const memberId = member._id || member.id;
                        return (
                          <div key={memberId} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={expenseData.participants.includes(memberId)}
                              onChange={(e) => {
                                const currentParticipants = expenseData.participants;
                                let newParticipants;
                                
                                if (e.target.checked) {
                                  newParticipants = [...currentParticipants, memberId];
                                } else {
                                  newParticipants = currentParticipants.filter(
                                    id => id !== memberId
                                  );
                                  setSelectAll(false);
                                }
                                
                                const allMemberIds = groupMembers.map(m => m._id || m.id);
                                const allSelected = allMemberIds.every(id => 
                                  newParticipants.includes(id)
                                );
                                
                                setSelectAll(allSelected);
                                
                                setExpenseData({
                                  ...expenseData,
                                  participants: newParticipants
                                });
                              }}
                            />
                            <span className="text-white">{member.name || member.email}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-between gap-2">
                    <button
                      onClick={() => setShowExpenseModal(false)}
                      className="bg-red-600 px-4 py-2 rounded text-white"
                    >
                      Cancel
                    </button>

                    <button
                      onClick={async () => {
                        if (!expenseData.description || !expenseData.amount || expenseData.participants.length === 0) {
                          alert("Please fill all fields and select at least one participant");
                          return;
                        }
                        
                        try {
                          await api.post(`/expenses/${selectedChat._id}/confirm`, {
                            description: expenseData.description,
                            amount: Number(expenseData.amount),
                            involvedUsers: expenseData.participants,
                            splitType: "equal"
                          });

                          setShowExpenseModal(false);
                          setExpenseData({
                            description: "",
                            amount: "",
                            participants: [],
                            includeSelf: true
                          });
                          setSelectAll(false);
                          
                          // Refresh messages to see the expense
                          const res = await api.get(`/chat/${selectedChat._id}/messages`);
                          setMessages(res.data);
                          
                          alert("Expense added successfully!");
                        } catch (err) {
                          console.error("Error adding expense:", err);
                          alert(err.response?.data?.message || "Failed to add expense");
                        }
                      }}
                      className="bg-green-600 px-4 py-2 rounded text-white"
                    >
                      Save
                    </button>
                  </div>

                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-xl mb-2">💬</p>
              <p>Select a chat to start messaging</p>
            </div>
          </div>
        )}
        
      </div>
      
      {/* INVITE MODAL */}
      {selectedInvite && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center">
          <div className="bg-gray-800 p-6 rounded w-80">
            <p className="mb-4 text-center">
              {selectedInvite.fromUser.name}
              {" "}invited you to join
              <b> {selectedInvite.groupId.name}</b>
            </p>
            <div className="flex justify-between">
              <button
                className="bg-green-600 px-4 py-2 rounded"
                onClick={() => respondInvite(selectedInvite._id, "accept")}
              >
                Accept
              </button>
              <button
                className="bg-red-600 px-4 py-2 rounded"
                onClick={() => respondInvite(selectedInvite._id, "reject")}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BALANCE MODAL */}
      {showBalanceModal && chatType === 'group' && selectedChat && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">Balance Details</h3>
              <button
                onClick={() => setShowBalanceModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-300 mb-2">Individual Balances:</h4>
              {groupMembers && groupMembers.map(member => {
                const rawAmount = balances?.[member._id] ?? 0;
                const roundedAmount = Math.round(Math.abs(rawAmount));
                let color = "text-blue-400";
                let display = "";
                if (rawAmount > 0) {
                  color = "text-red-500"; // they owe me
                  display = `owes me ₹${roundedAmount}`;
                } else if (rawAmount < 0) {
                  color = "text-green-500"; // I owe them
                  display = `I owe ₹${roundedAmount}`;
                } else {
                  display = "settled";
                }
                
                return (
                  <div key={member._id} className={`flex justify-between p-2 rounded ${color}`}>
                    <span>{member.name || member.email}</span>
                    <span className="font-semibold">{display}</span>
                  </div>
                );
              })}
            </div>

            </div>
        </div>
      )}

    </div>
  );
}

export default Dashboard;
