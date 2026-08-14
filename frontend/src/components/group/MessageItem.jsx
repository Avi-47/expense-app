import React from "react";
import { formatMessageDate, getDateKey } from "../../utils/group/messageUtils";

const MessageItem = ({ message, index, previousMessage }) => {
  const currentDateKey = getDateKey(message.createdAt || message.timestamp);
  const showDateSeparator = index === 0 || currentDateKey !== getDateKey(previousMessage?.createdAt || previousMessage?.timestamp);
  
  let senderId = null;
  if (message.sender) {
    if (typeof message.sender === "string") {
      senderId = message.sender;
    } else if (typeof message.sender === "object") {
      senderId = message.sender._id || message.sender.id || message.sender.userId || null;
    }
  }

  const senderName = message.sender && typeof message.sender === "object" ? message.sender.name : "Unknown";

  let currentUserId = null;
  try {
    const stored = localStorage.getItem("user");
    if (stored && stored !== "undefined" && stored !== "null") {
      const parsed = JSON.parse(stored);
      currentUserId = parsed?.id || parsed?._id || null;
    }
  } catch (e) {
    // Ignore
  }
  
  const senderIdStr = senderId ? String(senderId) : "";
  const currentUserIdStr = currentUserId ? String(currentUserId) : "";
  const isMe = senderIdStr === currentUserIdStr && senderIdStr !== "" && currentUserIdStr !== "";

  return (
    <React.Fragment key={message._id || index}>
      {showDateSeparator && (
        <div className="date-separator">
          <span className="date-label">
            {formatMessageDate(message.createdAt || message.timestamp)}
          </span>
        </div>
      )}
      <div className={`message-row ${isMe ? "message-mine" : "message-other"}`}>
        <div className={`message-bubble ${isMe ? "bubble-mine" : "bubble-other"}`}>
          {!isMe && <span className="sender-name">{senderName}</span>}
          {message.type === "invite" ? (
            <div className="bg-blue-800 p-3 rounded">
              <p>{senderName} invited you to join a group</p>
              <button
                className="bg-green-600 px-3 py-1 rounded mt-2"
              >
                Join Group
              </button>
            </div>
          ) : (
            <p>{message.content}</p>
          )}
        </div>
      </div>
    </React.Fragment>
  );
};

export default MessageItem;
