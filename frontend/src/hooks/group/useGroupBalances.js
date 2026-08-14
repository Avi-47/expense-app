import { useState, useEffect } from "react";
import api from "../../services/api";
import { fromCents, formatMoney } from "../../utils/money";

/**
 * Custom hook for managing group balances with fallback rebuild mechanism
 */
export const useGroupBalances = (groupId) => {
  const [balances, setBalances] = useState({});
  const [currentUserBalances, setCurrentUserBalances] = useState({});
  const [currentUserMatrixKey, setCurrentUserMatrixKey] = useState("");

  const fetchBalances = async () => {
    try {
      const res = await api.get(`/settlement/${groupId}/balances`, {
        params: { t: Date.now() },
        headers: {
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        }
      });
      console.log("BALANCES RESPONSE:", JSON.stringify(res.data, null, 2));
      setBalances(res.data.balances && typeof res.data.balances === "object" ? res.data.balances : {});
      setCurrentUserBalances(res.data.currentUserBalances && typeof res.data.currentUserBalances === "object" ? res.data.currentUserBalances : {});
      setCurrentUserMatrixKey(String(res.data.currentUserMatrixKey || "").trim());
    } catch (err) {
      console.warn("Balances fetch failed, rebuilding ledger once:", err?.response?.status || err.message);
      try {
        await api.post(`/settlement/${groupId}/rebuild`);
        const retry = await api.get(`/settlement/${groupId}/balances`, {
          params: { t: Date.now() },
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache"
          }
        });
        console.log("BALANCES RETRY RESPONSE:", JSON.stringify(retry.data, null, 2));
        setBalances(retry.data.balances && typeof retry.data.balances === "object" ? retry.data.balances : {});
        setCurrentUserBalances(retry.data.currentUserBalances && typeof retry.data.currentUserBalances === "object" ? retry.data.currentUserBalances : {});
        setCurrentUserMatrixKey(String(retry.data.currentUserMatrixKey || "").trim());
      } catch (retryErr) {
        console.error("Error refreshing balances after rebuild:", retryErr);
      }
    }
  };

  const recalculateBalances = async () => {
    try {
      console.log("[RECALC] User clicked Recalculate Balances button");
      const res = await api.post(`/settlement/${groupId}/rebuild`);
      console.log("[RECALC] Rebuild response:", res.data);
      setBalances(res.data.balances && typeof res.data.balances === "object" ? res.data.balances : {});
      return { success: true };
    } catch (err) {
      console.error("[RECALC] Error recalculating balances:", err);
      return {
        success: false,
        message: err.response?.data?.message || err.message
      };
    }
  };

  const getMemberBalanceSummary = (memberId, currentUser, passedUserId, members) => {
    const userId = String(currentUser?._id || currentUser?.id || passedUserId || "");
    const currentRow = currentUserBalances && typeof currentUserBalances === "object"
      ? currentUserBalances
      : (currentUserMatrixKey && balances?.[currentUserMatrixKey]) || balances?.[userId] || {};
    const netAmount = Number(currentRow[String(memberId)] || 0);

    if (netAmount > 0) {
      return {
        state: "incoming",
        label: `owes you ₹${formatMoney(fromCents(netAmount))}`
      };
    }

    if (netAmount < 0) {
      return {
        state: "outgoing",
        label: `You owe ₹${formatMoney(fromCents(Math.abs(netAmount)))}`
      };
    }

    return {
      state: "settled",
      label: "settled"
    };
  };

  useEffect(() => {
    fetchBalances();
  }, [groupId]);

  return {
    balances,
    currentUserBalances,
    currentUserMatrixKey,
    fetchBalances,
    recalculateBalances,
    getMemberBalanceSummary
  };
};
