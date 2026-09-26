# Project UI conventions

- Use the shared `DialogContent` and `AlertDialogContent` for centered editing and confirmation windows; they constrain width and height to the viewport and scroll tall content, so feature code must not override their fixed positioning or vertical translation.
- Keep deliberately side-anchored navigation sheets separate from editing dialogs; side navigation is not a centered modal.