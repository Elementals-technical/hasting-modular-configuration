export { CloseIcon, MoveIcon } from "@/features/cabinetPlacementDebug/ui/placementIcons";

export const EditIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path
      d="M7.5 2L10 4.5M1.5 10.5L2 8L8.5 1.5L10.5 3.5L4 10L1.5 10.5Z"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
