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
  const currentUser = user || (() => {
    const stored = localStorage.getItem("user");
    return stored ? JSON.parse(stored) : null;
  })();

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

  const messagesContainerRef = useRef(null);
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
          <button 
            onClick={() => {
              console.log("=== CLICKED TEST ===");
              const c = messagesContainerRef.current;
              if(c) { 
                console.log("Container found, scrolling...");
                c.scrollTop = 500; 
                console.log("Scrolled to 500, scrollTop is now:", c.scrollTop);
              } else {
                console.log("NO CONTAINER FOUND");
              }
            }} 
            className="bg-red-600 px-3 py-1 rounded text-white text-sm font-bold"
          >
            SCROLL TEST
          </button>
          <div className="flex items-center gap-3">
            <button
              className="md:hidden"
              onClick={() => navigate("/dashboard")}
            >
              ←
            </button>
            <h2
              className="font-semibold cursor-pointer"
              onClick={() => setShowInfo(true)}
            >
              {groupName}
            </h2>
          </div>
          <button
            onClick={() => setShowInfo(true)}
            className="text-gray-400 hover:text-white"
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
        <div className="hidden md:flex md:w-1/4 bg-gray-800 border-l border-gray-700 p-6">
          <button
            onClick={() => setShowInfo(false)}
            className="mb-4"
          >
            Close
          </button>

          <h2 className="text-xl font-bold mb-4">{groupName}</h2>

          {group?.inviteToken && (
            <div className="mt-4">
              <p className="text-sm text-gray-400">Invite Link</p>
              <input
                value={inviteLink}
                readOnly
                className="w-full bg-gray-700 p-2 rounded text-white"
              />
              <button
                className="bg-blue-600 px-3 py-2 rounded mt-2 w-full"
                onClick={() => navigator.clipboard.writeText(inviteLink)}
              >
                Copy Link
              </button>
            </div>
          )}

          <div className="flex gap-2 mb-4">
            <input
              type="email"
              placeholder="Enter member email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 p-2 bg-gray-700 rounded"
            />
            <button
              onClick={handleInviteUser}
              className="bg-green-600 px-3 rounded"
            >
              Add
            </button>
          </div>

          <div className="space-y-2">
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
    </div>
  );
}

export default Group;
