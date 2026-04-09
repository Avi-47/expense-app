import { useState, useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { AuthContext } from "../context/AuthContext";
import { connectSocket } from "../services/socket";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState("login");
  const [otp, setOtp] = useState("");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState("");
  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await api.post("/auth/login", { email, password });
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
      const res = await api.post("/auth/verify", { userId, otp });
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
      <div className="landing-wrapper">
        <header className="landing-header">
          <div className="header-logo">
            <span className="logo-icon">💸</span>
            <span className="logo-text">SplitNChill</span>
          </div>
        </header>

        <div className="hero-section" style={{ paddingTop: '10rem' }}>
          <div className="hero-auth">
            <div className="auth-card glass">
              <h2 className="auth-title" style={{ textAlign: 'center', fontSize: '1.5rem', marginBottom: '0.5rem' }}>Verify Email</h2>
              <p className="auth-subtitle" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>Enter the 6-digit OTP sent to your email</p>
              
              <input
                type="text"
                placeholder="Enter OTP"
                className="auth-input text-center"
                style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem' }}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                required
              />
              
              {error && <p className="auth-error">{error}</p>}
              
              <button className="auth-btn-primary" onClick={handleVerify}>
                Verify
              </button>
              
              <button type="button" className="auth-link w-full" onClick={handleResend}>
                Resend OTP
              </button>
              
              <p className="auth-text">
                <button type="button" className="auth-link" onClick={() => setStep("login")}>
                  Back to Login
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="landing-wrapper">
      {/* Header */}
      <header className="landing-header">
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
          <Link to="/" className="btn-primary">Sign Up</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          {/* Left - Content */}
          <div className="hero-content">
            <h1 className="hero-title">
              Split expenses.<br />
              <span className="gradient-text">Chat. Chill.</span>
            </h1>
            <p className="hero-subtitle">
              Track shared expenses with friends in real-time conversations. 
              No more awkward money talks.
            </p>
            <div className="hero-buttons">
              <button className="btn-primary btn-lg">
                Get Started
              </button>
              <button className="btn-outline btn-lg">
                Live Demo
              </button>
            </div>
            <p className="hero-trusted">
              💪 Trusted by friends groups everywhere
            </p>
          </div>

          {/* Center - Mockup */}
          <div className="hero-mockup">
            <div className="chat-preview">
              <div className="chat-preview-header">
                <span>👥 Trip Squad</span>
                <span className="text-xs text-gray-400">4 members</span>
              </div>
              <div className="chat-messages">
                <div className="chat-bubble sent">
                  Hey guys! Let's plan the weekend trip 🍕
                </div>
                <div className="chat-bubble received">
                  Sure! Count me in 🎉
                </div>
                <div className="chat-bubble expense">
                  <div className="expense-icon">💰</div>
                  <div className="expense-text">
                    <strong>Rahul</strong> added <strong>₹2,500</strong> for dinner
                    <span className="expense-split">Split equally among 4</span>
                  </div>
                </div>
                <div className="chat-bubble received">
                  Cool! Who's paying for what? 🧾
                </div>
              </div>
            </div>
            <div className="floating-card card-1">
              <span className="card-icon">⚖️</span>
              <span>Equal split: ₹625 each</span>
            </div>
            <div className="floating-card card-2">
              <span className="card-icon">📊</span>
              <span>Total: ₹8,500</span>
            </div>
          </div>

          {/* Right - Auth Card with Tabs */}
          <div className="hero-auth">
            <div className="auth-card glass">
              <div className="auth-tabs">
                <button 
                  className={`auth-tab ${step === 'login' ? 'active' : ''}`}
                  onClick={() => setStep('login')}
                >
                  Login
                </button>
                <button 
                  className={`auth-tab ${step === 'register' ? 'active' : ''}`}
                  onClick={() => setStep('register')}
                >
                  Register
                </button>
              </div>

              {step === 'login' ? (
                <form onSubmit={handleLogin} className="auth-form">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
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
                      required
                    />
                  </div>

                  {error && <p className="auth-error">{error}</p>}

                  <button type="submit" className="auth-btn-primary w-full">
                    Continue
                  </button>

                  <p className="auth-text">
                    No account? <button type="button" className="auth-link" onClick={() => setStep('register')}>Sign up</button>
                  </p>
                </form>
              ) : (
                <RegisterForm onSwitchToLogin={() => setStep('login')} />
              )}
            </div>
          </div>
        </div>

        {/* Background Effects */}
        <div className="hero-glow glow-1"></div>
        <div className="hero-glow glow-2"></div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <h2 className="section-title">Everything you need to split expenses</h2>
        <p className="section-subtitle">
          Smart features that make splitting expenses with friends effortless
        </p>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>Chat-based Tracking</h3>
            <p>Add expenses directly in group chats. Everything stays in one place.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">⚖️</div>
            <h3>Auto Split</h3>
            <p>Automatically calculate who owes what with equal or custom splits.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📊</div>
            <h3>Expense Summaries</h3>
            <p>Beautiful summaries show exactly where money goes.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔔</div>
            <h3>Smart Reminders</h3>
            <p>Never forget who owes you with automatic reminders.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-left">
            <div className="footer-logo">
              <span className="logo-icon">💸</span>
              <span className="logo-text">SplitNChill</span>
            </div>
            <p className="footer-tagline">Split smart. Stay chill.</p>
          </div>
          
          <div className="footer-center">
            <a href="#privacy">Privacy</a>
            <a href="#terms">Terms</a>
            <a href="#contact">Contact</a>
          </div>
          
          <div className="footer-right">
            <a href="#" className="social-icon">🐦</a>
            <a href="#" className="social-icon">📸</a>
            <a href="#" className="social-icon">💼</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2024 SplitNChill. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function RegisterForm({ onSwitchToLogin }) {
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
    <div className="auth-form">
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
            style={{ padding: '0.75rem' }}
          >
            Verify
          </button>
        ) : (
          <button
            onClick={handleSendOtp}
            disabled={!email || loading}
            className="auth-btn-primary"
            style={{ padding: '0.75rem' }}
          >
            Send
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
        Already have an account? <button type="button" className="auth-link" onClick={onSwitchToLogin}>Login</button>
      </p>
    </div>
  );
}

export default Login;
