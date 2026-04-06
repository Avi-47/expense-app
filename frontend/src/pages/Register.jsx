import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Register() {
  const [step, setStep] = useState("email"); // email | otp | details
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [tempToken, setTempToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/send-otp", { email });
      setStep("otp");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/verify-otp", { email, otp });
      setTempToken(res.data.tempToken);
      setStep("details");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid OTP");
    }
    setLoading(false);
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/complete-register", {
        tempToken,
        name,
        password
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
    setLoading(false);
  };

  // Step 1: Enter email
  if (step === "email") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <form onSubmit={handleSendOtp} className="bg-gray-800 p-8 rounded-xl w-96 space-y-4">
          <h2 className="text-2xl font-bold text-center">Enter Your Email</h2>

          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 rounded bg-gray-700 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button disabled={loading} className="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition">
            {loading ? "Sending..." : "Send OTP"}
          </button>

          <p className="text-sm text-center">
            Already have an account? <Link to="/" className="text-blue-400">Login</Link>
          </p>
        </form>
      </div>
    );
  }

  // Step 2: Enter OTP
  if (step === "otp") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <form onSubmit={handleVerifyOtp} className="bg-gray-800 p-8 rounded-xl w-96 space-y-4">
          <h2 className="text-2xl font-bold text-center">Verify Email</h2>
          <p className="text-gray-400 text-sm text-center">Enter the 6-digit OTP</p>
          <p className="text-yellow-400 text-xs text-center">(Check Render logs for OTP)</p>

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

          <button disabled={loading} className="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition">
            {loading ? "Verifying..." : "Verify OTP"}
          </button>

          <p className="text-sm text-center">
            <button type="button" onClick={() => setStep("email")} className="text-gray-400">Back</button>
          </p>
        </form>
      </div>
    );
  }

  // Step 3: Enter name and password
  if (step === "details") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
        <form onSubmit={handleRegister} className="bg-gray-800 p-8 rounded-xl w-96 space-y-4">
          <h2 className="text-2xl font-bold text-center">Complete Registration</h2>
          <p className="text-green-400 text-sm text-center">Email verified!</p>

          <input
            type="text"
            placeholder="Full Name"
            className="w-full p-2 rounded bg-gray-700 outline-none"
            value={name}
            onChange={(e) => setName(e.target.value)}
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

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button disabled={loading} className="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition">
            {loading ? "Creating..." : "Register"}
          </button>
        </form>
      </div>
    );
  }

  return null;
}

export default Register;
