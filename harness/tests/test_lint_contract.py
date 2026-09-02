"""Exercise the real type-aware linter against bad source without editing that source."""

import json
import unittest

from harness.jw_harness.files import ROOT
from harness.jw_harness.process import run


class LintContractTests(unittest.TestCase):
    def test_any_and_unhandled_promises_fail_the_real_linter(self) -> None:
        javascript = """
import { ESLint } from 'eslint';
const lint = new ESLint();
const [result] = await lint.lintText(
  'export const value: any = {}; Promise.reject(new Error("failure"));',
  {filePath: 'resources/js/editor/content.ts'}
);
console.log(JSON.stringify(result.messages.map(message => message.ruleId)));
"""
        rules = json.loads(
            run(["node", "--input-type=module", "-e", javascript], ROOT, capture=True)
        )
        self.assertIn("@typescript-eslint/no-explicit-any", rules)
        self.assertIn("@typescript-eslint/no-floating-promises", rules)

    def test_callback_boundary_and_new_large_function_are_rejected(self) -> None:
        javascript = """
import { ESLint } from 'eslint';
const lint = new ESLint();
const inputs = [
 ['resources/js/editor/content.ts',
  'window.addEventListener("click", async () => { throw new Error("lost"); });'],
 ['resources/js/policy/runtimePolicy.ts',
  'import {editorText} from "../editor/locale"; export const x=editorText;'],
 ['resources/js/policy/runtimePolicy.ts', 'export {editorText} from "../policy/../editor/locale";'],
 ['resources/js/editor/content.ts', 'export {initEditorHandler} from "../handlers/initEditor";'],
 ['resources/js/editor/toolbar.ts',
  'export function added() {\\n' + 'Math.random();\\n'.repeat(90) + '}'],
];
const output=[];
for (const [filePath, code] of inputs) {
 const [result] = await lint.lintText(code,{filePath});
 output.push(result.messages.map(message=>message.ruleId));
}
console.log(JSON.stringify(output));
"""
        results = json.loads(
            run(["node", "--input-type=module", "-e", javascript], ROOT, capture=True)
        )
        self.assertIn("@typescript-eslint/no-misused-promises", results[0])
        for result in results[1:4]:
            self.assertIn("jw-editor/layer-imports", result)
        self.assertIn("jw-editor/bounded-functions", results[4])
