import { BottomCanvasButtons } from "@/features/bottomCanvasButtons/bottomCanvasButtons";

import { PlayCanvasIntegration } from "@/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx";

export function Player() {
  return (
    <div>
      <PlayCanvasIntegration />

      <BottomCanvasButtons />
    </div>
  );
}
