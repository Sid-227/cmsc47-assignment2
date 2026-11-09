"""Create aggregate chart data from the original ZIP, without publishing names."""
import collections
import csv
import io
import json
from pathlib import Path
import sys
import zipfile

archive = Path(sys.argv[1])
output = Path(__file__).resolve().parents[1] / 'data'
with zipfile.ZipFile(archive) as z:
    rows = list(csv.DictReader(io.TextIOWrapper(z.open('allegations_202007271729.csv'))))

counts = collections.Counter()
for row in rows:
    outcome = row['board_disposition']
    if outcome.startswith('Substantiated'):
        outcome = 'Substantiated'
    assert outcome in ['Substantiated', 'Unsubstantiated', 'Exonerated']
    counts[(int(row['year_received']), row['fado_type'], outcome)] += 1

with (output / 'outcomes.csv').open('w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['year', 'category', 'outcome', 'count'])
    writer.writerows((*key, count) for key, count in sorted(counts.items()))

metadata = {
    'allegations': len(rows),
    'complaints': len({r['complaint_id'] for r in rows}),
    'officers': len({r['unique_mos_id'] for r in rows}),
    'firstYear': min(int(r['year_received']) for r in rows),
    'lastYear': max(int(r['year_received']) for r in rows),
    'outcomes': dict(collections.Counter({o: sum(n for (y, c, outcome), n in counts.items() if outcome == o) for o in ['Substantiated', 'Unsubstantiated', 'Exonerated']}))
}
assert sum(counts.values()) == 33358
assert metadata['complaints'] == 12056
assert metadata['outcomes'] == {'Substantiated': 8301, 'Unsubstantiated': 15448, 'Exonerated': 9609}
(output / 'metadata.json').write_text(json.dumps(metadata, indent=2))
print(json.dumps(metadata, indent=2))
