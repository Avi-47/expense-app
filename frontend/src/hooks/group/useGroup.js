import { useState, useEffect } from "react";
import api from "../../services/api";

/**
 * Custom hook for managing group data, members, and related API operations
 */
export const useGroup = (groupId) => {
  const [group, setGroup] = useState(null);
  const [groupName, setGroupName] = useState("");
  const [members, setMembers] = useState([]);

  const fetchGroup = async () => {
    const res = await api.get(`/groups/${groupId}`);
    setGroup(res.data);
    setGroupName(res.data.name);
    setMembers(res.data.members || []);
  };

  const addMember = async (email) => {
    try {
      await api.post(`/groups/${groupId}/add-member`, {
        email: email,
      });
      await fetchGroup();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Error adding member"
      };
    }
  };

  const leaveGroup = async () => {
    try {
      await api.post(`/groups/${groupId}/leave`);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message:
          err.response?.data?.message ||
          "You must settle all dues before leaving"
      };
    }
  };

  const inviteUser = async (email) => {
    try {
      await api.post(`/groups/${groupId}/invite`, { email });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Invite failed"
      };
    }
  };

  const addUserToGroup = async (userEmail) => {
    try {
      await api.post(`/groups/${groupId}/add-member`, { email: userEmail });
      await fetchGroup();
      return { success: true };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.message || "Error adding member"
      };
    }
  };

  useEffect(() => {
    fetchGroup();
  }, [groupId]);

  return {
    group,
    groupName,
    members,
    fetchGroup,
    addMember,
    leaveGroup,
    inviteUser,
    addUserToGroup
  };
};
