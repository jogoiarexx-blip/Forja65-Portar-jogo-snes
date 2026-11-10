import importlib.util,io,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('bk2',Path(__file__).parents[1]/'tools/import-bk2.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def movie(rows,sha='a'*40):
 b=io.BytesIO()
 with zipfile.ZipFile(b,'w') as z:
  z.writestr('Header.txt','Platform SNES\nSHA1 '+sha+'\nAuthor Tester\n')
  z.writestr('Input Log.txt','[Input]\nLogKey:#Reset|Power|#P1 Up|P1 Down|P1 Left|P1 Right|P1 Select|P1 Start|P1 Y|P1 B|P1 X|P1 A|P1 L|P1 R|#P2 Up|P2 Down|P2 Left|P2 Right|P2 Select|P2 Start|P2 Y|P2 B|P2 X|P2 A|P2 L|P2 R|\n'+rows+'\n[/Input]\n')
 return b.getvalue()
rows,meta=m.decode(movie('|..|...R...B....|..L......A..|\n|..|............|............|'),'a'*40)
assert rows==[(0x8100,0x280),(0,0)]
for blob,sha in [(movie('|..|............|............|'),'b'*40),(movie('|P.|............|............|'),'a'*40),(movie('|..|............|...........|'),'a'*40)]:
 try:m.decode(blob,sha)
 except ValueError:pass
 else:raise AssertionError('invalid movie accepted')
print('BK2_IDENTITY_TWO_PADS_AND_VALIDATION_PASS')
