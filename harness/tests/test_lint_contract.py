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
