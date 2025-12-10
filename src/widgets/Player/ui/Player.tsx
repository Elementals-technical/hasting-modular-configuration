import { BottomCanvasButtons } from "@/features/bottomCanvasButtons/BottomCanvasButtons";
import { PlayCanvasIntegration } from "@/widgets/Player/components/PlayCanvasIntegration/PlayCanvasIntegration.tsx";

export function Player() {
  return (
    <div>
      <PlayCanvasIntegration />

      <BottomCanvasButtons />
    </div>
  );
}
