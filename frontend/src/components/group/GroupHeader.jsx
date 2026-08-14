import React from "react";

const GroupHeader = ({ groupName, onBack, onInfoClick }) => {
  return (
    <div className="group-header">
      <div className="header-left">
        <button
          className="md:hidden"
          onClick={onBack}
        >
          ←
        </button>
        <div className="header-slab" onClick={onInfoClick}>
          <div className="header-avatar">
            {groupName.charAt(0).toUpperCase()}
          </div>
          <h2 className="header-group-name">{groupName}</h2>
        </div>
      </div>
      <button
        onClick={onInfoClick}
        className="info-btn"
      >
        (i)
      </button>
    </div>
  );
};

export default GroupHeader;
