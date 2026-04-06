import { useParams, useNavigate } from "react-router-dom";
import api from "../utils/api";
import { useEffect } from "react";

function Invite() {
  const { token } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const join = async () => {
      try {
        const res = await api.post(`/groups/join/${token}`);
        navigate(`/groups/${res.data.groupId}`);
      } catch (err) {
        alert("Invalid invite link");
        navigate("/dashboard");
      }
    };

    join();
  }, []);

  return <div>Joining group...</div>;
}

export default Invite;