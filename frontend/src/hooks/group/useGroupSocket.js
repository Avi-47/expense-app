import { useState, useEffect } from "react";
import { connectSocket } from "../../services/socket";

/**
 * Custom hook for managing Socket.IO connection and all group-related socket events
 */
export const useGroupSocket = (
  token,
  groupId,
  onMessageReceived,
  onExpenseProposal,
  onExpenseAdded,
  onExpenseUpdated,
  onExpenseDeleted,
  onBalancesUpdated,
  onAiStreamChunk,
  onAiStreamEnd,
  onExpenseClarification
) => {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!token) return;
    const newSocket = connectSocket(token);
    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
  }, [token]);

  useEffect(() => {
    if (!socket) return;

    console.log("[SOCKET] emitting join_group for groupId:", groupId);
    socket.emit("join_group", groupId);

    socket.on("message_received", (msg) => {
      console.log("[SOCKET] message_received:", msg);
      onMessageReceived(msg);
    });

    socket.on("expense_proposal", (data) => {
      console.log("[SOCKET] expense_proposal:", data);
      onExpenseProposal(data);
    });

    socket.on("expense_added", (expense) => {
      console.log("[SOCKET] expense_added event received:", expense);
      if (expense?.groupId && String(expense.groupId) === String(groupId)) {
        console.log("[SOCKET] → calling fetchBalances due to expense_added");
        onExpenseAdded(expense);
      } else {
        console.log("[SOCKET] → expense_added but wrong groupId, ignoring");
      }
    });

    socket.on("expense_updated", (expense) => {
      console.log("[SOCKET] expense_updated event received:", expense);
      if (expense?.groupId && String(expense.groupId) === String(groupId)) {
        console.log("[SOCKET] → calling fetchBalances due to expense_updated");
        onExpenseUpdated(expense);
      }
    });

    socket.on("expense_deleted", ({ groupId: deletedGroupId }) => {
      console.log("[SOCKET] expense_deleted event received for groupId:", deletedGroupId);
      if (String(deletedGroupId || groupId) === String(groupId)) {
        console.log("[SOCKET] → calling fetchBalances due to expense_deleted");
        onExpenseDeleted({ groupId: deletedGroupId });
      }
    });

    socket.on("balances_updated", ({ groupId: updatedGroupId }) => {
      console.log("[SOCKET] balances_updated event received for groupId:", updatedGroupId);
      if (String(updatedGroupId || groupId) === String(groupId)) {
        console.log("[SOCKET] → calling fetchBalances due to balances_updated");
        onBalancesUpdated({ groupId: updatedGroupId });
      }
    });

    socket.on("ai_stream_chunk", (token) => {
      onAiStreamChunk(token);
    });

    socket.on("ai_stream_end", () => {
      onAiStreamEnd();
    });

    socket.on("expense_clarification_needed", (data) => {
      onExpenseClarification(data);
    });

    return () => {
      console.log("[SOCKET] cleaning up listeners for groupId:", groupId);
      socket.emit("leave_group", groupId);
      socket.off("message_received");
      socket.off("expense_proposal");
      socket.off("expense_added");
      socket.off("expense_updated");
      socket.off("expense_deleted");
      socket.off("balances_updated");
      socket.off("ai_stream_chunk");
      socket.off("ai_stream_end");
      socket.off("expense_clarification_needed");
    };
  }, [socket, groupId]);

  return socket;
};
