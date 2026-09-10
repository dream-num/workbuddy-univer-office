"""Package exactly one WorkBuddy Skill and its ordinary Markdown references."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import re
import posixpath
import hashlib

root = Path(__file__).resolve().parent.parent
source = root / 'skills/univer-office'
assert sorted((root / 'skills').rglob('SKILL.md')) == [source / 'SKILL.md'], 'Expected exactly one discoverable Skill'
entries = {}
for path in sorted(source.rglob('*')):
    assert not path.is_symlink(), f'Symlink not allowed: {path}'
    if path.is_file():
        assert path.suffix == '.md', f'Unexpected skill resource: {path}'
        entries[path.relative_to(source).as_posix()] = path.read_bytes()
assert sorted(name for name in entries if posixpath.basename(name) == 'SKILL.md') == ['SKILL.md']
assert {name for name in entries if name.startswith('references/')} == {
    f'references/{name}.md' for name in ['sheet', 'doc', 'slide', 'base', 'board', 'embed', 'cross-unit-formula']
}
for name, data in entries.items():
    for link in re.findall(r'\]\(([^)]+)\)', data.decode()):
        if '://' not in link:
            target = posixpath.normpath(posixpath.join(posixpath.dirname(name), link.split('#')[0]))
            assert target in entries, (name, target)
output = root / '.data/packages'
output.mkdir(parents=True, exist_ok=True)
archive = output / 'univer-office-workbuddy-skill.zip'
temporary = archive.with_suffix('.zip.tmp')
with ZipFile(temporary, 'w', ZIP_DEFLATED) as zipped:
    for name, data in entries.items():
        zipped.writestr(name, data)
with ZipFile(temporary) as zipped:
    assert set(zipped.namelist()) == set(entries)
    for name, data in entries.items():
        assert zipped.read(name) == data
    assert zipped.testzip() is None
temporary.replace(archive)
audit = {'skill': 'univer-office', 'archive': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'files': list(entries), 'discoverableSkills': 1}
(output / 'workbuddy-skills-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
print(json.dumps(audit))
