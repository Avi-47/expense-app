import React from "react";
import api from "../../services/api";

const AddMemberModal = ({ 
  groupId,
  searchQuery,
  setSearchQuery,
  searchResults,
  setSearchResults,
  onUserAdded,
  onClose
}) => {
  const handleSearchUsers = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await api.get(`/auth/search?q=${query}`);
      // Get current group members to filter them out
      const groupRes = await api.get(`/groups/${groupId}`);
      const currentMemberIds = (groupRes.data.members || []).map(m => m._id);
      const filtered = res.data.filter(u => !currentMemberIds.includes(u._id));
      setSearchResults(filtered);
    } catch (err) {
      console.error(err);
    }
  };

  const addUserToGroup = async (user) => {
    try {
      await api.post(`/groups/${groupId}/add-member`, { email: user.email });
      onUserAdded();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || "Error adding member");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content search-modal">
        <div className="modal-header">
          <h3 className="text-lg font-bold">Add User to Group</h3>
          <button
            className="close-btn"
            onClick={onClose}
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
  );
};

export default AddMemberModal;
