import { LocationIcon } from "@/shared/assets/images/svg/LocationIcon.tsx";
import { PhoneIcon } from "@/shared/assets/images/svg/PhoneIcon.tsx";
import { CustomerIcon } from "@/shared/assets/images/svg/CustomerIcon.tsx";

export const HEADER_MAIN_MENU = [
  { title: "Products", to: "" },
  { title: "Inspiration", to: "" },
  { title: "Resources", to: "" },
  { title: "How to Buy", to: "" },
  { title: "Company", to: "" },
];

export const HEADER_TOP_RIGHT_MENU = [
  { title: "Visit Our NYC Showroom", to: "#", icon: <LocationIcon /> },
  { title: "800-351-0038", to: "#", icon: <PhoneIcon /> },
  { title: "Customer Support", to: "#", icon: <CustomerIcon /> },
];
