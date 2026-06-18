interface CloseBtnIconI {
  width?: string;
  height?: string;
}

export const CloseBtnIcon: React.FC<CloseBtnIconI> = ({ width = "30", height = "30" }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="30" height="30" rx="15" fill="#E5E6EA" />
      <path
        d="M20 10L10 20M10 10L20 20"
        stroke="#282828"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
