import React, { useState } from "react";
import Scene from "./Scene";

function App() {
  const [sceneData, setSceneData] = useState(null);
  const [solarData, setSolarData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);

    try {
      const sceneRes = await fetch("http://localhost:8000/scene", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 40.7484, lon: -73.9857, radius: 500 })
      });

      const solarRes = await fetch("http://localhost:8000/solar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: 40.7484, lon: -73.9857, date: "2024-06-21" })
      });

      const sceneJson = await sceneRes.json();
      const solarJson = await solarRes.json();

      setSceneData(sceneJson);
      setSolarData(solarJson);
    } catch (err) {
      console.log("Using dummy data");

      const sceneJson = await fetch("/scene_dummy.json").then(r => r.json());
      const solarJson = await fetch("/solar_dummy.json").then(r => r.json());

      setSceneData(sceneJson);
      setSolarData(solarJson);
    }

    setLoading(false);
  };

  return (
    <div>
      <button onClick={loadData}>Load Scene</button>
      {loading && <p>Loading...</p>}

      {sceneData && solarData && (
        <Scene sceneData={sceneData} solarData={solarData} />
      )}
    </div>
  );
}

export default App;
