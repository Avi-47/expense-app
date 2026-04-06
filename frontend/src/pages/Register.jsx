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
  const [resendTimer, setResendTimer] = useState(0);

  const navigate = useNavigate();

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSendOtp = async () => {
    if (!email) return;
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/send-otp", { email });
      setOtpSent(true);
      setResendTimer(60);
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
      setResendTimer(0);
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
      <div className="bg-gray-800 p-8 rounded-xl w-96">
        <h2 className="text-2xl font-bold text-center mb-6">Create Account</h2>

        {/* Email */}
        <div className="mb-3">
          <input
            type="email"
            placeholder="Email"
            className="w-full p-2 rounded bg-gray-700 outline-none"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={otpSent}
          />
        </div>

        {/* OTP - below email, after sent */}
        {otpSent && !emailVerified && (
          <div className="mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter OTP"
                className="flex-1 p-2 rounded bg-gray-700 outline-none"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
              />
              {resendTimer > 0 ? (
                <button disabled className="bg-gray-600 px-3 py-2 rounded text-sm">
                  {resendTimer}s
                </button>
              ) : (
                <button type="button" onClick={handleSendOtp} className="bg-blue-600 px-3 py-2 rounded text-sm hover:bg-blue-700">
                  Resend
                </button>
              )}
            </div>
          </div>
        )}

        {/* Name - below OTP */}
        <div className="mb-3">
          {emailVerified ? (
            <input
              type="text"
              placeholder="Full Name"
              className="w-full p-2 rounded bg-gray-700 outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          ) : (
            <div className="w-full p-2 rounded bg-gray-800 border border-dashed border-gray-600 text-gray-500 text-center">
              (Verify email to unlock name)
            </div>
          )}
        </div>

        {/* Password - below name */}
        <div className="mb-3">
          {emailVerified ? (
            <input
              type="password"
              placeholder="Password"
              className="w-full p-2 rounded bg-gray-700 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          ) : (
            <div className="w-full p-2 rounded bg-gray-800 border border-dashed border-gray-600 text-gray-500 text-center">
              (Verify email to unlock password)
            </div>
          )}
        </div>

        {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

        {/* Buttons - below everything */}
        {!otpSent && (
          <button
            type="button"
            onClick={handleSendOtp}
            disabled={loading || !email}
            className="w-full bg-blue-600 p-2 rounded hover:bg-blue-700 disabled:opacity-50 mb-2"
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        )}

        {otpSent && !emailVerified && (
          <button
            type="button"
            onClick={handleVerifyOtp}
            disabled={loading || otp.length !== 6}
            className="w-full bg-green-600 p-2 rounded hover:bg-green-700 disabled:opacity-50 mb-2"
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        )}

        {emailVerified && (
          <button
            type="button"
            onClick={handleRegister}
            disabled={loading || !name || !password}
            className="w-full bg-green-600 p-2 rounded hover:bg-green-700 disabled:opacity-50 mb-2"
          >
            {loading ? "Creating..." : "Register"}
          </button>
        )}

        <p className="text-sm text-center mt-4">
          Already have an account? <Link to="/" className="text-blue-400">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
