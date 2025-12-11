import { PlayCanvasIntegration } from "@/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx";

import { BottomCanvasButtons } from "@/features/bottomCanvasButtons/BottomCanvasButtons";

export function Player() {
  return (
    <div>
      <PlayCanvasIntegration />

      <BottomCanvasButtons />
    </div>
  );
}
