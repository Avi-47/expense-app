import React from "react";
import { useParams, useNavigate } from "react-router-dom"
import { useState, useEffect, useRef, useContext, useCallback } from "react";
import api from "../services/api";
import { connectSocket } from "../services/socket";
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

function Group() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useContext(AuthContext);
  const currentUser = user;

  const [socket, setSocket] = useState(null);  
  
  const [group, setGroup] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState([]);

  const inviteLink = group?.inviteToken
    ? `${window.location.origin}/invite/${group.inviteToken}`
    : "";
    const [messages, setMessages] = useState([]);
  const [balances, setBalances] = useState({});
  const [input, setInput] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [proposal, setProposal] = useState(null);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseData, setExpenseData] = useState({
    description: "",
    amount: "",
    participants: [],
    includeSelf: true
  });
  const [selectAll, setSelectAll] = useState(false);

  const [streamingMessage, setStreamingMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const streamingRef = useRef("");
  const [inviteEmail, setInviteEmail] = useState("");

  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  const messagesContainerRef = useRef(null);

  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/auth/search?q=${query}`);
      const currentMemberIds = members.map(m => m._id);
      const filtered = res.data.filter(u => !currentMemberIds.includes(u._id));
      setSearchResults(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  const addUserToGroup = async (user) => {
    try {
      await api.post(`/groups/${groupId}/add-member`, { email: user.email });
      setShowSearch(false);
      setSearchQuery("");
      setSearchResults([]);
      fetchGroup();
      fetchBalances();
    } catch (err) {
      alert(err.response?.data?.message || "Error adding member");
    }
  };

  const copyGroupLink = () => {
    navigator.clipboard.writeText(inviteLink);
    alert("Group link copied!");
  };
  const bottomRef = useRef(null);

  // Debug - log when component mounts
  useEffect(() => {
    console.log("Group component MOUNTED");
  }, []);

  useEffect(() => {
    setTimeout(() => {
      const container = messagesContainerRef.current;
      console.log("=== INITIAL SCROLL CHECK ===");
      console.log("container:", container ? "FOUND" : "NOT FOUND");
      if(container) {
        console.log("scrollHeight:", container.scrollHeight);
        console.log("clientHeight:", container.clientHeight);
        console.log("canScroll:", container.scrollHeight > container.clientHeight);
      }
    }, 1000);
  }, []);

  useEffect(() => {
    if (!token) return;
    const newSocket = connectSocket(token);
    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  const fetchGroup = async () => {
    const res = await api.get(`/groups/${groupId}`);
    setGroup(res.data);
    setGroupName(res.data.name);
    setMembers(res.data.members || []);
  };

  const fetchMessages = async () => {
    const res = await api.get(`/chat/${groupId}/messages`);
    setMessages(res.data);
  };

  const fetchBalances = async () => {
    const res = await api.get(`/settlement/${groupId}/balances`);
    console.log("BALANCES RESPONSE:", JSON.stringify(res.data, null, 2));
    setBalances(res.data.balances);
  };

  const handleInviteUser = async () => {
    try {
      await api.post(`/groups/${groupId}/invite`, {
        email: inviteEmail
      });
      alert("Invite sent!");
      setInviteEmail("");
    } catch (err) {
      alert(err.response?.data?.message || "Invite failed");
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchMessages();
    fetchBalances();
  }, [groupId]);

  useEffect(() => {
    if (!socket) return;

    socket.emit("join_group", groupId);

    socket.on("message_received", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("expense_proposal", (data) => {
      setProposal(data);
    });

    socket.on("ai_stream_chunk", (token) => {
      setIsStreaming(true);
      streamingRef.current += token;
      setStreamingMessage(streamingRef.current);
    });

    socket.on("ai_stream_end", () => {
      setIsStreaming(false);
      streamingRef.current = "";
      setStreamingMessage("");
    });

    return () => {
      socket.emit("leave_group", groupId);
      socket.off("message_received");
      socket.off("expense_proposal");
      socket.off("ai_stream_chunk");
      socket.off("ai_stream_end");
    };
  }, [socket, groupId]);

  useEffect(() => {
    if (!socket) return;
    socket.on("expense_clarification_needed", (data) => {
      setMessages(prev => [
        ...prev,
        {
          _id: Date.now(),
          sender: { name: "System" },
          content: data.message
        }
      ]);
    });
    return () => {
      socket.off("expense_clarification_needed");
    };
  }, [socket]);

  const handleCreateExpense = async () => {
    try {
      await api.post(`/expenses/${groupId}/confirm`, {
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
      fetchBalances();
    } catch (err) {
      console.error(err);
    }
  };

  const sendMessage = () => {
    if (!input.trim() || !socket) return;
    const messageData = {
      content: input,
      sender: currentUser,
      createdAt: new Date().toISOString()
    };
    if (groupId) {
      socket.emit("send_message", {
        groupId,
        content: input
      });
      setMessages(prev => [...prev, messageData]);
    } else {
      socket.emit("send_message", {
        receiverId: userId,
        content: input
      });
      setMessages(prev => [...prev, messageData]);
    }
    setInput("");
  };

  const handlePay = async (toUser, amount) => {
    const res = await api.post(
      `/payments/${groupId}/create-intent`,
      { to: toUser, amount }
    );
    const options = {
      key: res.data.key,
      amount: res.data.amount,
      currency: res.data.currency,
      order_id: res.data.orderId,
      handler: async function (response) {
        await api.post("/payments/verify", response);
        fetchBalances();
      },
    };
    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  const addMember = async () => {
    try {
      await api.post(`/groups/${groupId}/add-member`, {
        email: newMemberEmail,
      });
      setNewMemberEmail("");
      fetchGroup();
      fetchBalances();
    } catch (err) {
      alert(err.response?.data?.message || "Error adding member");
    }
  };

  const handleLeaveGroup = async () => {
    try {
      await api.post(`/groups/${groupId}/leave`);
      alert("You left the group");
      navigate("/dashboard");
    } catch (err) {
      alert(
        err.response?.data?.message ||
        "You must settle all dues before leaving"
      );
    }
  };

  const renderMessage = (msg, i) => {
    const currentDateKey = getDateKey(msg.createdAt || msg.timestamp);
    const showDateSeparator = i === 0 || currentDateKey !== getDateKey(messages[i-1]?.createdAt || messages[i-1]?.timestamp);
    
    let senderId = null;
    if (msg.sender) {
      if (typeof msg.sender === "string") {
        senderId = msg.sender;
      } else if (typeof msg.sender === "object") {
        senderId = msg.sender._id || msg.sender.id || msg.sender.userId || null;
      }
    }

    const senderName = msg.sender && typeof msg.sender === "object" ? msg.sender.name : "Unknown";

    let currentUserId = null;
    try {
      const stored = localStorage.getItem("user");
      if (stored && stored !== "undefined" && stored !== "null") {
        const parsed = JSON.parse(stored);
        currentUserId = parsed?.id || parsed?._id || null;
      }
    } catch (e) {
      // Ignore
    }
    
    const senderIdStr = senderId ? String(senderId) : "";
    const currentUserIdStr = currentUserId ? String(currentUserId) : "";
    const isMe = senderIdStr === currentUserIdStr && senderIdStr !== "" && currentUserIdStr !== "";

    return (
      <React.Fragment key={msg._id || i}>
        {showDateSeparator && (
          <div className="date-separator">
            <span className="date-label">
              {formatMessageDate(msg.createdAt || msg.timestamp)}
            </span>
          </div>
        )}
        <div className={`message-row ${isMe ? "message-mine" : "message-other"}`}>
          <div className={`message-bubble ${isMe ? "bubble-mine" : "bubble-other"}`}>
            {!isMe && <span className="sender-name">{senderName}</span>}
            {msg.type === "invite" ? (
              <div className="bg-blue-800 p-3 rounded">
                <p>{senderName} invited you to join a group</p>
                <button
                  onClick={() => joinGroup(msg.inviteGroupId)}
                  className="bg-green-600 px-3 py-1 rounded mt-2"
                >
                  Join Group
                </button>
              </div>
            ) : (
              <p>{msg.content}</p>
            )}
          </div>
        </div>
      </React.Fragment>
    );
  };

  return (
    <div className="group-wrapper">
      <div className="hidden md:flex md:w-1/4 bg-gray-800 border-r border-gray-700">
        <div className="p-4 font-bold text-lg">Chats</div>
      </div>

      <div className="group-main">
        <div className="group-header">
          <div className="header-left">
            <button
              className="md:hidden"
              onClick={() => navigate("/dashboard")}
            >
              ←
            </button>
            <div className="header-slab" onClick={() => setShowInfo(true)}>
              <div className="header-avatar">
                {groupName.charAt(0).toUpperCase()}
              </div>
              <h2 className="header-group-name">{groupName}</h2>
            </div>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="info-btn"
          >
            (i)
          </button>
        </div>

<div 
          className="messages-container" 
          ref={messagesContainerRef}
        >
          <div className="messages-list">
            {messages.map(renderMessage)}
            {isStreaming && (
              <div className="streaming-message">
                ExpenseAI
                <div className="streaming-text">
                  {streamingMessage}
                </div>
              </div>
            )}
          </div>
          <div ref={bottomRef}></div>
        </div>

        <div className="chat-input">
          <button
            onClick={() => setShowExpenseModal(true)}
            className="expense-btn"
          >
            + Add Expense
          </button>
          <input
            className="chat-input-field"
            placeholder="Type message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
          <button
            onClick={sendMessage}
            className="send-btn"
          >
            Send
          </button>
        </div>
      </div>

      {showInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '320px',
          height: '100vh',
          backgroundColor: '#1f2937',
          borderLeft: '1px solid #374151',
          padding: '1.5rem',
          zIndex: 1000,
          overflowY: 'auto',
          boxSizing: 'border-box'
        }}>
          <button
            onClick={() => setShowInfo(false)}
            style={{ marginBottom: '1rem', padding: '0.5rem', background: 'red', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Close
          </button>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '1.5rem'
            }}>
              {groupName.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-xl font-bold">{groupName}</h2>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-400 mb-2">Members</h3>
            {members.map((member) => {
            const rawAmount = balances?.[member._id] ?? 0;
            const isNegative = rawAmount < 0;
            const isPositive = rawAmount > 0;
            let color = "text-blue-400";
            let clickable = false;
            if (isNegative) {
              color = "text-red-500";
              clickable = true;
            } else if (isPositive) {
              color = "text-green-500";
            }
            return (
              <div
                key={member._id}
                className={`flex justify-between p-2 rounded hover:bg-gray-700 ${color} ${
                  clickable ? "cursor-pointer" : ""
                }`}
                onClick={() =>
                  clickable && handlePay(member._id, Math.abs(rawAmount))
                }
              >
                <span>{member.name}</span>
                <span>₹{Math.abs(rawAmount)}</span>
              </div>
            );
          })}
          </div>

          <button
            className="bg-red-600 px-4 py-2 rounded text-white mt-6 w-full"
            onClick={handleLeaveGroup}
          >
            Leave Group
          </button>
        </div>
      )}

      {proposal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-lg font-bold">Confirm Expense</h3>
            <p>Description: {proposal.description}</p>
            <p>Amount: ₹{proposal.amount}</p>
            <div className="flex justify-between gap-2">
              <button
                className="bg-green-600 px-4 py-2 rounded"
                onClick={async () => {
                  await api.post(`/expenses/${groupId}/confirm`, proposal);
                  setProposal(null);
                  fetchBalances();
                }}
              >
                Confirm
              </button>
              <button
                className="bg-red-600 px-4 py-2 rounded"
                onClick={() => setProposal(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 className="text-lg font-bold">Add Expense</h3>
            <input
              className="w-full p-2 rounded bg-gray-700 text-white"
              placeholder="Description"
              value={expenseData.description}
              onChange={(e) =>
                setExpenseData({ ...expenseData, description: e.target.value })
              }
            />
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-700 text-white"
              placeholder="Amount"
              value={expenseData.amount}
              onChange={(e) =>
                setExpenseData({ ...expenseData, amount: e.target.value })
              }
            />
            <div>
              <div className="mb-2">
                <label className="text-sm">Split Between:</label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 border-b border-gray-600 pb-2 mb-2">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const allMemberIds = members.map(m => m._id);
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
                  <span className="font-semibold">Select All</span>
                </div>
                {members.map(member => (
                  <div key={member._id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={expenseData.participants.includes(member._id)}
                      onChange={(e) => {
                        const currentParticipants = expenseData.participants;
                        let newParticipants;
                        if (e.target.checked) {
                          newParticipants = [...currentParticipants, member._id];
                        } else {
                          newParticipants = currentParticipants.filter(
                            id => id !== member._id
                          );
                          setSelectAll(false);
                        }
                        const allMemberIds = members.map(m => m._id);
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
                    <span>{member.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-between">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="bg-red-600 px-4 py-2 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExpense}
                className="bg-green-600 px-4 py-2 rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showSearch && (
        <div className="modal-overlay">
          <div className="modal-content search-modal">
            <div className="modal-header">
              <h3 className="text-lg font-bold">Add User to Group</h3>
              <button
                className="close-btn"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
              >
                ×
              </button>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => handleSearchUsers(e.target.value)}
              autoFocus
            />
            <div className="search-results">
              {searchResults.length === 0 && searchQuery.length >= 2 && (
                <p className="no-results">No users found</p>
              )}
              {searchResults.map(user => (
                <div
                  key={user._id}
                  className="search-result-item"
                  onClick={() => addUserToGroup(user)}
                >
                  <div className="user-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <span className="user-name">{user.name}</span>
                    <span className="user-email">{user.email}</span>
                  </div>
                  <button className="add-btn">Add</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Group;
