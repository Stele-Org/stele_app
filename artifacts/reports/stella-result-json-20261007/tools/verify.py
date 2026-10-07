# Checks every result the browser run produced against the client's table and the user's rules, independently of
# the application code, then copies the files under readable names and writes a summary.
# Usage: python verify.py <run dir> <project root> <output dir>
import json, os, shutil, sys

run, root, out = sys.argv[1:4]
passes = json.load(open(os.path.join(run, 'full.json'), encoding='utf-8'))
sheets = {s['sheet']: {c['cell']: c['value'] for c in s['cells']}
          for s in json.load(open(os.path.join(root, 'docs/Research/stella-inputs-20261001/metadata-extracted.json'), encoding='utf-8'))}
vk, th = sheets['VK Видео'], sheets['VK Видео_Темы']

ids = ['series', 'standup', 'interview', 'science', 'drive', 'heroes', 'learn', 'rest', 'familiar', 'new', 'hero', 'popular']
number = {a: f'{1 + i // 4}.{1 + i % 4}' for i, a in enumerate(ids)}
# The client's table: tags of an answer (rows 2-13, photo in row 14) and theme points (rows 18-21, 24-27).
tags_of = {a: [vk[f'{c}{i + 2}'] for c in 'CDEF'] for i, a in enumerate(ids)}
photo_tags = [vk[f'{c}14'] for c in 'CDEF']
theme_points = {a: (th[f'C{r}'], th[f'D{r}']) for a, r in zip(ids[:8], [18, 19, 20, 21, 24, 25, 26, 27])}
rules = {a: th[f'C{r}'] for a, r in zip(ids[8:], [10, 11, 12, 13])}
# The user's tables of 07.10.2026 for the genres of the AI covers.
genre_points = {
    'series': (['FANTASY'], ['HORROR']), 'standup': (['COMEDY'], ['BOEVIK', 'MUSICLE']),
    'interview': (['HISTORY'], ['DRAMA']), 'science': (['SCI-FI'], ['ADVENTURE', 'DETECTIVE']),
    'drive': (['BOEVIK', 'ADVENTURE'], []), 'heroes': (['DRAMA', 'HORROR'], []),
    'learn': (['DETECTIVE'], ['HISTORY', 'SCI-FI']), 'rest': (['MUSICLE'], ['FANTASY', 'COMEDY']),
}
genre_theme = {'SCI-FI': 'Наука', 'HISTORY': 'Культура и образование', 'COMEDY': 'Медиа и шоу', 'MUSICLE': 'Музыка', 'BOEVIK': 'Игры и авто',
               'DRAMA': 'Спорт', 'HORROR': 'Спорт', 'DETECTIVE': 'Новости и бизнес', 'FANTASY': 'Кино', 'ADVENTURE': 'Кино'}
all_themes = sorted(set(genre_theme.values()))

def unique(items):
    seen = []
    for item in items:
        if item not in seen: seen.append(item)
    return seen

