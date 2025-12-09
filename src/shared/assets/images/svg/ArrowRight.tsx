interface ArrowRightI {
  width?: string;
  height?: string;
}

export const ArrowRight: React.FC<ArrowRightI> = ({ width = "14", height = "14" }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 5 4" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M2.64334 4.20774e-07L5 2L2.64334 4L2.14286 3.57938L3.64189 2.30722L-3.3749e-07 2.30722L-2.83774e-07 1.69278L3.64189 1.69278L2.14286 0.422681L2.64334 4.20774e-07Z"
        fill="black"
      ></path>
    </svg>
  );
};
