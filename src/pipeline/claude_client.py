"""Lightweight Anthropic API client using httpx (no SDK dependency)."""

import os
import json
import httpx

API_URL = 'https://api.anthropic.com/v1/messages'


def stream_message(model: str, max_tokens: int, temperature: float, messages: list):
    """Stream a message from Claude API. Yields text chunks.
    Returns (collected_text, input_tokens, output_tokens) after streaming."""
    api_key = os.getenv('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError('ANTHROPIC_API_KEY not set')

    headers = {
        'x-api-key': api_key,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
    }
    body = {
        'model': model,
        'max_tokens': max_tokens,
        'temperature': temperature,
        'messages': messages,
        'stream': True,
    }

    collected = ''
    input_tokens = 0
    output_tokens = 0

    with httpx.stream('POST', API_URL, headers=headers, json=body, timeout=600) as response:
        if response.status_code != 200:
            error_text = response.read().decode()
            raise Exception(f'Anthropic API error {response.status_code}: {error_text[:500]}')

        for line in response.iter_lines():
            if not line.startswith('data: '):
                continue
            data = line[6:]
            if data == '[DONE]':
                break
            try:
                event = json.loads(data)
                event_type = event.get('type', '')

                if event_type == 'content_block_delta':
                    delta = event.get('delta', {})
                    if delta.get('type') == 'text_delta':
                        text = delta.get('text', '')
                        collected += text
                        yield {'type': 'text', 'text': text}

                elif event_type == 'message_start':
                    usage = event.get('message', {}).get('usage', {})
                    input_tokens = usage.get('input_tokens', 0)

                elif event_type == 'message_delta':
                    usage = event.get('usage', {})
                    output_tokens = usage.get('output_tokens', 0)

            except json.JSONDecodeError:
                continue

    yield {'type': 'done', 'collected': collected,
           'input_tokens': input_tokens, 'output_tokens': output_tokens}
