import type { createPopover } from "@/editor/popover";
import { labelMenuAction } from "@/editor/menuControls";

/** Fold the insertion group based on measured content, never hide history. */
export function installResponsiveInsert(
  toolbar: HTMLElement,
  group: HTMLElement,
  menu: ReturnType<typeof createPopover>,
) {
  group.classList.add("jwsoft-toolbar-insert");
  for (const control of group.querySelectorAll<HTMLButtonElement>("button"))
    labelMenuAction(control);
  menu.trigger.dataset.insertTrigger = "true";
  menu.trigger.hidden = true;
  group.after(menu.trigger);
  let destroyed = false;
  let frame = 0;
  const adapt = () => {
    frame = 0;
    if (destroyed || !toolbar.isConnected || !toolbar.clientWidth) return;
    // The inert, short-lived clone measures the expanded group at current font,
    // zoom and touch sizes. It is never interactive or exposed to accessibility.
    const measure = toolbar.cloneNode(true) as HTMLElement;
    measure.classList.add("jwsoft-toolbar-measure");
    measure.inert = true;
    measure.setAttribute("aria-hidden", "true");
    measure.querySelector("[data-insert-trigger]")?.remove();
    measure.querySelector(".jwsoft-toolbar-insert")?.remove();
    measure.append(group.cloneNode(true));
    toolbar.parentElement!.append(measure);
    const folded =
      measure.getBoundingClientRect().width > toolbar.clientWidth + 1;
    measure.remove();
    if (folded !== (group.parentElement === menu.panel)) {
      const focused = group.contains(document.activeElement);
      menu.close(false);
      if (folded) menu.panel.append(group);
      else menu.trigger.before(group);
      menu.trigger.hidden = !folded;
      if (focused && folded) menu.trigger.focus();
      // Controls moved out of the roving toolbar must become tabbable again.
      for (const control of group.querySelectorAll<HTMLElement>("button"))
        control.tabIndex = 0;
      toolbar.dispatchEvent(new Event("jwsoft-controls-updated"));
    }
    menu.trigger.hidden = !folded;
  };
  const schedule = () => {
    if (!frame && !destroyed) frame = requestAnimationFrame(adapt);
  };
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  observer?.observe(toolbar);
  window.addEventListener("resize", schedule);
  document.fonts?.ready.then(schedule, schedule);
  schedule();
  return () => {
    destroyed = true;
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener("resize", schedule);
  };
}
