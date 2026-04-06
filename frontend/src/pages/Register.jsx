import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Register() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
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
      setOtpSent(true);
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
      setEmailVerified(true);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <form className="bg-gray-800 p-8 rounded-xl w-96 space-y-4">
        <h2 className="text-2xl font-bold text-center">Create Account</h2>

        {/* Email - always enabled */}
        <div>
          <label className="text-sm text-gray-400">Email</label>
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 rounded bg-gray-700 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={otpSent}
            required
          />
        </div>

        {/* OTP Section - only after sending */}
        {otpSent && !emailVerified && (
          <div>
            <label className="text-sm text-gray-400">OTP</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter OTP"
                className="w-full p-2 rounded bg-gray-700 outline-none"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
            </div>
            <p className="text-yellow-400 text-xs mt-1">(Check Render logs for OTP)</p>
          </div>
        )}

        {/* Name - disabled until verified */}
        <div>
          <label className={`text-sm ${emailVerified ? "text-gray-300" : "text-gray-600"}`}>Full Name</label>
          <input
            type="text"
            placeholder="Full Name"
            className={`w-full p-2 rounded bg-gray-700 outline-none ${emailVerified ? "" : "opacity-50 cursor-not-allowed"}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!emailVerified}
            required
          />
        </div>

        {/* Password - disabled until verified */}
        <div>
          <label className={`text-sm ${emailVerified ? "text-gray-300" : "text-gray-600"}`}>Password</label>
          <input
            type="password"
            placeholder="Password"
            className={`w-full p-2 rounded bg-gray-700 outline-none ${emailVerified ? "" : "opacity-50 cursor-not-allowed"}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!emailVerified}
            required
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        {/* Action buttons based on state */}
        {!otpSent && (
          <button 
            onClick={handleSendOtp} 
            disabled={loading || !email}
            className="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        )}

        {otpSent && !emailVerified && (
          <button 
            onClick={handleVerifyOtp} 
            disabled={loading || otp.length !== 6}
            className="w-full bg-blue-600 p-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        )}

        {emailVerified && (
          <button 
            onClick={handleRegister} 
            disabled={loading || !name || !password}
            className="w-full bg-green-600 p-2 rounded hover:bg-green-700 transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Register"}
          </button>
        )}

        <p className="text-sm text-center">
          Already have an account? <Link to="/" className="text-blue-400">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
