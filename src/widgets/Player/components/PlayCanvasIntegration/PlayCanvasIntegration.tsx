export const PlayCanvasIntegration = () => {
  return (
    <div style={{ height: "100%" }}>
      <iframe
        title="scene"
        id="demo"
        width="100%"
        height="100%"
        src="/HastingCabinetsParametrization/index.html"
        style={{
          width: "100%",
          height: "100%",
          flex: "1 1 auto",
          border: "none",
          display: "block",
        }}
      ></iframe>
    </div>
  );
};
