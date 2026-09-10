"""Independently inspect the XLSX fixture produced by base-formula.test.mjs."""
import json
import sys
import zipfile
import xml.etree.ElementTree as ET

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}

with zipfile.ZipFile(sys.argv[1]) as archive:
    workbook = ET.fromstring(archive.read("xl/workbook.xml"))
    assert len(workbook.findall("m:sheets/m:sheet", NS)) == 1
    sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
    cells = {cell.get("r"): cell for cell in sheet.findall(".//m:c", NS)}
    assert set(cells) == {f"{column}{row}" for column in "ABCD" for row in range(1, 4)}
    for address, expected in [("B2", "21"), ("B3", "8")]:
        assert cells[address].get("t") in (None, "n"), address
        assert cells[address].find("m:v", NS).text == expected, address
    for address, expected in [("D2", "0"), ("D3", "1")]:
        assert cells[address].get("t") == "b", address
        assert cells[address].find("m:v", NS).text == expected, address
    assert not sheet.findall(".//m:f", NS), "View exports must contain confirmed values"
    strings = [
        "".join(node.itertext())
        for node in ET.fromstring(archive.read("xl/sharedStrings.xml")).findall("m:si", NS)
    ]
    expected = {"Item", "Total", "Label", "Small", "High", "Total 21", "Low", "Total 8"}
    assert set(strings) == expected, "Hidden or excluded values leaked into shared strings"
    for address, text in [("A2", "High"), ("A3", "Low"), ("C2", "Total 21"), ("C3", "Total 8")]:
        assert cells[address].get("t") == "s"
        assert strings[int(cells[address].find("m:v", NS).text)] == text

print(json.dumps({"numericValues": [21, 8], "booleanValues": [False, True], "hiddenInputsAbsent": True}))
