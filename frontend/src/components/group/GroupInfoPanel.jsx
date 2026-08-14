import React from "react";

const GroupInfoPanel = ({
  groupName,
  members,
  onClose,
  onRecalculateBalances,
  onLeaveGroup,
  getMemberBalanceSummary
}) => {
  return (
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
        onClick={onClose}
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
        <h3 className="text-sm font-semibold text-gray-400 mb-2">Balance Details</h3>
        {Array.isArray(members) && members.length > 0 ? members.map((member, index) => {
          const memberId = member._id || member.id;
          const summary = getMemberBalanceSummary(memberId);
          const memberName = member.name || member.email || String(memberId);

          return (
            <div
              key={`${memberId}-${index}`}
              className={`flex justify-between p-2 rounded hover:bg-gray-700 ${
                summary.state === "outgoing" ? "text-red-500" : summary.state === "incoming" ? "text-green-500" : "text-gray-400"
              }`}
            >
              <span>{memberName}</span>
              <span>{summary.label}</span>
            </div>
          );
        }) : (
          <div className="text-gray-400 text-sm">Settled</div>
        )}
      </div>

      <button
        className="bg-yellow-600 px-4 py-2 rounded text-white mt-4 w-full"
        onClick={onRecalculateBalances}
      >
        🔄 Recalculate Balances
      </button>

      <button
        className="bg-red-600 px-4 py-2 rounded text-white mt-6 w-full"
        onClick={onLeaveGroup}
      >
        Leave Group
      </button>
    </div>
  );
};

export default GroupInfoPanel;
