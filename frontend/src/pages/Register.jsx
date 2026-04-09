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
    <div className="landing-wrapper" style={{ minHeight: '100vh', padding: '6rem 2rem 4rem' }}>
      <header className="landing-header" style={{ position: 'fixed', top: 0, left: 0, right: 0 }}>
        <div className="header-logo">
          <span className="logo-icon">💸</span>
          <span className="logo-text">SplitNChill</span>
        </div>
        
        <nav className="header-nav">
          <a href="#features" className="nav-link">Features</a>
          <a href="#how-it-works" className="nav-link">How It Works</a>
          <a href="#pricing" className="nav-link">Pricing</a>
          <a href="#about" className="nav-link">About</a>
        </nav>
        
        <div className="header-actions">
          <Link to="/" className="btn-outline">Login</Link>
          <Link to="/register" className="btn-primary">Sign Up</Link>
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '3rem', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Left - Content */}
        <div style={{ flex: 1, maxWidth: '500px' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Split expenses.<br />
            <span className="gradient-text">Chat. Chill.</span>
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', marginBottom: '2rem', lineHeight: 1.6 }}>
            Track shared expenses with friends in real-time conversations. 
            No more awkward money talks.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-primary btn-lg" onClick={() => navigate('/dashboard')}>
              Get Started
            </button>
            <button className="btn-outline btn-lg">
              Live Demo
            </button>
          </div>
        </div>

        {/* Right - Register Card */}
        <div className="hero-auth">
          <div className="auth-card glass" style={{ maxWidth: '420px' }}>
            <div className="auth-tabs">
              <Link to="/login" className={`auth-tab`}>Login</Link>
              <span className="auth-tab active">Register</span>
            </div>

            <div className="auth-form" style={{ gap: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={otpSent}
                />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  className="form-input flex-1"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                />
                {otpSent ? (
                  <button
                    onClick={handleVerifyOtp}
                    disabled={otp.length !== 6 || loading}
                    className="auth-btn-primary"
                    style={{ padding: '0.75rem 1.25rem' }}
                  >
                    Verify
                  </button>
                ) : (
                  <button
                    onClick={handleSendOtp}
                    disabled={!email || loading}
                    className="auth-btn-primary"
                    style={{ padding: '0.75rem 1.25rem' }}
                  >
                    Send OTP
                  </button>
                )}
              </div>

              {otpSent && !emailVerified && (
                <div style={{ textAlign: 'right' }}>
                  <button
                    onClick={handleSendOtp}
                    disabled={timer > 0}
                    className="auth-link"
                  >
                    {timer > 0 ? `Resend in ${timer}s` : "Resend OTP"}
                  </button>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!emailVerified}
                  style={{ opacity: emailVerified ? 1 : 0.4 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={!emailVerified}
                  style={{ opacity: emailVerified ? 1 : 0.4 }}
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button
                onClick={handleRegister}
                disabled={!emailVerified || !name || !password || loading}
                className="auth-btn-primary"
              >
                {loading ? "Creating..." : "Create Account"}
              </button>

              <p className="auth-text">
                Already have an account? <Link to="/" className="auth-link">Login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Background Effects */}
      <div className="hero-glow glow-1"></div>
      <div className="hero-glow glow-2"></div>
    </div>
  );
}

export default Register;
