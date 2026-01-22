interface ArrowDownI {
  width?: string;
  height?: string;
  fill?: string;
}

export const ArrowDown: React.FC<ArrowDownI> = ({ width, height, fill = "black" }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 8 5" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6.30833 0.195L3.72167 2.78167L1.135 0.195C0.875 -0.065 0.455 -0.065 0.195 0.195C-0.065 0.455 -0.065 0.875 0.195 1.135L3.255 4.195C3.515 4.455 3.935 4.455 4.195 4.195L7.255 1.135C7.515 0.875 7.515 0.455 7.255 0.195C6.995 -0.0583333 6.56833 -0.065 6.30833 0.195Z"
        fill={fill}
      ></path>
    </svg>
  );
};
