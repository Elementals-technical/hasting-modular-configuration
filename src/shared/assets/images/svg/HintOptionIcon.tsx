interface HintOptionIconI {
  width?: string;
  height?: string;
}

export const HintOptionIcon: React.FC<HintOptionIconI> = ({ height = "14", width = "14" }) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={width} height={height} viewBox="0 0 14 14" fill="none">
      <g clip-path="url(#clip0_745_6262)">
        <path
          d="M7.00002 12.8337C10.2217 12.8337 12.8334 10.222 12.8334 7.00033C12.8334 3.77866 10.2217 1.16699 7.00002 1.16699C3.77836 1.16699 1.16669 3.77866 1.16669 7.00033C1.16669 10.222 3.77836 12.8337 7.00002 12.8337Z"
          stroke="#282828"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M7 9.33366V7.00033M7 4.66699H7.00583"
          stroke="#282828"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_745_6262">
          <rect width="14" height="14" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
};
