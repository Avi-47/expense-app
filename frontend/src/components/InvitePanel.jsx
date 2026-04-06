import { useEffect, useState } from "react";
import api from "../services/api";

function InvitePanel() {

  const [invites, setInvites] = useState([]);

  useEffect(() => {
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    const res = await api.get("/groups/invites");
    setInvites(res.data);
  };

  const respond = async (inviteId, action) => {
    await api.post(`/groups/invite/${inviteId}/respond`, { action });

    fetchInvites();
  };

  return (
    <div className="p-4 bg-gray-800">
      <h3 className="font-bold mb-2">Group Invites</h3>

      {invites.map(inv => (
        <div key={inv._id} className="mb-3">

          <p>
            {inv.fromUser.name} invited you to join
            <b> {inv.groupId.name}</b>
          </p>

          <button
            className="bg-green-600 px-2 py-1 mr-2"
            onClick={() => respond(inv._id, "accept")}
          >
            Accept
          </button>

          <button
            className="bg-red-600 px-2 py-1"
            onClick={() => respond(inv._id, "reject")}
          >
            Reject
          </button>

        </div>
      ))}
    </div>
  );
}

export default InvitePanel;