def check(p):
    problems = []
    def expect(ok, text):
        if not ok: problems.append(text)
    a1, a2, a3 = p['answers']
    # AI covers take the answer of the hero and an approved photo (user, 08.10.2026).
    ai = a3 == 'hero' and p['photo'] == 'accepted'
    r = json.load(open(os.path.join(run, 'results', p['file']), encoding='utf-8'))
    expect(p['status'] == 201, f"status {p['status']}")
    expect(r == p['sent'], 'the stored file differs from what the page sent')
    expect(list(r)[:5] == ['covers', 'aiCover', 'coversTotal', 'tags', 'answers'], f'order of the file: {list(r)[:5]}')
    expect((r['schemaVersion'], r['type'], r['product']) == (1, 'stella-vk-result', 'vk-video'), 'kind of the document')
    expect(p['file'].endswith('_' + r['sessionId'] + '.json'), 'file name and session id')
    # One result for a visitor, whatever was changed on the way: the page sent it once, and one file carries the session.
    expect(p.get('resultPosts') == 1, f"the page sent the result {p.get('resultPosts')} times")
    expect(sum(1 for n in os.listdir(os.path.join(run, 'results')) if n.endswith('_' + r['sessionId'] + '.json')) == 1, 'files of the session')
    # Answers and tags: the answers that stood at the end.
    photo_answer = {'accepted': 'accept', 'unavailable': 'accept', 'skipped': 'skip'}.get(p['photo'])
    expect([x['answerId'] for x in r['answers']] == [a1, a2, a3] + ([photo_answer] if photo_answer else []), f"answers {[x['answerId'] for x in r['answers']]}")
    want_tags = [unique(tags_of[a]) for a in (a1, a2, a3)] + ([photo_tags if photo_answer == 'accept' else []] if photo_answer else [])
    expect([x['tags'] for x in r['answers']] == want_tags, 'tags of the answers')
    expect(r['tags'] == unique(t for group in want_tags for t in group), 'the list of all tags')
    # Photo.
    expect(r['photo']['status'] == p['photo'], f"photo status {r['photo']['status']}")
    if p['photo'] == 'accepted':
        expect(r['photo'].get('captureId') == p.get('photoCaptureId'), 'the result names another photo than the one stored')
        expect(p.get('photoStatus') == 201 and p.get('photoPosts') == 1, f"photo storage: status {p.get('photoStatus')}, sent {p.get('photoPosts')} times")
        expect(any(n.endswith('_' + str(r['photo'].get('captureId')) + '.jpg') for n in os.listdir(os.path.join(run, 'photos'))), 'the photo file is missing')
        expect(p.get('photoShown') == 'photo', f"the check showed {p.get('photoShown')}")
    else:
        expect('captureId' not in r['photo'] and p.get('photoPosts') == 0, 'a photo without an approved photo')
    if p['photo'] == 'unavailable': expect(p.get('photoShown') == 'black-square', f"the check showed {p.get('photoShown')}")
    if p.get('retake'): expect(p.get('sentBeforeKeep') == {'result': 0, 'photo': 0}, f"«Повторить» stored something: {p.get('sentBeforeKeep')}")
    # Themes: the client's points, the order by points.
    points = {t: 0 for t in all_themes}
    for a in (a1, a2):
        two, one = theme_points[a]; points[two] += 2; points[one] += 1
    expect({x['theme']: x['score'] for x in r['themes']} == points, 'points of the themes')
    scores = [x['score'] for x in r['themes']]
    expect(scores == sorted(scores, reverse=True) and [x['rank'] for x in r['themes']] == list(range(1, 9)), 'order of the themes')
    # Six covers.
    want_themes = [x['theme'] for x in r['themes'][:2 if ai else 3]]
    expect(r['covers'] == [{'theme': t, 'count': 2} for t in want_themes], f"covers by themes: {r['covers']}")
    expect(all(points[x['theme']] > 0 for x in r['covers']), 'a cover for a theme without points')
    expect([x['covers'] for x in r['themes']] == [2] * len(want_themes) + [0] * (8 - len(want_themes)), 'covers in the list of themes')
    expect(r['coversTotal'] == 6 == sum(x['count'] for x in r['covers']) + sum(x['count'] for x in r['aiCover']), 'six covers in all')
    # AI covers and genres.
    if ai:
        gp = {g: 0 for g in genre_theme}
        for a in (a1, a2):
            two, one = genre_points[a]
            for g in two: gp[g] += 2
            for g in one: gp[g] += 1
        expect({x['genre']: x['score'] for x in r['genres']} == gp, 'points of the genres')
        gs = [x['score'] for x in r['genres']]
        expect(gs == sorted(gs, reverse=True) and len(gs) == 10, 'order of the genres')
        expect([(x['genre'], x['count']) for x in r['aiCover']] == [(x['genre'], 1) for x in r['genres'][:2]], f"AI covers: {r['aiCover']}")
        expect(len({x['genre'] for x in r['aiCover']}) == 2 and all(gp[x['genre']] > 0 for x in r['aiCover']), 'AI covers: two different genres with points')
        expect(all(x['theme'] == genre_theme[x['genre']] and x['recipeId'].endswith('_' + x['genre']) for x in r['genres'] + r['aiCover']), 'theme and recipe of a genre')
        expect([x['covers'] for x in r['genres']] == [1, 1] + [0] * 8, 'covers in the list of genres')
    else:
        expect(r['aiCover'] == [] and r['genres'] == [], f"AI covers without the hero's photo: {r['aiCover']}")
    expect(r['discovery'] == {'answerId': a3, 'rule': rules[a3]}, 'the rule of Discovery')
    expect(not p.get('errors'), f"errors in the page: {p.get('errors')}")
    return r, problems

for folder in ['json', 'json-back']: os.makedirs(os.path.join(out, folder), exist_ok=True)
suffix = {'not-requested': '', 'accepted': '_photo', 'unavailable': '_no-photo', 'skipped': '_skip'}
rows, bad, failed = [], 0, 0
for p in passes:
    if p.get('error') or not p.get('file'):
        failed += 1; print('NO RESULT', p.get('name') or p['answers'], p['photo'], p.get('error')); continue
    r, problems = check(p)
    name = (p['name'] if p.get('name') else '-'.join(number[a] for a in p['answers']) + suffix[p['photo']]) + '.json'
    folder = 'json-back' if p.get('name') else 'json'
    shutil.copyfile(os.path.join(run, 'results', p['file']), os.path.join(out, folder, name))
    if problems: bad += 1; print('PROBLEM', name, problems)
    rows.append((folder, name, p, r, problems))

fallbacks = sum(1 for *_, p, _, _ in rows for c in p.get('clicks', []) if not c['hit'])
clicks = sum(len(p.get('clicks', [])) for *_, p, _, _ in rows)
retried = sum(1 for *_, p, _, _ in rows if p.get('attempts', 1) > 1)
print(f'results: {len(rows)} of {len(passes)}; with problems: {bad}; without a result: {failed}; retried: {retried}; clicks: {clicks}, not by the mouse: {fallbacks}')
json.dump({'results': len(rows), 'passes': len(passes), 'problems': bad, 'failed': failed, 'retried': retried, 'clicks': clicks, 'fallbackClicks': fallbacks,
           'rows': [{'folder': f, 'file': n, 'name': p.get('name'), 'route': p.get('route'), 'retake': p.get('retake', False), 'answers': p['answers'], 'photo': p['photo'],
                     'covers': r['covers'], 'aiCover': [(x['genre'], x['count']) for x in r['aiCover']],
                     'themeScores': [(x['theme'], x['score']) for x in r['themes'] if x['score']], 'times': p.get('times'), 'problems': pr}
                    for f, n, p, r, pr in rows]},
          open(os.path.join(out, 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
