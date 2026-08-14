import React from "react";
import { formatMoney } from "../../utils/money";

const ExpenseProposalModal = ({ proposal, onConfirm, onCancel }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h3 className="text-lg font-bold">Confirm Expense</h3>
        <p>Description: {proposal.description}</p>
        <p>Amount: ₹{formatMoney(proposal.amount)}</p>
        <div className="flex justify-between gap-2">
          <button
            className="bg-green-600 px-4 py-2 rounded"
            onClick={onConfirm}
          >
            Confirm
          </button>
          <button
            className="bg-red-600 px-4 py-2 rounded"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExpenseProposalModal;
