<?php

$messages = json_decode(file_get_contents(__DIR__.'/../../resources/lang/en.json'), true, 512, JSON_THROW_ON_ERROR)['messages'];
array_walk_recursive($messages, static function (&$value): void {
    $value = preg_replace('/\{\{(\w+)\}\}/', ':$1', $value);
});

return $messages;
