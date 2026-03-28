import React, { useState } from "react";
import Scene from "./Scene";

const DATE = "2024-06-21";
const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Geocoding — Nominatim (free, no key required)
// ---------------------------------------------------------------------------
async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { "Accept-Language": "en" } });
  const data = await res.json();
  if (!data.length) throw new Error(`Address not found: "${address}"`);
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon), display: data[0].display_name };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = {
  // Full-screen container
  root: {
    width: "100vw",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    position: "relative",
    background: "#ffffff",
  },

  // ── Splash screen ──────────────────────────────────────────────────────────
  splash: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    zIndex: 20,
    gap: 0,
  },
  splashTitle: {
    fontSize: "clamp(48px, 10vw, 96px)",
    fontWeight: 200,
    letterSpacing: "0.25em",
    color: "#0d1b2a",
    lineHeight: 1,
    margin: 0,
  },
  splashSub: {
    fontSize: "clamp(12px, 1.5vw, 16px)",
    fontWeight: 300,
    letterSpacing: "0.1em",
    color: "#6b7280",
    marginTop: 12,
    marginBottom: 48,
  },
  splashCta: {
    padding: "14px 40px",
    background: "#0d1b2a",
    color: "#ffffff",
    border: "none",
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    cursor: "pointer",
  },

  // ── Controls panel (left sidebar shown after splash) ───────────────────────
  sidebar: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 300,
    background: "#ffffff",
    borderRight: "1px solid #e5e7eb",
    zIndex: 10,
    display: "flex",
    flexDirection: "column",
    padding: "24px 24px",
    gap: 0,
    boxShadow: "2px 0 12px rgba(0,0,0,0.06)",
  },
  sidebarBack: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#6b7280",
    fontSize: 13,
    cursor: "pointer",
    marginBottom: 20,
    background: "none",
    border: "none",
    padding: 0,
    letterSpacing: "0.05em",
  },
  sidebarTitle: {
    fontSize: 20,
    fontWeight: 300,
    letterSpacing: "0.2em",
    color: "#0d1b2a",
    margin: "0 0 4px 0",
  },
  sidebarSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    marginBottom: 32,
    lineHeight: 1.5,
  },
  label: {
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#6b7280",
    marginBottom: 8,
  },
  input: {
    width: "100%",
    padding: "10px 12px 10px 36px",
    border: "1px solid #e5e7eb",
    borderRadius: 2,
    fontSize: 14,
    color: "#0d1b2a",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 20,
    background: "#f9fafb",
  },
  inputWrap: {
    position: "relative",
    marginBottom: 0,
  },
  inputIcon: {
    position: "absolute",
    left: 11,
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af",
    fontSize: 15,
    pointerEvents: "none",
  },
  radiusInput: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #e5e7eb",
    borderRadius: 2,
    fontSize: 14,
    color: "#0d1b2a",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 28,
    background: "#f9fafb",
  },
  analyzeBtn: {
    width: "100%",
    padding: "14px",
    background: "#0d1b2a",
    color: "#ffffff",
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    cursor: "pointer",
    marginTop: "auto",
  },
  analyzeBtnDisabled: {
    width: "100%",
    padding: "14px",
    background: "#9ca3af",
    color: "#ffffff",
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.15em",
    textTransform: "uppercase",
    cursor: "not-allowed",
    marginTop: "auto",
  },
  errorMsg: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 12,
    lineHeight: 1.5,
  },
  statusMsg: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 12,
    lineHeight: 1.5,
  },

  // ── Map tab toggle ─────────────────────────────────────────────────────────
  tabBar: {
    position: "absolute",
    top: 16,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 15,
    display: "flex",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
    background: "#fff",
  },
  tab: (active) => ({
    padding: "7px 20px",
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    background: active ? "#0d1b2a" : "#fff",
    color: active ? "#fff" : "#6b7280",
    border: "none",
    cursor: "pointer",
    letterSpacing: "0.05em",
  }),

  // ── 3D view overlay controls ───────────────────────────────────────────────
  infoPanel: {
    position: "absolute",
    bottom: 100,
    left: 316,
    zIndex: 10,
    background: "rgba(255,255,255,0.9)",
    backdropFilter: "blur(6px)",
    borderRadius: 4,
    border: "1px solid #e5e7eb",
    padding: "10px 14px",
    color: "#0d1b2a",
    fontSize: 12,
    lineHeight: 1.8,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  infoPanelLabel: {
    color: "#9ca3af",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
  },
  sliderBar: {
    position: "absolute",
    bottom: 16,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 10,
    width: "50%",
    minWidth: 300,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "12px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  sliderHeader: {
    display: "flex",
    justifyContent: "space-between",
    color: "#374151",
    fontSize: 12,
    fontWeight: 500,
    letterSpacing: "0.05em",
  },
  slider: {
    width: "100%",
    accentColor: "#0d1b2a",
    cursor: "pointer",
  },
  sliderLabels: {
    display: "flex",
    justifyContent: "space-between",
    color: "#9ca3af",
    fontSize: 10,
  },
  legend: {
    position: "absolute",
    bottom: 100,
    right: 16,
    zIndex: 10,
    background: "rgba(255,255,255,0.92)",
    backdropFilter: "blur(6px)",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: "10px 14px",
    color: "#0d1b2a",
    fontSize: 12,
    minWidth: 160,
    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
  },
  legendTitle: {
    color: "#9ca3af",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    marginBottom: 7,
  },
  legendGradient: {
    width: "100%",
    height: 10,
    borderRadius: 2,
    background: "linear-gradient(to right, #1a237e, #1565c0, #00897b, #f9a825, #ffff00)",
    marginBottom: 4,
  },
  legendLabels: {
    display: "flex",
    justifyContent: "space-between",
    color: "#9ca3af",
    fontSize: 10,
  },
  solarBtn: (active) => ({
    width: "100%",
    padding: "10px",
    background: active ? "#f5a623" : "#f3f4f6",
    color: active ? "#0d1b2a" : "#374151",
    border: "1px solid " + (active ? "#f5a623" : "#e5e7eb"),
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: "pointer",
    marginTop: 16,
    borderRadius: 2,
  }),
};

