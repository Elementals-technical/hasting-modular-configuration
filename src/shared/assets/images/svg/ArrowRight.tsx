interface ArrowRightI {
  width?: string;
  height?: string;
}

export const ArrowRight: React.FC<ArrowRightI> = ({ width = "20", height = "20" }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 4.16634L15.8333 9.99967M15.8333 9.99967L10 15.833M15.8333 9.99967L4.16667 9.99968"
        stroke="#AC5331"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
