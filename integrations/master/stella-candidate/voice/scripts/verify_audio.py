"""Small offline check of real generated assets, not a provider mock."""
import hashlib
import json
import wave
from pathlib import Path

root = Path(__file__).resolve().parents[4]
app = root / 'artifacts/stella-prototype'
base = app / 'public/voice/vasilisa'
manifest = json.loads((base / 'manifest.json').read_text(encoding='utf-8'))
phrases = json.loads((app / 'voice/vasilisa/phrases.json').read_text(encoding='utf-8'))
assert manifest['ready'] is True
assert set(manifest['assets']) == {p['id'] for p in phrases['phrases']}
rows = []
for cue, filename in manifest['assets'].items():
    p = base / filename
    with wave.open(str(p), 'rb') as w:
        frames = w.getnframes()
        assert (w.getframerate(), w.getnchannels(), w.getsampwidth()) == (24000, 1, 2)
        raw = w.readframes(frames)
        assert len(raw) == frames * 2, f'{cue}: unfinished WAV header'
        assert any(raw), f'{cue}: empty PCM'
        duration = frames / 24000
    if cue == 'vk-camera':
        assert duration <= 1.65, 'Camera needs load margin before the 1.8s transition'
    if cue == 'vk-discovery-activation':
        assert duration <= 3.2
    rows.append(dict(file=filename, seconds=round(duration, 4), rate=24000,
                     channels=1, bits=16, sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
(root / 'artifacts/reports/vasilisa-audio-20261004.json').write_text(
    json.dumps(rows, indent=2) + '\n', encoding='utf-8')
print(f'PASS: {len(rows)} real WAV files, manifest coverage, headers, PCM and timed cues')
