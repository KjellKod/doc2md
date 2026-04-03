# Requiem: Preview Pane Resizer

The sidebar had already learned how to disappear. That was useful, but binary. Either it stood there at full width like a tollbooth or it folded into a rail and left the preview alone. Users wanted a middle ground, which is a polite way of saying the fixed width was still taxing the editor every day.

So we cut a seam into the layout and made it movable.

The good part is that this stayed small. One handle. One width state. One clamp helper. One clean agreement with collapse: if the sidebar is visible, it can be resized; if it is collapsed, it remembers the last width and minds its business until called back. That is the sort of restraint that keeps a UI feature from becoming a belief system.

The review found the one thing worth finding: the resize listener was quietly being rebound on every drag step. Functionally fine, operationally sloppy. The fix was to keep the width in a ref, let the window listener stay put, and stop pretending that every pixel deserved a new subscription ceremony.

What remains is visual, as it should be. Someone should still put hands on the divider in a real browser and decide whether it feels obvious enough, thin enough, and worth trusting. But the logic is sound now. The preview can breathe without needing the sidebar to die completely.
