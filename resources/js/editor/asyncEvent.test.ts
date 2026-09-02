import { bindAsyncForm, listenAsync } from "@/editor/asyncEvent";

it("handles rejection while preserving synchronous preventDefault", async () => {
  const form = document.createElement("form");
  const submit = document.createElement("button");
  const error = document.createElement("div");
  error.hidden = true;
  submit.disabled = true;
  bindAsyncForm(form, submit, error, "ko", async (event) => {
    event.preventDefault();
    throw new Error("private failure");
  });
  const event = new Event("submit", { cancelable: true });
  form.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await vi.waitFor(() => expect(error.hidden).toBe(false));
  expect(submit.disabled).toBe(false);
  expect(error.textContent).not.toContain("private failure");
});

it("also reports synchronous failures without losing the error", () => {
  const button = document.createElement("button");
  const failure = vi.fn();
  listenAsync(
    button,
    "click",
    () => {
      throw new Error("sync");
    },
    failure,
  );
  button.click();
  expect(failure).toHaveBeenCalledOnce();
});