function formatHour(h) {
  if (h === 12) return "12 PM";
  if (h === 0) return "12 AM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  // Splash / navigation state
  const [screen, setScreen] = useState("splash"); // "splash" | "controls" | "scene"

  // Form state
  const [address, setAddress] = useState("New York, NY");
  const [radius, setRadius] = useState(500);

  // Data state
  const [sceneData, setSceneData] = useState(null);
  const [solarData, setSolarData] = useState(null);
  const [analyzeData, setAnalyzeData] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [sunIndex, setSunIndex] = useState(6);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [coords, setCoords] = useState(null); // { lat, lon, display }

  // ── Load scene ─────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    setStatus("Geocoding address...");

    let location;
    try {
      location = await geocodeAddress(address);
      setCoords(location);
    } catch (e) {
      setError(e.message);
      setLoading(false);
      setStatus("");
      return;
    }

    setStatus("Loading buildings...");

    try {
      const [sceneRes, solarRes] = await Promise.all([
        fetch(`${API}/scene`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: location.lat, lon: location.lon, radius }),
        }),
        fetch(`${API}/solar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: location.lat, lon: location.lon, date: DATE }),
        }),
      ]);
      if (!sceneRes.ok || !solarRes.ok) throw new Error("Backend error");
      setSceneData(await sceneRes.json());
      setSolarData(await solarRes.json());
      setStatus("Live data");
    } catch {
      setStatus("Backend unavailable — using demo data");
      const [sceneJson, solarJson] = await Promise.all([
        fetch("/scene_dummy.json").then((r) => r.json()),
        fetch("/solar_dummy.json").then((r) => r.json()),
      ]);
      setSceneData(sceneJson);
      setSolarData(solarJson);
    }

    setLoading(false);
    setScreen("scene");
  };

  // ── Solar analysis ─────────────────────────────────────────────────────────
  const toggleAnalysis = async () => {
    if (showAnalysis) { setShowAnalysis(false); return; }
    if (analyzeData) { setShowAnalysis(true); return; }

    setAnalyzing(true);
    try {
      const res = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: coords?.lat, lon: coords?.lon, radius, date: DATE }),
      });
      if (!res.ok) throw new Error();
      setAnalyzeData(await res.json());
    } catch {
      const json = await fetch("/analyze_dummy.json").then((r) => r.json());
      setAnalyzeData(json);
    }
    setAnalyzing(false);
    setShowAnalysis(true);
  };

  const currentSun = solarData?.[sunIndex] ?? solarData?.[0];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>

      {/* ── SPLASH ─────────────────────────────────────────────────────────── */}
      {screen === "splash" && (
        <div style={s.splash}>
          <h1 style={s.splashTitle}>UMBRA</h1>
          <p style={s.splashSub}>Mapping shadows, unlocking energy</p>
          <button style={s.splashCta} onClick={() => setScreen("controls")}>
            TRY THE TOOL
          </button>
        </div>
      )}

      {/* ── CONTROLS PANEL (sidebar + map placeholder) ─────────────────────── */}
      {(screen === "controls" || screen === "scene") && (
        <>
          {/* Sidebar */}
          <div style={s.sidebar}>
            <button style={s.sidebarBack} onClick={() => setScreen("splash")}>
              ← Back
            </button>
            <h2 style={s.sidebarTitle}>UMBRA</h2>
            <p style={s.sidebarSubtitle}>Set location and radius to fetch building data.</p>

            <div style={s.label}>Location</div>
            <div style={s.inputWrap}>
              <span style={s.inputIcon}>⊙</span>
              <input
                style={s.input}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter an address or place"
                onKeyDown={(e) => e.key === "Enter" && !loading && handleAnalyze()}
              />
            </div>

            <div style={s.label}>Radius (meters)</div>
            <input
              style={s.radiusInput}
              type="number"
              min={100}
              max={2000}
              step={100}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
            />

            {screen === "scene" && (
              <button
                style={s.solarBtn(showAnalysis)}
                onClick={toggleAnalysis}
                disabled={analyzing}
              >
                {analyzing ? "Analyzing..." : showAnalysis ? "Hide Solar Analysis" : "Show Solar Analysis"}
              </button>
            )}

            <div style={{ flex: 1 }} />

            {error && <div style={s.errorMsg}>{error}</div>}
            {status && <div style={s.statusMsg}>{status}</div>}

            <button
              style={loading ? s.analyzeBtnDisabled : s.analyzeBtn}
              onClick={handleAnalyze}
              disabled={loading}
            >
              {loading ? "Loading..." : "Analyze"}
            </button>
          </div>

          {/* Tab bar */}
          {screen === "scene" && (
            <div style={s.tabBar}>
              <button style={s.tab(false)}>Map</button>
              <button style={s.tab(true)}>3D</button>
            </div>
          )}

          {/* 3D scene — only shown after analyze */}
          {screen === "scene" && sceneData && solarData && (
            <>
              <div style={{ position: "absolute", left: 300, right: 0, top: 0, bottom: 0 }}>
                <Scene
                  sceneData={sceneData}
                  solarData={solarData}
                  analyzeData={showAnalysis ? analyzeData : null}
                  sunIndex={sunIndex}
                />
              </div>

              {/* Info panel */}
              <div style={s.infoPanel}>
                <div style={s.infoPanelLabel}>Location</div>
                <div>{coords?.lat.toFixed(4)}° N, {Math.abs(coords?.lon ?? 0).toFixed(4)}° W</div>
                <div style={s.infoPanelLabel}>Date</div>
                <div>{DATE}</div>
                {currentSun && (
                  <>
                    <div style={s.infoPanelLabel}>Sun</div>
                    <div>Az {currentSun.azimuth.toFixed(1)}°&nbsp; El {currentSun.elevation.toFixed(1)}°</div>
                  </>
                )}
              </div>

              {/* Legend */}
              {showAnalysis && (
                <div style={s.legend}>
                  <div style={s.legendTitle}>Solar Exposure</div>
                  <div style={s.legendGradient} />
                  <div style={s.legendLabels}>
                    <span>No sun</span>
                    <span>Full sun</span>
                  </div>
                </div>
              )}

              {/* Time slider */}
              <div style={s.sliderBar}>
                <div style={s.sliderHeader}>
                  <span>Time of Day</span>
                  <span style={{ color: "#0d1b2a", fontWeight: 700 }}>
                    {currentSun ? formatHour(currentSun.hour) : ""}
                  </span>
                </div>
                <input
                  type="range"
                  style={s.slider}
                  min={0}
                  max={solarData.length - 1}
                  value={sunIndex}
                  onChange={(e) => setSunIndex(Number(e.target.value))}
                />
                <div style={s.sliderLabels}>
                  <span>{formatHour(solarData[0]?.hour ?? 6)}</span>
                  <span>{formatHour(solarData[Math.floor(solarData.length / 2)]?.hour ?? 12)}</span>
                  <span>{formatHour(solarData[solarData.length - 1]?.hour ?? 18)}</span>
                </div>
              </div>
            </>
          )}

          {/* Map placeholder — shown while loading or before scene */}
          {screen === "controls" && (
            <div style={{
              position: "absolute", left: 300, right: 0, top: 0, bottom: 0,
              background: "#f0f2f5",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#9ca3af", fontSize: 14, letterSpacing: "0.05em",
            }}>
              Enter a location and click Analyze
            </div>
          )}
        </>
      )}
    </div>
  );
}