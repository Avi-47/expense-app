import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";

function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("register"); // register | verify
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/register", {
        name,
        email,
        password
      });

      setUserId(res.data.userId);
      setStep("verify");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
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

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Verification failed");
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-otp", { userId });
      alert("OTP resent! Check your email.");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend OTP");
    }
    setResending(false);
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
          
          <button type="button" onClick={handleResend} disabled={resending} className="w-full text-blue-400 text-sm hover:underline">
            {resending ? "Sending..." : "Resend OTP"}
          </button>
          
          <p className="text-sm text-center">
            <button type="button" onClick={() => setStep("register")} className="text-gray-400">Back</button>
          </p>
        </form>
      </div>
    );
  }

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

        {error && <p className="text-red-400 text-sm">{error}</p>}

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
