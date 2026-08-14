import React from "react";

const ExpenseModal = ({
  expenseData,
  setExpenseData,
  members,
  selectAll,
  setSelectAll,
  onClose,
  onSubmit
}) => {
  return (
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
            onClick={onClose}
            className="bg-red-600 px-4 py-2 rounded"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            className="bg-green-600 px-4 py-2 rounded"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseModal;
