import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { connectSocket } from "../services/socket";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();

    try {
      const res = await api.post("/auth/register", {
        name,
        email,
        password
      });

      // Auto login after register
      login(res.data.user, res.data.token);
      connectSocket(res.data.token);

      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form
        onSubmit={handleRegister}
        className="bg-gray-800 p-8 rounded-xl w-96 space-y-4"
      >
        <h2 className="text-2xl font-bold text-center">
          Create Account
        </h2>

        <input
          type="text"
          placeholder="Full Name"
          className="w-full p-2 rounded bg-gray-700 outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="email"
          placeholder="Email"
          className="w-full p-2 rounded bg-gray-700 outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full p-2 rounded bg-gray-700 outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button className="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition">
          Register
        </button>

        <p className="text-sm text-center">
          Already have an account?{" "}
          <Link to="/" className="text-blue-400">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
