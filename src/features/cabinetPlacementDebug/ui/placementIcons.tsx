/** Draft overlay icons (design SVGs). Colour follows `currentColor`. */
export const MoveIcon = ({ size = 29 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 29 29" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M14.0833 0.75V27.4167M18.0833 4.75L14.0833 0.75L10.0833 4.75M10.0833 23.4167L14.0833 27.4167L18.0833 23.4167M23.4167 18.0833L27.4167 14.0833L23.4167 10.0833M27.4167 14.0833H0.75M4.75 18.0833L0.75 14.0833L4.75 10.0833"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const CloseIcon = ({ size = 10 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);
