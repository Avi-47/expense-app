import { useState, useEffect } from "react";
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
  const [timer, setTimer] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    if (timer > 0) {
      const t = setTimeout(() => setTimer(timer - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [timer]);

  const handleSendOtp = async () => {
    if (!email) return;
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/send-otp", { email });
      setOtpSent(true);
      setTimer(60);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to send OTP");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) return;
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

  const handleRegister = async () => {
    if (!name || !password) return;
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/complete-register", { tempToken, name, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-4">
      <div className="w-full max-w-sm space-y-3">
        <h2 className="text-2xl font-bold text-center mb-4">Create Account</h2>

        {/* Email + Send OTP */}
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="Enter email"
            className="flex-1 p-3 rounded bg-gray-800 border border-gray-700"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={otpSent}
          />
          {!otpSent && (
            <button
              onClick={handleSendOtp}
              disabled={!email || loading}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              Send OTP
            </button>
          )}
        </div>

        {/* OTP + Verify/Resend */}
        {otpSent && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter OTP"
              className="flex-1 p-3 rounded bg-gray-800 border border-gray-700"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={otp.length !== 6 || loading}
              className="px-4 py-2 rounded bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        )}

        {/* Resend button */}
        {otpSent && (
          <div className="flex justify-end">
            <button
              onClick={handleSendOtp}
              disabled={timer > 0}
              className="text-sm text-blue-400 hover:underline disabled:text-gray-500"
            >
              {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
            </button>
          </div>
        )}

        {/* Username */}
        <input
          type="text"
          placeholder="Username"
          className={`w-full p-3 rounded bg-gray-800 border border-gray-700 ${emailVerified ? "" : "opacity-40"}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!emailVerified}
        />

        {/* Password */}
        <input
          type="password"
          placeholder="Password"
          className={`w-full p-3 rounded bg-gray-800 border border-gray-700 ${emailVerified ? "" : "opacity-40"}`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={!emailVerified}
        />

        {/* Register Button */}
        <button
          onClick={handleRegister}
          disabled={!emailVerified || !name || !password || loading}
          className={`w-full p-3 rounded font-semibold ${emailVerified ? "bg-green-600 hover:bg-green-700" : "bg-gray-700 text-gray-500"}`}
        >
          {loading ? "Creating..." : "Register"}
        </button>

        {error && <p className="text-red-400 text-center text-sm">{error}</p>}

        <p className="text-center text-sm">
          <Link to="/" className="text-blue-400">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
