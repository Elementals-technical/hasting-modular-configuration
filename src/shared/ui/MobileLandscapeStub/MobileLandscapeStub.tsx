import { RotateDeviceIcon } from "@/shared/assets/images/svg/RotateDeviceIcon";

import { useIsMobileLandscape } from "./useIsMobileLandscape";

import s from "./MobileLandscapeStub.module.scss";

export const MobileLandscapeStub = () => {
  const isMobileLandscape = useIsMobileLandscape();

  if (!isMobileLandscape) return null;

  return (
    <div className={s.stub} role="alert">
      <RotateDeviceIcon />
      <h2 className={s.title}>Please rotate your device</h2>
      <p className={s.text}>The configurator works in portrait mode only.</p>
    </div>
  );
};
