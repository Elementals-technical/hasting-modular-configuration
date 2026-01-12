interface PlusButtonIconProps {
  color?: string;
  width?: number;
  height?: number;
}

export const PlusButtonIcon: React.FC<PlusButtonIconProps> = ({ color = "#AC5331", width = 36, height = 36 }) => {
  return (
    <svg width={width} height={height} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="18" fill={color} />
      <path
        d="M12.1665 18.0001H23.8332M17.9998 12.1667V23.8334"
        stroke="white"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};
