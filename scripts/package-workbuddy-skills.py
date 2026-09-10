"""Build the root-SKILL ZIP bundle verified by WorkBuddy recursive discovery."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import re
import posixpath
import hashlib

root = Path(__file__).resolve().parent.parent
sources = sorted((root / 'skills').glob('*/SKILL.md'))
assert len(sources) == 8
output = root / '.data/packages'
output.mkdir(parents=True, exist_ok=True)
audit = []
for source in [root / 'skills/univer/SKILL.md']:
    entries = {'SKILL.md': source.read_text().replace('](../', '](references/')}
    entries.update({'references/' + str(f.relative_to(root / 'skills')): f.read_text() for f in sources})
    for name, content in entries.items():
        for link in re.findall(r'\]\(([^)]+)\)', content):
            if '://' not in link:
                target = posixpath.normpath(posixpath.join(posixpath.dirname(name), link))
                assert target in entries, (name, target)
    archive = output / (source.parent.name + '-workbuddy-skill.zip')
    with ZipFile(archive, 'w', ZIP_DEFLATED) as zipped:
        for name, content in entries.items():
            zipped.writestr(name, content)
    with ZipFile(archive) as zipped:
        assert set(zipped.namelist()) == set(entries)
        for name, content in entries.items():
            assert zipped.read(name).decode() == content
    audit.append({'skill': source.parent.name, 'archive': str(archive), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'files': len(entries)})
(output / 'workbuddy-skills-audit.json').write_text(json.dumps(audit, indent=2) + '\n')
print('Built one WorkBuddy bundle with eight discoverable skills; reference links resolve.')
