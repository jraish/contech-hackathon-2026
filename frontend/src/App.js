import React, { useState } from "react";
import Scene from "./Scene";

const styles = {
  app: {
    width: "100vw",
    height: "100vh",
    margin: 0,
    padding: 0,
    overflow: "hidden",
    background: "#1a1a2e",
    fontFamily: "sans-serif",
    position: "relative",
  },
  controls: {
    position: "absolute",
    top: 16,
    left: 16,
    zIndex: 10,
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  button: {
    padding: "8px 16px",
    background: "#e94560",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "bold",
  },
  status: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
  },
};

function App() {
  const [sceneData, setSceneData] = useState(null);
  const [solarData, setSolarData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const loadData = async () => {
    setLoading(true);
    setStatus("Loading...");

    try {
      const sceneRes = await fetch("http://localhost:8000/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 40.7484, lon: -73.9857, radius: 500 }),
      });
      const solarRes = await fetch("http://localhost:8000/solar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 40.7484, lon: -73.9857, date: "2024-06-21" }),
      });
      setSceneData(await sceneRes.json());
      setSolarData(await solarRes.json());
      setStatus("Live data");
    } catch (err) {
      setStatus("Using demo data");
      const sceneJson = await fetch("/scene_dummy.json").then((r) => r.json());
      const solarJson = await fetch("/solar_dummy.json").then((r) => r.json());
      setSceneData(sceneJson);
      setSolarData(solarJson);
    }

    setLoading(false);
  };

  return (
    <div style={styles.app}>
      <div style={styles.controls}>
        <button style={styles.button} onClick={loadData} disabled={loading}>
          {loading ? "Loading..." : "Load Scene"}
        </button>
        {status && <span style={styles.status}>{status}</span>}
      </div>

      {sceneData && solarData && (
        <Scene sceneData={sceneData} solarData={solarData} />
      )}
    </div>
  );
}

export default App;