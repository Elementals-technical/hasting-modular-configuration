/** Scene selection listens before click. Keep a drawer control's press from deselecting its cabinet and removing it. */
export function protectDrawerWidgetInput(button: HTMLButtonElement): void {
  const stopSelection = (event: Event) => event.stopPropagation();
  for (const type of ["pointerdown", "mousedown", "touchstart"]) {
    button.addEventListener(type, stopSelection);
  }
}
