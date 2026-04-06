import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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

  const isEmailValid = email.includes("@") && email.includes(".");
  const canSendOtp = isEmailValid && !loading && timer === 0;
  const canVerify = otp.length === 6 && !loading;
  const canRegister = name && password && !loading;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h2 className="text-3xl font-bold mb-8">Create Account</h2>

      {/* Email */}
      <input
        type="email"
        placeholder="Enter email"
        className="w-full max-w-sm p-3 rounded-lg bg-gray-800 border border-gray-700 mb-4 text-center text-lg"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={otpSent}
      />

      {/* Send OTP / Resend */}
      {!otpSent ? (
        <button
          onClick={handleSendOtp}
          disabled={!canSendOtp}
          className="w-full max-w-sm p-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 font-semibold mb-6"
        >
          {loading ? "Sending..." : "Send OTP"}
        </button>
      ) : (
        <div className="w-full max-w-sm mb-4">
          <input
            type="text"
            placeholder="Enter OTP"
            className="w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-center text-lg tracking-widest"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleVerifyOtp}
              disabled={!canVerify}
              className="flex-1 p-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 font-semibold"
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              onClick={handleSendOtp}
              disabled={timer > 0}
              className="p-3 rounded-lg bg-gray-700 hover:bg-gray-600 disabled:text-gray-500 font-semibold min-w-[100px]"
            >
              {timer > 0 ? `${timer}s` : "Resend"}
            </button>
          </div>
        </div>
      )}

      {/* Username - shown after OTP sent */}
      {otpSent && (
        <div className="w-full max-w-sm space-y-4 animate-fade-in">
          <input
            type="text"
            placeholder="Username"
            className={`w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-center text-lg ${emailVerified ? "" : "opacity-30 pointer-events-none"}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!emailVerified}
          />

          <input
            type="password"
            placeholder="Password"
            className={`w-full p-3 rounded-lg bg-gray-800 border border-gray-700 text-center text-lg ${emailVerified ? "" : "opacity-30 pointer-events-none"}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!emailVerified}
          />

          {error && <p className="text-red-400 text-center">{error}</p>}

          {emailVerified && (
            <button
              onClick={handleRegister}
              disabled={!canRegister}
              className="w-full p-3 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 font-semibold"
            >
              {loading ? "Creating..." : "Register"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Register;
