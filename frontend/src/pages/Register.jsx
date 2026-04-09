import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

function Register() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/");
  }, []);

  return null;
}

export default Register;
