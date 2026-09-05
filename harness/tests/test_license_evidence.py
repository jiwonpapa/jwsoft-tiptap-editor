"""Source-only audit must not erase independently verified archive evidence."""

import unittest

from harness.jw_harness.files import ROOT
from harness.jw_harness.process import run


class LicenseEvidenceTests(unittest.TestCase):
    def test_source_and_archive_write_separate_evidence(self) -> None:
        javascript = """
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const source = fs.readFileSync('scripts/license-audit.mjs','utf8');
const start=source.lastIndexOf('fs.writeFileSync(');
const call=source.slice(start,source.indexOf('console.log(',start));
const writes=[];
for(const artifactChecked of [true,false]) {
 vm.runInNewContext(call, {fs:{writeFileSync:(target)=>writes.push(target)},path,
   root:'/fixture',artifactChecked,evidence:{},JSON});
}
assert.deepEqual(writes,['/fixture/test-results/release/license.json','/fixture/test-results/release/license-source.json']);
"""
        run(["node", "--input-type=module", "-e", javascript], ROOT)
