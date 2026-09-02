<?php

/** Shared guard for mutation probes even when called outside the shell runner. */
function requireDedicatedEditorHost(string $g7Root): void
{
    $root = dirname(__DIR__, 2);
    $process = proc_open([
        getenv('HARNESS_PYTHON') ?: 'python3',
        '-m', 'harness.jw_harness', 'host-check', '--root', $g7Root,
    ], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $root);
    if (! is_resource($process)) {
        throw new RuntimeException('Dedicated host guard could not start.');
    }
    fclose($pipes[0]);
    stream_get_contents($pipes[1]);
    stream_get_contents($pipes[2]);
    fclose($pipes[1]);
    fclose($pipes[2]);
    if (proc_close($process) !== 0) {
        throw new RuntimeException('Unregistered or dirty G7 test checkout; mutation blocked.');
    }
}
