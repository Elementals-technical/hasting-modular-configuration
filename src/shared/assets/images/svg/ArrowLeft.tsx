interface ArrowLeftI {
  width?: string;
  height?: string;
  fill?: string;
}

export const ArrowLeft: React.FC<ArrowLeftI> = ({ width = "20", height = "20", fill = "#AC5331" }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10 15.8333L4.16669 10M4.16669 10L10 4.16667M4.16669 10H15.8334"
        stroke={fill}
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
