"""Package the official local stdio MCP connector; runtime is a versioned release asset."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
import hashlib
import json
import re

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
release = f'v{version}-preview.1'
runtime_url = f'https://github.com/dream-num/workbuddy-univer-office/releases/download/{release}/workbuddy-univer-office-{version}.tgz'
entries = {}
def document(name, value):
    entries[name] = (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode()

document('connector-meta.json', {
    'name': 'Univer Office', 'name_zh': 'Univer Office', 'name_en': 'Univer Office',
    'description': 'Create and review local Office files using spreadsheets, documents, slides, Base and Board.',
    'description_zh': '在本机创建表格、文档、幻灯片、多维表格与白板，支持预览、版本对比和人工审阅。开发预览版。',
    'description_en': 'Create local spreadsheets, documents, slides, Base tables and Board canvases with previews, comparisons and human review. Development preview.',
    'source': 'univer-office', 'type': 'mcp', 'version': version, 'auth_mode': 'token',
    'minWorkbuddyVersion': '5.5.4',
    'examples_zh': ['创建一份销售表，计算总额并预览。', '把项目说明整理成文档和幻灯片，交给我审阅。'],
    'examples_en': ['Create a sales spreadsheet, calculate the total and preview it.', 'Turn the project brief into a document and slides for my review.'],
})
document('mcp.json', {'mcpServers': {'univer-office': {
    'type': 'stdio', 'command': 'npx', 'args': ['--yes', '--prefer-offline', '--package=' + runtime_url, 'univer-office'],
    'runtime': {'type': 'node', 'version': '>=22.12.0 <23'},
    'npmRegistry': 'https://insider-npm-registry.univer.work/',
    'env': {'WORKBUDDY_OFFICE_WORKSPACE': '${WORKBUDDY_OFFICE_WORKSPACE}', 'npm_config_maxsockets': '6'},
    'timeout': 900000,
}}})
document('token-schema.json', {
    'title': '设置 Office 文件目录', 'title_en': 'Choose an Office file directory',
    'description': '本连接器在你的电脑运行，无需云账号或 API 密钥。请填写允许读写的本地文件夹绝对路径；设置仅保存在本机。',
    'description_en': 'Runs on your computer without a cloud account or API key. Enter an absolute local directory you authorize Office to read and write. Settings stay on your machine.',
    'fields': [{
        'key': 'WORKBUDDY_OFFICE_WORKSPACE', 'label': 'Office 文件目录', 'label_en': 'Office file directory',
        'type': 'text', 'required': True,
        'description': '例如你为 Office 文件准备的完整文件夹路径。请勿填写 ~、相对路径或变量。',
        'description_en': 'Use the full path to a folder for Office files. Do not use ~, relative paths or variables.',
    }],
})
entries['icon.png'] = (root / 'assets/univer-office.png').read_bytes()
for path in sorted((root / 'skills/univer-office').rglob('*')):
    assert not path.is_symlink(), path
    if path.is_file():
        assert path.suffix == '.md'
        entries[path.relative_to(root).as_posix()] = path.read_bytes()
entries['README.md'] = f'''# Univer Office — local MCP connector

Publisher: dream-num. Contact: liuyang@univer.ai.
Source: https://github.com/dream-num/workbuddy-univer-office

This is a development-preview connector candidate, not an approval record.
One stdio MCP server and one Skill; no cloud Office service. WorkBuddy prepares
Node and npx obtains the versioned runtime from:
{runtime_url}

On first connection, enter an absolute local directory authorized for Office
files. The platform's token-schema form is used for this non-secret local
configuration; no API key or OAuth account is needed. This use of a directory
field must be verified in the platform preview. The server rejects absent,
unexpanded or relative paths. It never defaults to the user's home directory.

The runtime uses the public Univer insiders npm registry for its pinned SDK
cohort and npm dependencies. Network access is required for initial download;
Office data is stored locally. The host's own model data handling is separate.
The runtime includes an npm shrinkwrap lock. Initial downloads may take several
minutes; the connection timeout allows up to 15 minutes. Later starts reuse the
host's npm cache. This timeout is not a performance guarantee.

After connecting, create a Sheet, write a SUM formula, read it back and call
univer_preview. Verify the actual WorkBuddy panel: the prior HTTP development
integration's MCP App results do not establish stdio connector App discovery.
View and Compare are read-only; human editing requires a complete confirmed
merge. Base PDF and Board file export are unsupported. Review/edit currently
use the external browser. Full parity and other operating systems remain under
acceptance testing.

Application source is Apache-2.0. SDK dependencies retain their own license
requirements; this connector grants no Pro license. An expert package and a
separately installed Skill are not required by this connector.
'''.encode()

assert sum(n.endswith('/SKILL.md') for n in entries) == 1
assert sum(n.startswith('skills/univer-office/references/') for n in entries) == 7
for name, data in entries.items():
    assert not name.startswith('/') and '..' not in Path(name).parts
    if name != 'icon.png':
        assert not re.search(rb'/Users/|Bearer [a-f0-9]{64}', data), name
directory = root / '.data/packages/univer-office-connector'
directory.mkdir(parents=True, exist_ok=True)
for name, data in entries.items():
    path = directory / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
archive = directory.parent / f'univer-office-connector-{version}.zip'
with ZipFile(archive, 'w', ZIP_DEFLATED) as zipped:
    for name, data in sorted(entries.items()):
        info = ZipInfo(name, (2026, 1, 1, 0, 0, 0))
        info.compress_type = ZIP_DEFLATED
        info.external_attr = 0o100644 << 16
        zipped.writestr(info, data)
with ZipFile(archive) as zipped:
    assert zipped.testzip() is None
    assert sorted(zipped.namelist()) == sorted(entries)
    for name, data in entries.items():
        assert zipped.read(name) == data
assert archive.stat().st_size < 20_000_000
report = {'archive': archive.name, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'bytes': archive.stat().st_size, 'runtimeUrl': runtime_url, 'files': sorted(entries)}
(directory.parent / 'connector-package-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({key: value for key, value in report.items() if key != 'files'}))
