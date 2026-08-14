import React, { useRef } from "react";
import MessageItem from "./MessageItem";

const MessageList = ({ messages, isStreaming, streamingMessage }) => {
  const messagesContainerRef = useRef(null);
  const bottomRef = useRef(null);

  return (
    <div 
      className="messages-container" 
      ref={messagesContainerRef}
    >
      <div className="messages-list">
        {messages.map((msg, index) => (
          <MessageItem
            key={msg._id || index}
            message={msg}
            index={index}
            previousMessage={index > 0 ? messages[index - 1] : null}
          />
        ))}
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
  );
};

export default MessageList;
