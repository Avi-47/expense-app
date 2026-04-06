import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { connectSocket } from "../services/socket";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("login"); // login | verify
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", {
        email,
        password
      });

      login(res.data.user, res.data.token);
      connectSocket(res.data.token);
      navigate("/dashboard");
    } catch (err) {
      const msg = err.response?.data?.message || "Login failed";
      const pendingUserId = err.response?.data?.userId;
      
      if (err.response?.status === 403 && pendingUserId) {
        setUserId(pendingUserId);
        setStep("verify");
        setError(msg);
      } else {
        setError(msg);
      }
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/verify", {
        userId,
        otp
      });

      login(res.data.user, res.data.token);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    }
  };

  const handleResend = async () => {
    try {
      await api.post("/auth/resend-otp", { userId });
      alert("OTP resent!");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    }
  };

  if (step === "verify") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <form onSubmit={handleVerify} className="bg-gray-800 p-8 rounded-xl w-96 space-y-4">
          <h2 className="text-2xl font-bold text-center">Verify Email</h2>
          <p className="text-gray-400 text-sm text-center">Enter the 6-digit OTP sent to your email</p>
          
          <input
            type="text"
            placeholder="Enter OTP"
            className="w-full p-2 rounded bg-gray-700 outline-none text-center text-2xl tracking-widest"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            required
          />
          
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          
          <button className="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition">
            Verify
          </button>
          
          <button type="button" onClick={handleResend} className="w-full text-blue-400 text-sm hover:underline">
            Resend OTP
          </button>
          
          <p className="text-sm text-center">
            <button type="button" onClick={() => setStep("login")} className="text-gray-400">Back to Login</button>
          </p>
        </form>
      </div>
    );
  }

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

        {error && <p className="text-red-400 text-sm">{error}</p>}

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
