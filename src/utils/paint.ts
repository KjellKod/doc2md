export function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    const finishOnTaskBoundary = () => {
      globalThis.setTimeout(resolve, 0);
    };

    if (
      typeof window !== "undefined" &&
      typeof window.requestAnimationFrame === "function"
    ) {
      window.requestAnimationFrame(finishOnTaskBoundary);
      return;
    }

    finishOnTaskBoundary();
  });
}

export async function keepBusyStateVisible(minimumMs = 120): Promise<void> {
  await afterNextPaint();
  await new Promise<void>((resolve) => {
    globalThis.setTimeout(resolve, minimumMs);
  });
}
