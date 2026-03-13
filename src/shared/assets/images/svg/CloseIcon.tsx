type CloseIconProps = {
  fill?: string;
};

export const CloseIcon = ({ fill = "white" }: CloseIconProps) => {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5.99805 6.00293L17.998 18.0029" stroke={fill} strokeWidth="1.06066"></path>
      <path d="M18.002 6.00098L6.00195 18.001" stroke={fill} strokeWidth="1.06066"></path>
    </svg>
  );
};
