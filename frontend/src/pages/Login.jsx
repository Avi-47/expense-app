import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { connectSocket } from "../services/socket";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    const res = await api.post("/auth/login", {
      email,
      password
    });

    login(res.data.user, res.data.token);
    connectSocket(res.data.token);

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form
        onSubmit={handleLogin}
        className="bg-gray-800 p-8 rounded-xl w-96 space-y-4"
      >
        <h2 className="text-2xl font-bold text-center">Login</h2>

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-gray-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded bg-gray-700"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="w-full bg-blue-600 p-2 rounded hover:bg-blue-700">
          Login
        </button>

        <p className="text-sm text-center">
          No account? <Link to="/register" className="text-blue-400">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
