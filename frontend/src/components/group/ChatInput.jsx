import React from "react";

const ChatInput = ({ input, setInput, onSend, onAddExpense }) => {
  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="chat-input">
      <button
        onClick={onAddExpense}
        className="expense-btn"
      >
        + Add Expense
      </button>
      <input
        className="chat-input-field"
        placeholder="Type message..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <button
        onClick={onSend}
        className="send-btn"
      >
        Send
      </button>
    </div>
  );
};

export default ChatInput;
