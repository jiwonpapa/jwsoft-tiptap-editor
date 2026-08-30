// jsdom has no top layer. These shims test lifecycle/commands only; real modal
// focus trapping, inert background and geometry are covered by browser E2E.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
