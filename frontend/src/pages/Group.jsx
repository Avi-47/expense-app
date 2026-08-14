import React from "react";
import { useParams, useNavigate } from "react-router-dom"
import { useState, useEffect, useContext, useRef } from "react";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { formatMoney, fromCents } from "../utils/money";
import { logExpenseSplitDetails, logBalanceMatrix } from "../utils/expenseLogger";

// Import custom hooks
import { useGroup } from "../hooks/group/useGroup";
import { useGroupMessages } from "../hooks/group/useGroupMessages";
import { useGroupBalances } from "../hooks/group/useGroupBalances";
import { useGroupSocket } from "../hooks/group/useGroupSocket";

// Import components
import GroupHeader from "../components/group/GroupHeader";
import MessageList from "../components/group/MessageList";
import ChatInput from "../components/group/ChatInput";
import GroupInfoPanel from "../components/group/GroupInfoPanel";
import ExpenseModal from "../components/group/ExpenseModal";
import ExpenseProposalModal from "../components/group/ExpenseProposalModal";
import AddMemberModal from "../components/group/AddMemberModal";

function Group() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useContext(AuthContext);
  const currentUser = user;

  // Use custom hooks
  const { 
    group, 
    groupName, 
    members, 
    fetchGroup: refetchGroup,
    leaveGroup: leaveGroupAPI,
    addUserToGroup: addUserToGroupAPI
  } = useGroup(groupId);

  const { 
    messages, 
    setMessages,
    fetchMessages,
    sendMessage: createSendMessageFn,
    addMessage,
    setClarificationMessage
  } = useGroupMessages(groupId);

  const {
    balances,
    currentUserBalances,
    currentUserMatrixKey,
    fetchBalances,
    recalculateBalances,
    getMemberBalanceSummary: getBalanceSummaryFn
  } = useGroupBalances(groupId);

  // Local UI state
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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  const inviteLink = group?.inviteToken
    ? `${window.location.origin}/invite/${group.inviteToken}`
    : "";

  // Socket event handlers
  const handleMessageReceived = (msg) => {
    setMessages(prev => [...prev, msg]);
  };

  const handleExpenseProposal = (data) => {
    setProposal(data);
  };

  const handleExpenseAdded = (expense) => {
    logExpenseSplitDetails(expense, members);
    fetchBalances();
  };

  const handleExpenseUpdated = (expense) => {
    fetchBalances();
  };

  const handleExpenseDeleted = ({ groupId: deletedGroupId }) => {
    fetchBalances();
  };

  const handleBalancesUpdated = ({ groupId: updatedGroupId }) => {
    fetchBalances();
  };

  const handleAiStreamChunk = (token) => {
    setIsStreaming(true);
    streamingRef.current += token;
    setStreamingMessage(streamingRef.current);
  };

  const handleAiStreamEnd = () => {
    setIsStreaming(false);
    streamingRef.current = "";
    setStreamingMessage("");
  };

  const handleExpenseClarification = (data) => {
    setClarificationMessage(data.message, "System");
  };

  // Socket setup using custom hook
  const socket = useGroupSocket(
    token,
    groupId,
    handleMessageReceived,
    handleExpenseProposal,
    handleExpenseAdded,
    handleExpenseUpdated,
    handleExpenseDeleted,
    handleBalancesUpdated,
    handleAiStreamChunk,
    handleAiStreamEnd,
    handleExpenseClarification
  );

  // Debug log
  useEffect(() => {
    console.log("Group component MOUNTED");
  }, []);

  // Logging for scroll checks
  useEffect(() => {
    setTimeout(() => {
      console.log("=== INITIAL SCROLL CHECK ===");
      console.log("Messages loaded, ready for scroll");
    }, 1000);
  }, []);

  // Log balance matrix
  useEffect(() => {
    if (!members || members.length === 0) {
      return;
    }
    logBalanceMatrix(balances && typeof balances === "object" ? balances : {}, members, groupId);
  }, [balances, members, groupId]);

  // Wrapped getMemberBalanceSummary to use hook with current state
  const getMemberBalanceSummary = (memberId) => {
    return getBalanceSummaryFn(
      memberId,
      currentUser,
      String(currentUser?._id || currentUser?.id || user?._id || user?.id || ""),
      members
    );
  };

  // Send message handler
  const handleSendMessage = () => {
    if (!input.trim() || !socket) return;
    
    const messageData = {
      content: input,
      sender: currentUser,
      createdAt: new Date().toISOString()
    };
    
    socket.emit("send_message", {
      groupId,
      content: input
    });
    setMessages(prev => [...prev, messageData]);
    setInput("");
  };

  // Create expense handler
  const handleCreateExpense = async () => {
    try {
      console.log("[EXPENSE] Creating expense with data:", expenseData);
      
      if (!expenseData.description || !expenseData.amount || expenseData.participants.length === 0) {
        alert("Please fill in all fields and select at least one participant");
        return;
      }

      const payerId = user?.id;
      if (!payerId) {
        alert("Unable to determine current user");
        return;
      }

      const payers = [{
        user: payerId,
        amount: Number(expenseData.amount)
      }];

      const response = await api.post(`/expenses/${groupId}/confirm`, {
        description: expenseData.description,
        amount: Number(expenseData.amount),
        involvedUsers: expenseData.participants,
        payers: payers,
        splitType: "equal"
      });
      
      console.log("[EXPENSE] Expense created successfully:", response.data);
      setShowExpenseModal(false);
      setExpenseData({
        description: "",
        amount: "",
        participants: [],
        includeSelf: true
      });
      fetchBalances();
    } catch (err) {
      console.error("[EXPENSE] Error creating expense:", err);
      const errorMsg = err.response?.data?.message || err.message || "Unknown error";
      alert("Error creating expense: " + errorMsg);
    }
  };

  // Handle recalculate balances
  const handleRecalculateBalances = async () => {
    const result = await recalculateBalances();
    if (result.success) {
      alert("Balances recalculated successfully!");
    } else {
      alert("Error recalculating balances: " + result.message);
    }
  };

  // Handle leave group
  const handleLeaveGroup = async () => {
    const result = await leaveGroupAPI();
    if (result.success) {
      alert("You left the group");
      navigate("/dashboard");
    } else {
      alert(result.message);
    }
  };

  // Handle add user from search
  const handleAddUserFromSearch = async () => {
    setShowSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    await refetchGroup();
    await fetchBalances();
  };

  return (
    <div className="group-wrapper">
      <div className="hidden md:flex md:w-1/4 bg-gray-800 border-r border-gray-700">
        <div className="p-4 font-bold text-lg">Chats</div>
      </div>

      <div className="group-main">
        <GroupHeader 
          groupName={groupName}
          onBack={() => navigate("/dashboard")}
          onInfoClick={() => setShowInfo(true)}
        />

        <MessageList 
          messages={messages}
          isStreaming={isStreaming}
          streamingMessage={streamingMessage}
        />

        <ChatInput 
          input={input}
          setInput={setInput}
          onSend={handleSendMessage}
          onAddExpense={() => setShowExpenseModal(true)}
        />
      </div>

      {showInfo && (
        <GroupInfoPanel
          groupName={groupName}
          members={members}
          onClose={() => setShowInfo(false)}
          onRecalculateBalances={handleRecalculateBalances}
          onLeaveGroup={handleLeaveGroup}
          getMemberBalanceSummary={getMemberBalanceSummary}
        />
      )}

      {proposal && (
        <ExpenseProposalModal
          proposal={proposal}
          onConfirm={async () => {
            await api.post(`/expenses/${groupId}/confirm`, proposal);
            setProposal(null);
            fetchBalances();
          }}
          onCancel={() => setProposal(null)}
        />
      )}

      {showExpenseModal && (
        <ExpenseModal
          expenseData={expenseData}
          setExpenseData={setExpenseData}
          members={members}
          selectAll={selectAll}
          setSelectAll={setSelectAll}
          onClose={() => setShowExpenseModal(false)}
          onSubmit={handleCreateExpense}
        />
      )}

      {showSearch && (
        <AddMemberModal
          groupId={groupId}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          searchResults={searchResults}
          setSearchResults={setSearchResults}
          onUserAdded={handleAddUserFromSearch}
          onClose={() => {
            setShowSearch(false);
            setSearchQuery("");
            setSearchResults([]);
          }}
        />
      )}
    </div>
  );
}

export default Group;
