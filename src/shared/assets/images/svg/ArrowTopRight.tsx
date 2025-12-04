interface ArrowTopRightI {
  color?: string;
}

export const ArrowTopRight: React.FC<ArrowTopRightI> = ({ color = "white" }) => {
  return (
    <svg width="15" height="15" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3.5 3.5H8.5M8.5 3.5V8.5M8.5 3.5L3.5 8.5"
        stroke={color}
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
